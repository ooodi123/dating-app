# Дейтинг Mini App для Telegram

Мини-апп знакомств внутри Telegram с AI-фичами и оплатой в Telegram Stars.
Продуктовый план и этапы — в [docs/PLAN.md](docs/PLAN.md).

```
server/   Node.js + TypeScript: Fastify API, бот на grammY, SQLite (node:sqlite), Claude API
webapp/   React + Vite: сам мини-апп (лента, лайки, чаты, профиль, покупки)
```

## Быстрый старт локально (без Telegram)

Нужен Node.js 22+.

```bash
cd server && npm install && cp .env.example .env
# в .env поставьте DEV_AUTH=1 (и ANTHROPIC_API_KEY, если хотите проверить AI)
npm run seed      # 6 демо-анкет, трое уже лайкнули пользователя с id 1
npm run dev       # API на :3000

cd ../webapp && npm install && npm run dev   # http://localhost:5173/?dev=1
```

`?dev=<id>` — вход под любым тестовым пользователем. В продакшене `DEV_AUTH` должен быть `0`.

## Запуск в Telegram

1. Создайте бота у [@BotFather](https://t.me/BotFather) и положите токен в `BOT_TOKEN` (только в `.env`
   или секреты хостинга — не в код и не в чат).
2. Задеплойте на сервер с HTTPS: `cd webapp && npm run build`, затем `cd server && npm run build && npm start`.
   Сервер отдаёт и API, и собранный мини-апп. Укажите этот адрес в `WEBAPP_URL`.
3. В @BotFather: `/newapp` (или Menu Button) → тот же URL.
4. Для AI добавьте `ANTHROPIC_API_KEY`. Модель задаётся `AI_MODEL` (по умолчанию `claude-opus-5-5`;
   для экономии на большом трафике можно поставить `claude-haiku-5-5`).

Оплата Stars не требует платёжного провайдера: бот создаёт invoice link с валютой `XTR`, мини-апп открывает
его через `Telegram.WebApp.openInvoice`, а начисление происходит по `successful_payment` в боте.

## Безопасность
- Каждый запрос подписан `initData` Telegram; сервер проверяет HMAC и срок (24 ч).
- Тексты анкет передаются в AI как данные, а не инструкции; ответы строго по JSON-схеме.
- Повторный `successful_payment` с тем же `charge_id` не начисляет покупку второй раз.
