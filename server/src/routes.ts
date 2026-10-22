import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AiLimitError, AiUnavailableError, compatibility, generateBios, generateIcebreakers } from "./ai.js";
import { authenticate } from "./auth.js";
import { createInvoiceLink, notify } from "./bot.js";
import { config } from "./config.js";
import {
  db, getUser, isPremium, now, pairKey, privateProfile, publicProfile, startOfDay, type UserRow,
} from "./db.js";
import { PRODUCTS, isProduct } from "./payments.js";

const MAX_PHOTOS = 6;
mkdirSync(config.uploadsDir, { recursive: true });

declare module "fastify" {
  interface FastifyRequest {
    user: UserRow;
  }
}

function fail(reply: FastifyReply, code: number, error: string) {
  return reply.code(code).send({ error });
}

/** Мэтч, в котором участвует пользователь, или null. */
function matchFor(matchId: number, userId: number) {
  const m = db.prepare("SELECT * FROM matches WHERE id = ?").get(matchId) as
    | { id: number; user_a: number; user_b: number }
    | undefined;
  if (!m || (m.user_a !== userId && m.user_b !== userId)) return null;
  return { ...m, otherId: m.user_a === userId ? m.user_b : m.user_a };
}

function likesToday(userId: number) {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM swipes WHERE from_id = ? AND kind != 'pass' AND created_at >= ?")
    .get(userId, startOfDay()) as { n: number };
  return row.n;
}

async function aiCall<T>(reply: FastifyReply, fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AiLimitError) return fail(reply, 429, "ai_limit");
    if (e instanceof AiUnavailableError) return fail(reply, 503, "ai_unavailable");
    throw e;
  }
}

const ProfileUpdate = z.object({
  name: z.string().trim().min(1).max(40),
  age: z.number().int().min(18).max(99),
  gender: z.enum(["m", "f"]),
  lookingFor: z.enum(["m", "f", "any"]),
  ageMin: z.number().int().min(18).max(99),
  ageMax: z.number().int().min(18).max(99),
  city: z.string().trim().max(60),
  bio: z.string().trim().max(500),
  interests: z.array(z.string().trim().min(1).max(30)).max(15),
});

