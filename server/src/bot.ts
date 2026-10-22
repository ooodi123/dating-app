import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { PRODUCTS, applyPurchase, makePayload, parsePayload, type ProductId } from "./payments.js";

export const bot = new Bot(config.botToken || "missing-token");

const openApp = (text = "Открыть приложение 💘") => new InlineKeyboard().webApp(text, config.webAppUrl);

bot.command("start", (ctx) =>
  ctx.reply(
    "Привет! Здесь знакомятся по-настоящему 💘\n\n" +
      "Заполни анкету за минуту, а AI поможет написать «О себе», подскажет, насколько вы совпадаете, " +
      "и придумает первое сообщение после мэтча.",
    { reply_markup: openApp() },
  ),
);

// Telegram требует, чтобы бот с платежами в Stars отвечал на /paysupport и /terms
bot.command("paysupport", (ctx) =>
  ctx.reply("Проблема с оплатой? Опиши её одним сообщением, мы ответим в течение 24 часов. Возвраты Stars — по запросу."),
);
bot.command("terms", (ctx) =>
  ctx.reply("Покупки дают цифровые возможности в приложении. Пользуясь сервисом, ты подтверждаешь, что тебе 18+."),
);

bot.on("pre_checkout_query", async (ctx) => {
  const q = ctx.preCheckoutQuery;
  const parsed = parsePayload(q.invoice_payload);
  const ok = parsed !== null && parsed.userId === q.from.id && q.currency === "XTR" &&
    q.total_amount === PRODUCTS[parsed.product].stars;
  await ctx.answerPreCheckoutQuery(ok, ok ? undefined : { error_message: "Не удалось проверить покупку" });
});

bot.on("message:successful_payment", async (ctx) => {
  const p = ctx.message.successful_payment;
  const parsed = parsePayload(p.invoice_payload);
  if (!parsed) return;
  applyPurchase(parsed.userId, parsed.product, p.total_amount, p.telegram_payment_charge_id);
  await ctx.reply(`Готово! «${PRODUCTS[parsed.product].title}» активировано ✨`, { reply_markup: openApp() });
});

export function createInvoiceLink(userId: number, product: ProductId) {
  const p = PRODUCTS[product];
  // Для Stars provider_token — пустая строка
  return bot.api.createInvoiceLink(p.title, p.description, makePayload(userId, product), "", "XTR", [
    { label: p.title, amount: p.stars },
  ]);
}

/** Уведомление в чат с ботом; ошибки (бот заблокирован и т.п.) игнорируем. */
export async function notify(userId: number, text: string) {
  if (!config.botToken) return;
  try {
    await bot.api.sendMessage(userId, text, { reply_markup: openApp() });
  } catch {
    /* пользователь мог заблокировать бота */
  }
}
