import "dotenv/config";

export const config = {
  botToken: process.env.BOT_TOKEN ?? "",
  webAppUrl: process.env.WEBAPP_URL ?? "",
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "data/app.db",
  uploadsDir: process.env.UPLOADS_DIR ?? "data/uploads",
  devAuth: process.env.DEV_AUTH === "1",
  aiModel: process.env.AI_MODEL ?? "claude-opus-5-5",
  aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
  // Лимиты бесплатного тарифа (Premium снимает их)
  freeDailyLikes: 30,
  freeDailyAi: 5,
  premiumDailyAi: 100,
};
