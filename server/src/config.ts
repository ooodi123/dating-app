import "dotenv/config";

export const config = {
  botToken: process.env.BOT_TOKEN ?? "",
  webAppUrl: process.env.WEBAPP_URL ?? "",
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "data/app.db",
  uploadsDir: process.env.UPLOADS_DIR ?? "data/uploads",
  // Telegram id модераторов через запятую: им приходят жалобы и заявки на верификацию
  adminIds: (process.env.ADMIN_IDS ?? "").split(",").map(Number).filter((n) => Number.isSafeInteger(n) && n > 0),
  selfiesDir: process.env.SELFIES_DIR ?? "data/selfies",
  devAuth: process.env.DEV_AUTH === "1",
  aiModel: process.env.AI_MODEL ?? "claude-opus-5-5",
  aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
  // Лимиты бесплатного тарифа (Premium снимает их)
  freeDailyLikes: 30,
  freeDailyAi: 5,
  premiumDailyAi: 100,
  // Рефералы: бонус обоим за друга, Premium за каждых N друзей
  referralSuperLikes: 3,
  referralPremiumEvery: 5,
  referralPremiumDays: 7,
  // Сколько разных жалоб скрывают анкету до решения модератора
  autoBanReports: 3,
};
