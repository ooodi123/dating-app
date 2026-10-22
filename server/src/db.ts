import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

mkdirSync(dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,           -- Telegram user id
  username TEXT,
  name TEXT NOT NULL DEFAULT '',
  age INTEGER,
  gender TEXT CHECK (gender IN ('m','f')),
  looking_for TEXT NOT NULL DEFAULT 'any' CHECK (looking_for IN ('m','f','any')),
  age_min INTEGER NOT NULL DEFAULT 18,
  age_max INTEGER NOT NULL DEFAULT 99,
  city TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '[]',
  photos TEXT NOT NULL DEFAULT '[]',
  onboarded INTEGER NOT NULL DEFAULT 0,
  premium_until INTEGER NOT NULL DEFAULT 0,
  super_likes INTEGER NOT NULL DEFAULT 1,
  boost_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS swipes (
  from_id INTEGER NOT NULL REFERENCES users(id),
  to_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('like','pass','super')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id)
);
CREATE INDEX IF NOT EXISTS swipes_to ON swipes(to_id, kind);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a INTEGER NOT NULL REFERENCES users(id),
  user_b INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_match ON messages(match_id, id);

CREATE TABLE IF NOT EXISTS compat (
  user_a INTEGER NOT NULL,
  user_b INTEGER NOT NULL,
  score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product TEXT NOT NULL,
  stars INTEGER NOT NULL,
  charge_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
`);

export interface UserRow {
  id: number;
  username: string | null;
  name: string;
  age: number | null;
  gender: "m" | "f" | null;
  looking_for: "m" | "f" | "any";
  age_min: number;
  age_max: number;
  city: string;
  bio: string;
  interests: string;
  photos: string;
  onboarded: number;
  premium_until: number;
  super_likes: number;
  boost_until: number;
  created_at: number;
  last_active: number;
}

export const now = () => Date.now();
export const today = () => new Date().toISOString().slice(0, 10);
export const startOfDay = () => new Date(new Date().setUTCHours(0, 0, 0, 0)).getTime();

export function getUser(id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function isPremium(u: UserRow) {
  return u.premium_until > now();
}

/** Публичная карточка: то, что видят другие пользователи. */
export function publicProfile(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    age: u.age,
    city: u.city,
    bio: u.bio,
    interests: JSON.parse(u.interests) as string[],
    photos: JSON.parse(u.photos) as string[],
    premium: isPremium(u),
  };
}

export function privateProfile(u: UserRow) {
  return {
    ...publicProfile(u),
    username: u.username,
    gender: u.gender,
    lookingFor: u.looking_for,
    ageMin: u.age_min,
    ageMax: u.age_max,
    onboarded: Boolean(u.onboarded),
    premiumUntil: u.premium_until,
    superLikes: u.super_likes,
    boostUntil: u.boost_until,
  };
}

export function pairKey(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}
