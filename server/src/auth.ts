import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { config } from "./config.js";
import { db, getUser, now, type UserRow } from "./db.js";
import { parseRef, setReferrer } from "./referrals.js";

const MAX_AGE_SEC = 24 * 60 * 60;

interface TgUser {
  id: number;
  first_name: string;
  username?: string;
}

/**
 * Проверка initData по алгоритму Telegram:
 * secret = HMAC_SHA256(key="WebAppData", botToken); hash = HMAC_SHA256(secret, data_check_string).
 */
export function validateInitData(initData: string): { user: TgUser; startParam: string | null } | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !config.botToken) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheck).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;

  const raw = params.get("user");
  return raw ? { user: JSON.parse(raw) as TgUser, startParam: params.get("start_param") } : null;
}

export function upsertUser(tg: TgUser, startParam?: string | null): UserRow {
  const t = now();
  db.prepare(
    `INSERT INTO users (id, username, name, created_at, last_active) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET username = excluded.username, last_active = excluded.last_active`,
  ).run(tg.id, tg.username ?? null, tg.first_name, t, t);
  // Приглашение через ссылку t.me/<bot>/<app>?startapp=ref_<id>
  if (startParam) setReferrer(tg.id, parseRef(startParam));
  return getUser(tg.id)!;
}

/** Достаёт пользователя из заголовка `Authorization: tma <initData>`. */
export function authenticate(req: FastifyRequest): UserRow | null {
  const header = req.headers.authorization ?? "";
  const [scheme, value = ""] = header.split(" ", 2);
  if (scheme === "tma") {
    const data = validateInitData(header.slice(4));
    return data ? upsertUser(data.user, data.startParam) : null;
  }
  if (scheme === "dev" && config.devAuth) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? upsertUser({ id, first_name: `Dev ${id}` }) : null;
  }
  return null;
}
