import { db, getUser, now } from "./db.js";

const DAY = 24 * 60 * 60 * 1000;

/** Цены в Telegram Stars (валюта XTR). */
export const PRODUCTS = {
  premium_month: {
    title: "Premium на 30 дней",
    description: "Безлимит лайков, кто тебя лайкнул, 5 суперлайков и больше AI-подсказок",
    stars: 299,
  },
  super_likes_5: {
    title: "5 суперлайков",
    description: "Суперлайк поднимает тебя в начало ленты и показывает, что ты очень заинтересован",
    stars: 49,
  },
  boost_30m: {
    title: "Буст на 30 минут",
    description: "Твоя анкета показывается первой всем в ленте в течение 30 минут",
    stars: 99,
  },
} as const;

export type ProductId = keyof typeof PRODUCTS;

export function isProduct(id: string): id is ProductId {
  return Object.hasOwn(PRODUCTS, id);
}

export function makePayload(userId: number, product: ProductId) {
  return JSON.stringify({ u: userId, p: product });
}

export function parsePayload(payload: string): { userId: number; product: ProductId } | null {
  try {
    const { u, p } = JSON.parse(payload);
    return typeof u === "number" && isProduct(p) ? { userId: u, product: p } : null;
  } catch {
    return null;
  }
}

/** Начисляет покупку. Повторный вызов с тем же chargeId ничего не делает. */
export function applyPurchase(userId: number, product: ProductId, stars: number, chargeId: string) {
  const inserted = db
    .prepare(
      "INSERT OR IGNORE INTO payments (user_id, product, stars, charge_id, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(userId, product, stars, chargeId, now());
  if (inserted.changes === 0) return;

  const u = getUser(userId);
  if (!u) return;
  switch (product) {
    case "premium_month": {
      const from = Math.max(u.premium_until, now());
      db.prepare("UPDATE users SET premium_until = ?, super_likes = super_likes + 5 WHERE id = ?").run(
        from + 30 * DAY,
        userId,
      );
      break;
    }
    case "super_likes_5":
      db.prepare("UPDATE users SET super_likes = super_likes + 5 WHERE id = ?").run(userId);
      break;
    case "boost_30m": {
      const from = Math.max(u.boost_until, now());
      db.prepare("UPDATE users SET boost_until = ? WHERE id = ?").run(from + 30 * 60 * 1000, userId);
      break;
    }
  }
}
