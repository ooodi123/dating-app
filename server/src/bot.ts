import { join } from "node:path";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import { config } from "./config.js";
import { db, getUser } from "./db.js";
import { PRODUCTS, applyPurchase, makePayload, parsePayload, type ProductId } from "./payments.js";
import { parseRef, setReferrer } from "./referrals.js";
import { upsertUser } from "./auth.js";

export const bot = new Bot(config.botToken || "missing-token");

// Ошибка в одном обработчике не должна останавливать бота
bot.catch((err) => console.error(`Ошибка при обработке update ${err.ctx.update.update_id}:`, err.error));

// Без адреса мини-аппа кнопку не показываем: Telegram отклонит сообщение с пустой ссылкой
const openApp = (text = "Открыть приложение 💘") =>
  config.webAppUrl ? new InlineKeyboard().webApp(text, config.webAppUrl) : undefined;
const isAdmin = (id: number | undefined) => id !== undefined && config.adminIds.includes(id);

bot.command("start", async (ctx) => {
  // Приглашение через t.me/<bot>?start=ref_<id>
  const ref = parseRef(ctx.match);
  if (ref && ctx.from) {
    upsertUser({ id: ctx.from.id, first_name: ctx.from.first_name, username: ctx.from.username });
    setReferrer(ctx.from.id, ref);
  }
  await ctx.reply(
    "Привет! Здесь знакомятся по-настоящему 💘\n\n" +
      "Заполни анкету за минуту, а AI поможет написать «О себе», подскажет, насколько вы совпадаете, " +
      "и придумает первое сообщение после мэтча." +
      (ref ? "\n\nТебя пригласил друг — после заполнения анкеты вы оба получите суперлайки ⭐" : "") +
      (config.webAppUrl ? "" : "\n\nПриложение скоро откроется — мы заканчиваем настройку."),
    { reply_markup: openApp() },
  );
});

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

// ---------- Модерация через бота ----------

bot.callbackQuery(/^(ban|unban|verify_ok|verify_no):(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCallbackQuery({ text: "Нет доступа" });
  const [, action, idStr] = ctx.match;
  const id = Number(idStr);
  const user = getUser(id);
  if (!user) return ctx.answerCallbackQuery({ text: "Пользователь не найден" });

  let result = "";
  switch (action) {
    case "ban":
      db.prepare("UPDATE users SET banned = 1 WHERE id = ?").run(id);
      result = `🚫 ${user.name} заблокирован(а)`;
      break;
    case "unban":
      db.prepare("UPDATE users SET banned = 0 WHERE id = ?").run(id);
      result = `✅ ${user.name} снова виден(а) в ленте`;
      break;
    case "verify_ok":
      db.prepare("UPDATE users SET verify_status = 'verified' WHERE id = ?").run(id);
      void notify(id, "Профиль подтверждён ✅ Теперь у тебя есть галочка — такие анкеты лайкают чаще!");
      result = `✅ ${user.name} верифицирован(а)`;
      break;
    case "verify_no":
      db.prepare("UPDATE users SET verify_status = 'rejected' WHERE id = ?").run(id);
      void notify(id, "Не получилось подтвердить профиль: лицо на селфи должно совпадать с фото в анкете. Попробуй ещё раз.");
      result = `❌ Верификация ${user.name} отклонена`;
      break;
  }
  await ctx.answerCallbackQuery({ text: result });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
  await ctx.reply(result);
});

async function toAdmins(send: (adminId: number) => Promise<unknown>) {
  if (!config.botToken) return;
  await Promise.all(config.adminIds.map((id) => send(id).catch((e) => console.error("admin notify failed", e))));
}

export function reportToAdmins(targetId: number, text: string, autoBanned: boolean) {
  const kb = new InlineKeyboard().text("🚫 Забанить", `ban:${targetId}`).text("✅ Разбанить", `unban:${targetId}`);
  const photo = (JSON.parse(getUser(targetId)?.photos ?? "[]") as string[])[0];
  const caption = `${autoBanned ? "⚠️ Анкета скрыта автоматически\n" : ""}${text}`;
  return toAdmins((adminId) =>
    photo
      ? bot.api.sendPhoto(adminId, new InputFile(join(config.uploadsDir, photo.replace("/uploads/", ""))), { caption, reply_markup: kb })
      : bot.api.sendMessage(adminId, caption, { reply_markup: kb }),
  );
}

export function verificationToAdmins(userId: number, selfiePath: string, gesture: string) {
  const user = getUser(userId)!;
  const photo = (JSON.parse(user.photos) as string[])[0];
  const kb = new InlineKeyboard().text("✅ Подтвердить", `verify_ok:${userId}`).text("❌ Отклонить", `verify_no:${userId}`);
  return toAdmins(async (adminId) => {
    await bot.api.sendMediaGroup(adminId, [
      { type: "photo", media: new InputFile(selfiePath), caption: `Селфи. Жест: ${gesture}` },
      { type: "photo", media: new InputFile(join(config.uploadsDir, photo.replace("/uploads/", ""))), caption: "Фото из анкеты" },
    ]);
    await bot.api.sendMessage(adminId, `Верификация: ${user.name}, ${user.age} (id ${userId}). Это один человек?`, { reply_markup: kb });
  });
}

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

/** Ссылка-приглашение. Нужен запущенный бот, чтобы знать его username. */
export function inviteLink(userId: number) {
  if (!config.botToken) return null;
  try {
    return `https://t.me/${bot.botInfo.username}?start=ref_${userId}`;
  } catch {
    return null; // bot.init() ещё не завершился
  }
}
