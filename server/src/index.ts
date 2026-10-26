import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { bot } from "./bot.js";
import { config } from "./config.js";
import { routes } from "./routes.js";

const app = Fastify({ logger: true });

await app.register(fastifyStatic, { root: resolve(config.uploadsDir), prefix: "/uploads/" });

// В продакшене сервер отдаёт и собранный мини-апп (путь от файла, а не от рабочей папки:
// и src/index.ts, и dist/index.js лежат на два уровня ниже корня репозитория)
const webappDist = resolve(dirname(fileURLToPath(import.meta.url)), "../../webapp/dist");
const hasWebapp = existsSync(join(webappDist, "index.html"));

app.get("/health", async () => ({
  ok: true,
  webapp: hasWebapp,
  bot: Boolean(config.botToken),
  webAppUrl: config.webAppUrl || null,
  ai: config.aiEnabled ? `${config.ai.provider}/${config.aiModel}` : null,
}));

if (hasWebapp) {
  await app.register(fastifyStatic, { root: webappDist, prefix: "/", decorateReply: false });
} else {
  app.log.error(`Мини-апп не собран (нет ${webappDist}/index.html): главная страница будет отдавать 404`);
}

await app.register(routes);
await app.listen({ port: config.port, host: "0.0.0.0" });

if (config.botToken) {
  await bot.init();
  if (config.webAppUrl) {
    // Кнопка «Открыть» рядом с полем ввода в чате с ботом
    await bot.api
      .setChatMenuButton({ menu_button: { type: "web_app", text: "Открыть", web_app: { url: config.webAppUrl } } })
      .catch((e) => app.log.warn(e, "Не удалось установить кнопку меню"));
  } else {
    app.log.warn("WEBAPP_URL/DOMAIN не задан: кнопки открытия мини-аппа не будут работать");
  }
  void bot.start({ onStart: (me) => app.log.info(`Bot @${me.username} started`) });
} else {
  app.log.warn("BOT_TOKEN не задан: бот и оплата отключены");
}
