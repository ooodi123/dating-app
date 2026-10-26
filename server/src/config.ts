import "dotenv/config";
import { join } from "node:path";

const env = process.env;
// Хостинги (например, Bothost) передают адрес приложения как DOMAIN без схемы
const domainUrl = env.DOMAIN ? (env.DOMAIN.startsWith("http") ? env.DOMAIN : `https://${env.DOMAIN}`) : "";
// Папка для базы и файлов. На хостинге её стоит направить на постоянный диск (volume)
const dataDir = env.DATA_DIR || "data";

// AI-провайдер. Claude — по ключу ANTHROPIC_API_KEY. Бесплатные варианты работают через
// OpenAI-совместимый API: Gemini (Google AI Studio), OpenRouter (модели с пометкой :free), Groq.
const AI_PRESETS = {
  anthropic: { baseUrl: "", model: "claude-opus-5-5" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-flash-latest" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "google/gemma-4-31b-it:free" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  custom: { baseUrl: "", model: "" },
} as const;
export type AiProvider = keyof typeof AI_PRESETS | "none";

function resolveAi() {
  const key = env.AI_API_KEY || env.GEMINI_API_KEY || env.OPENROUTER_API_KEY || env.GROQ_API_KEY || "";
  const guessed: AiProvider = env.ANTHROPIC_API_KEY ? "anthropic"
    : env.GEMINI_API_KEY ? "gemini"
    : env.OPENROUTER_API_KEY ? "openrouter"
    : env.GROQ_API_KEY ? "groq"
    : env.AI_API_KEY ? "gemini"
    : "none";
  const requested = (env.AI_PROVIDER || guessed).toLowerCase();
  if (requested === "none") return { provider: "none" as AiProvider, baseUrl: "", apiKey: "", model: "" };
  if (!(requested in AI_PRESETS)) throw new Error(`Неизвестный AI_PROVIDER: ${requested}`);
  const provider = requested as keyof typeof AI_PRESETS;
  const preset = AI_PRESETS[provider];
  const apiKey = provider === "anthropic" ? env.ANTHROPIC_API_KEY || "" : key;
  const baseUrl = (env.AI_BASE_URL || preset.baseUrl).replace(/\/$/, "");
  const model = env.AI_MODEL || preset.model;
  // Без ключа (или без адреса/модели для custom) AI считаем выключенным
  const ready = Boolean(apiKey) && (provider === "anthropic" || Boolean(baseUrl && model));
  return { provider: ready ? provider : ("none" as AiProvider), baseUrl, apiKey, model };
}
const ai = resolveAi();

export const config = {
  botToken: env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN || env.API_TOKEN || "",
  webAppUrl: env.WEBAPP_URL || domainUrl,
  port: Number(env.PORT || 3000),
  dbPath: env.DB_PATH || join(dataDir, "app.db"),
  uploadsDir: env.UPLOADS_DIR || join(dataDir, "uploads"),
  // Telegram id модераторов через запятую: им приходят жалобы и заявки на верификацию
  adminIds: (process.env.ADMIN_IDS || "").split(",").map(Number).filter((n) => Number.isSafeInteger(n) && n > 0),
  selfiesDir: env.SELFIES_DIR || join(dataDir, "selfies"),
  devAuth: process.env.DEV_AUTH === "1",
  ai,
  aiModel: ai.model,
  aiEnabled: ai.provider !== "none",
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
