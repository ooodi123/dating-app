import { config } from "./config.js";
import { db, getUser, now } from "./db.js";

const DAY = 24 * 60 * 60 * 1000;

/** Разбирает параметр приглашения вида ref_<id>. */
export function parseRef(param: string | undefined | null): number | null {
  const m = /^ref_(\d{1,15})$/.exec(param ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * Запоминает, кто пригласил пользователя. Срабатывает только для новых пользователей,
 * которые ещё не заполнили анкету, и только один раз.
 */
export function setReferrer(userId: number, referrerId: number | null) {
  if (!referrerId || referrerId === userId || !getUser(referrerId)) return;
  db.prepare("UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL AND onboarded = 0").run(
    referrerId,
    userId,
  );
}

/**
 * Награда после того, как приглашённый заполнил анкету: суперлайки обоим,
 * а пригласившему ещё и Premium за каждых N друзей. Возвращает текст для уведомления пригласившего.
 */
export function rewardReferral(userId: number): { referrerId: number; text: string } | null {
  const claimed = db
    .prepare("UPDATE users SET referral_rewarded = 1 WHERE id = ? AND referred_by IS NOT NULL AND referral_rewarded = 0")
    .run(userId);
  if (claimed.changes === 0) return null;

  const user = getUser(userId)!;
  const referrer = getUser(user.referred_by!);
  if (!referrer) return null;

  const bonus = config.referralSuperLikes;
  db.prepare("UPDATE users SET super_likes = super_likes + ? WHERE id IN (?, ?)").run(bonus, userId, referrer.id);

  const friends = referralCount(referrer.id);
  let text = `${user.name} присоединился(ась) по твоей ссылке! +${bonus} суперлайка ⭐`;
  if (friends % config.referralPremiumEvery === 0) {
    const from = Math.max(referrer.premium_until, now());
    db.prepare("UPDATE users SET premium_until = ? WHERE id = ?").run(from + config.referralPremiumDays * DAY, referrer.id);
    text += `\nЭто уже ${friends} друзей — дарим Premium на ${config.referralPremiumDays} дней ✨`;
  }
  return { referrerId: referrer.id, text };
}

export function referralCount(userId: number) {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE referred_by = ? AND referral_rewarded = 1").get(userId) as {
      n: number;
    }
  ).n;
}
