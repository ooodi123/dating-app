import { existsSync } from "node:fs";
import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { bot } from "./bot.js";
import { config } from "./config.js";
import { routes } from "./routes.js";

const app = Fastify({ logger: true });

await app.register(fastifyStatic, { root: resolve(config.uploadsDir), prefix: "/uploads/" });

// В продакшене сервер отдаёт и собранный мини-апп
const webappDist = resolve("../webapp/dist");
if (existsSync(webappDist)) {
  await app.register(fastifyStatic, { root: webappDist, prefix: "/", decorateReply: false });
}

await app.register(routes);
await app.listen({ port: config.port, host: "0.0.0.0" });

if (config.botToken) {
  await bot.init();
  void bot.start({ onStart: (me) => app.log.info(`Bot @${me.username} started`) });
} else {
  app.log.warn("BOT_TOKEN не задан: бот и оплата отключены");
}
