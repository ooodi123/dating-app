// Демо-анкеты для локальной разработки: npm run seed
import { db, now } from "./db.js";

const people = [
  ["Алина", 24, "f", "Москва", "Люблю джаз, горы и хороший кофе. Ищу того, с кем можно сорваться в Питер на выходные.", ["джаз", "горы", "кофе", "путешествия"]],
  ["Марк", 27, "m", "Москва", "Пишу код днём, играю на гитаре вечером. Готовлю лучшую пасту в районе.", ["гитара", "кулинария", "IT", "путешествия"]],
  ["Соня", 22, "f", "Санкт-Петербург", "Студентка-архитектор, рисую скетчи в кафе. Зови на выставку!", ["архитектура", "рисование", "кофе", "выставки"]],
  ["Денис", 30, "m", "Москва", "Бегаю марафоны и читаю нон-фикшн. Ищу партнёра для забегов и разговоров до утра.", ["бег", "книги", "горы"]],
  ["Вика", 26, "f", "Казань", "Танцую бачату, обожаю собак и стендап.", ["танцы", "собаки", "стендап", "путешествия"]],
  ["Илья", 25, "m", "Санкт-Петербург", "Фотограф. Покажу тебе город, каким ты его не видела.", ["фотография", "выставки", "джаз"]],
] as const;

const t = now();
const insert = db.prepare(
  `INSERT OR REPLACE INTO users (id, name, age, gender, looking_for, city, bio, interests, photos, onboarded, created_at, last_active)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', 1, ?, ?)`,
);
people.forEach(([name, age, gender, city, bio, interests], i) => {
  insert.run(900000 + i, name, age, gender, gender === "m" ? "f" : "m", city, bio, JSON.stringify(interests), t, t - i * 60000);
});
// Пара демо-анкет уже лайкнула пользователя dev-1, чтобы сразу можно было получить мэтч
for (const from of [900000, 900002, 900004]) {
  db.prepare("INSERT OR IGNORE INTO users (id, name, created_at, last_active) VALUES (1, 'Dev 1', ?, ?)").run(t, t);
  db.prepare("INSERT OR IGNORE INTO swipes (from_id, to_id, kind, created_at) VALUES (?, 1, 'like', ?)").run(from, t);
}
console.log(`Добавлено ${people.length} демо-анкет`);
