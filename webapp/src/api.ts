import { insideTelegram, tg } from "./tg";

export interface Profile {
  id: number;
  name: string;
  age: number | null;
  city: string;
  bio: string;
  interests: string[];
  photos: string[];
  premium: boolean;
  verified: boolean;
}

export interface Me extends Profile {
  gender: "m" | "f" | null;
  lookingFor: "m" | "f" | "any";
  ageMin: number;
  ageMax: number;
  onboarded: boolean;
  premiumUntil: number;
  superLikes: number;
  boostUntil: number;
  verifyStatus: "none" | "pending" | "verified" | "rejected";
}

export interface Card extends Profile {
  superLikedMe: boolean;
  commonInterests: string[];
}

export interface Product {
  title: string;
  description: string;
  stars: number;
}

export interface MeResponse {
  me: Me;
  limits: { likesLeft: number | null; aiEnabled: boolean; verifyEnabled: boolean };
  products: Record<string, Product>;
  invite: { link: string | null; friends: number; superLikesBonus: number; premiumEvery: number; premiumDays: number };
}

export interface Message {
  id: number;
  senderId: number;
  text: string;
  createdAt: number;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public reason?: string) {
    super(code);
  }
}

// Вне Telegram (локальная разработка) входим как ?dev=<id>, сервер должен быть запущен с DEV_AUTH=1
const devId = new URLSearchParams(location.search).get("dev") ?? "1";
const authHeader = insideTelegram ? `tma ${tg!.initData}` : `dev ${devId}`;

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: authHeader,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "unknown", data.reason);
  return data as T;
}

export const AI_ERRORS: Record<string, string> = {
  ai_limit: "На сегодня AI-подсказки закончились. В Premium их намного больше ✨",
  ai_unavailable: "AI сейчас недоступен, попробуй чуть позже",
};

export function errorText(e: unknown) {
  if (e instanceof ApiError) {
    if (e.code === "moderation") return `Не прошло модерацию: ${e.reason || "нарушение правил"}`;
    if (e.code === "selfie_rejected") return `Селфи не подошло: ${e.reason || "попробуй ещё раз"}`;
    return AI_ERRORS[e.code] ?? `Ошибка: ${e.code}`;
  }
  return "Что-то пошло не так";
}
