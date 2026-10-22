import "dotenv/config";
import { join } from "node:path";

const env = process.env;
// Хостинги (например, Bothost) передают адрес приложения как DOMAIN без схемы
const domainUrl = env.DOMAIN ? (env.DOMAIN.startsWith("http") ? env.DOMAIN : `https://${env.DOMAIN}`) : "";
// Папка для базы и файлов. На хостинге её стоит направить на постоянный диск (volume)
const dataDir = env.DATA_DIR ?? "data";

export const config = {
  botToken: env.BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN ?? env.API_TOKEN ?? "",
  webAppUrl: env.WEBAPP_URL ?? domainUrl,
  port: Number(env.PORT ?? 3000),
  dbPath: env.DB_PATH ?? join(dataDir, "app.db"),
  uploadsDir: env.UPLOADS_DIR ?? join(dataDir, "uploads"),
  // Telegram id модераторов через запятую: им приходят жалобы и заявки на верификацию
  adminIds: (process.env.ADMIN_IDS ?? "").split(",").map(Number).filter((n) => Number.isSafeInteger(n) && n > 0),
  selfiesDir: env.SELFIES_DIR ?? join(dataDir, "selfies"),
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