export async function routes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    const user = authenticate(req);
    if (!user) return fail(reply, 401, "unauthorized");
    req.user = user;
  });

  app.get("/api/me", async (req) => ({
    me: privateProfile(req.user),
    limits: {
      likesLeft: isPremium(req.user) ? null : Math.max(0, config.freeDailyLikes - likesToday(req.user.id)),
      aiEnabled: config.aiEnabled,
    },
    products: PRODUCTS,
  }));

  app.put("/api/me", async (req, reply) => {
    const body = ProfileUpdate.safeParse(req.body);
    if (!body.success) return fail(reply, 400, "invalid_profile");
    const p = body.data;
    db.prepare(
      `UPDATE users SET name = ?, age = ?, gender = ?, looking_for = ?, age_min = ?, age_max = ?,
         city = ?, bio = ?, interests = ?, onboarded = 1 WHERE id = ?`,
    ).run(p.name, p.age, p.gender, p.lookingFor, Math.min(p.ageMin, p.ageMax), Math.max(p.ageMin, p.ageMax),
      p.city, p.bio, JSON.stringify(p.interests), req.user.id);
    return { me: privateProfile(getUser(req.user.id)!) };
  });

  app.post("/api/me/photos", { bodyLimit: 3 * 1024 * 1024 }, async (req, reply) => {
    const body = z.object({ dataUrl: z.string() }).safeParse(req.body);
    const m = body.success && /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body.data.dataUrl);
    if (!m) return fail(reply, 400, "invalid_photo");
    const photos = JSON.parse(req.user.photos) as string[];
    if (photos.length >= MAX_PHOTOS) return fail(reply, 400, "too_many_photos");
    const file = `${randomUUID()}.jpg`;
    writeFileSync(join(config.uploadsDir, file), Buffer.from(m[1], "base64"));
    photos.push(`/uploads/${file}`);
    db.prepare("UPDATE users SET photos = ? WHERE id = ?").run(JSON.stringify(photos), req.user.id);
    return { photos };
  });

  app.delete<{ Params: { idx: string } }>("/api/me/photos/:idx", async (req) => {
    const photos = JSON.parse(req.user.photos) as string[];
    const [removed] = photos.splice(Number(req.params.idx), 1);
    if (removed) {
      try { unlinkSync(join(config.uploadsDir, removed.replace("/uploads/", ""))); } catch { /* уже удалён */ }
      db.prepare("UPDATE users SET photos = ? WHERE id = ?").run(JSON.stringify(photos), req.user.id);
    }
    return { photos };
  });

  app.get("/api/feed", async (req) => {
    const me = req.user;
    const t = now();
    const rows = db.prepare(
      `SELECT u.*,
         EXISTS (SELECT 1 FROM swipes s WHERE s.from_id = u.id AND s.to_id = :me AND s.kind = 'super') AS super_liked_me
       FROM users u
       WHERE u.id != :me AND u.onboarded = 1
         AND (:lf = 'any' OR u.gender = :lf)
         AND (u.looking_for = 'any' OR u.looking_for = :g)
         AND u.age BETWEEN :amin AND :amax
         AND u.id NOT IN (SELECT to_id FROM swipes WHERE from_id = :me)
       ORDER BY (u.boost_until > :t) DESC, super_liked_me DESC, u.last_active DESC
       LIMIT 20`,
    ).all({ me: me.id, lf: me.looking_for, g: me.gender, amin: me.age_min, amax: me.age_max, t }) as unknown as
      (UserRow & { super_liked_me: number })[];

    const myInterests = new Set((JSON.parse(me.interests) as string[]).map((s) => s.toLowerCase()));
    return {
      cards: rows.map((u) => {
        const p = publicProfile(u);
        return {
          ...p,
          superLikedMe: Boolean(u.super_liked_me),
          commonInterests: p.interests.filter((i) => myInterests.has(i.toLowerCase())),
        };
      }),
    };
  });

  app.post("/api/swipe", async (req, reply) => {
    const body = z.object({ targetId: z.number().int(), kind: z.enum(["like", "pass", "super"]) }).safeParse(req.body);
    if (!body.success) return fail(reply, 400, "invalid_swipe");
    const { targetId, kind } = body.data;
    const me = req.user;
    const target = getUser(targetId);
    if (!target || target.id === me.id) return fail(reply, 404, "not_found");

    if (kind !== "pass" && !isPremium(me) && likesToday(me.id) >= config.freeDailyLikes) {
      return fail(reply, 402, "likes_limit");
    }
    if (kind === "super") {
      const res = db.prepare("UPDATE users SET super_likes = super_likes - 1 WHERE id = ? AND super_likes > 0").run(me.id);
      if (res.changes === 0) return fail(reply, 402, "no_super_likes");
    }
    db.prepare("INSERT OR REPLACE INTO swipes (from_id, to_id, kind, created_at) VALUES (?, ?, ?, ?)")
      .run(me.id, targetId, kind, now());

    if (kind === "pass") return { match: null };
    const mutual = db
      .prepare("SELECT 1 FROM swipes WHERE from_id = ? AND to_id = ? AND kind != 'pass'")
      .get(targetId, me.id);
    if (!mutual) {
      if (kind === "super") void notify(targetId, "Кто-то поставил тебе суперлайк ⭐ Загляни в ленту!");
      return { match: null };
    }
    const [a, b] = pairKey(me.id, targetId);
    db.prepare("INSERT OR IGNORE INTO matches (user_a, user_b, created_at) VALUES (?, ?, ?)").run(a, b, now());
    const match = db.prepare("SELECT id FROM matches WHERE user_a = ? AND user_b = ?").get(a, b) as { id: number };
    void notify(targetId, `У тебя новый мэтч с ${me.name}! 💘`);
    return { match: { id: match.id, user: publicProfile(target) } };
  });

  app.get("/api/likes", async (req) => {
    const rows = db.prepare(
      `SELECT u.*, s.kind FROM swipes s JOIN users u ON u.id = s.from_id
       WHERE s.to_id = ? AND s.kind != 'pass'
         AND s.from_id NOT IN (SELECT to_id FROM swipes WHERE from_id = ?)
       ORDER BY s.created_at DESC LIMIT 50`,
    ).all(req.user.id, req.user.id) as unknown as (UserRow & { kind: string })[];
    const premium = isPremium(req.user);
    return {
      count: rows.length,
      // Без Premium видно только количество и размытые фото
      likes: premium
        ? rows.map((u) => ({ ...publicProfile(u), super: u.kind === "super" }))
        : rows.map((u) => ({ blurredPhoto: (JSON.parse(u.photos) as string[])[0] ?? null, super: u.kind === "super" })),
      locked: !premium,
    };
  });

  app.get("/api/matches", async (req) => {
    const rows = db.prepare(
      `SELECT m.id, m.created_at, CASE WHEN m.user_a = :me THEN m.user_b ELSE m.user_a END AS other_id,
         (SELECT text FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) AS last_text,
         (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) AS last_at
       FROM matches m WHERE m.user_a = :me OR m.user_b = :me
       ORDER BY COALESCE(last_at, m.created_at) DESC`,
    ).all({ me: req.user.id }) as { id: number; other_id: number; last_text: string | null; created_at: number }[];
    return {
      matches: rows.map((r) => ({ id: r.id, user: publicProfile(getUser(r.other_id)!), lastText: r.last_text })),
    };
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>("/api/matches/:id/messages", async (req, reply) => {
    const m = matchFor(Number(req.params.id), req.user.id);
    if (!m) return fail(reply, 404, "not_found");
    const messages = db
      .prepare("SELECT id, sender_id AS senderId, text, created_at AS createdAt FROM messages WHERE match_id = ? AND id > ? ORDER BY id LIMIT 200")
      .all(m.id, Number(req.query.after ?? 0));
    return { user: publicProfile(getUser(m.otherId)!), messages };
  });

  app.post<{ Params: { id: string } }>("/api/matches/:id/messages", async (req, reply) => {
    const m = matchFor(Number(req.params.id), req.user.id);
    const body = z.object({ text: z.string().trim().min(1).max(2000) }).safeParse(req.body);
    if (!m) return fail(reply, 404, "not_found");
    if (!body.success) return fail(reply, 400, "invalid_message");
    const res = db.prepare("INSERT INTO messages (match_id, sender_id, text, created_at) VALUES (?, ?, ?, ?)")
      .run(m.id, req.user.id, body.data.text, now());
    void notify(m.otherId, `${req.user.name}: ${body.data.text.slice(0, 100)}`);
    return { id: Number(res.lastInsertRowid) };
  });

  app.post("/api/ai/bio", async (req, reply) => {
    const body = z.object({ notes: z.string().max(1000).default("") }).safeParse(req.body ?? {});
    if (!body.success) return fail(reply, 400, "invalid_request");
    return aiCall(reply, async () => ({ bios: await generateBios(req.user, body.data.notes) }));
  });

  app.post("/api/ai/icebreakers", async (req, reply) => {
    const body = z.object({ matchId: z.number().int() }).safeParse(req.body);
    const m = body.success ? matchFor(body.data.matchId, req.user.id) : null;
    if (!m) return fail(reply, 404, "not_found");
    return aiCall(reply, async () => ({ openers: await generateIcebreakers(req.user, getUser(m.otherId)!) }));
  });

  app.post("/api/ai/compat", async (req, reply) => {
    const body = z.object({ targetId: z.number().int() }).safeParse(req.body);
    const target = body.success ? getUser(body.data.targetId) : undefined;
    if (!target || !target.onboarded) return fail(reply, 404, "not_found");
    return aiCall(reply, () => compatibility(req.user, target));
  });

  app.post<{ Params: { product: string } }>("/api/pay/:product", async (req, reply) => {
    if (!isProduct(req.params.product)) return fail(reply, 404, "unknown_product");
    if (!config.botToken) return fail(reply, 503, "payments_unavailable");
    return { link: await createInvoiceLink(req.user.id, req.params.product) };
  });
}

export type { FastifyRequest };
