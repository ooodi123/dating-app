import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type MeResponse } from "./api";
import { Feed } from "./screens/Feed";
import { Likes } from "./screens/Likes";
import { Matches } from "./screens/Matches";
import { Chat } from "./screens/Chat";
import { ProfileScreen } from "./screens/Profile";
import { Premium } from "./screens/Premium";

type Tab = "feed" | "likes" | "matches" | "profile";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "feed", icon: "🔥", label: "Лента" },
  { id: "likes", icon: "💛", label: "Лайки" },
  { id: "matches", icon: "💬", label: "Чаты" },
  { id: "profile", icon: "👤", label: "Профиль" },
];

export function App() {
  const [state, setState] = useState<MeResponse | null>(null);
  const [error, setError] = useState<"auth" | "banned" | null>(null);
  const [tab, setTab] = useState<Tab>("feed");
  const [chatId, setChatId] = useState<number | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);

  const reload = useCallback(() => api<MeResponse>("/api/me").then(setState).catch((e) => setError(e instanceof ApiError && e.code === "banned" ? "banned" : "auth")), []);
  useEffect(() => void reload(), [reload]);

  if (error === "banned") return <div className="center">Анкета заблокирована модераторами за нарушение правил. Если это ошибка, напиши боту /paysupport.</div>;
  if (error) return <div className="center">Не удалось войти. Открой приложение через бота в Telegram.</div>;
  if (!state) return <div className="center">Загрузка…</div>;

  if (!state.me.onboarded) {
    return (
      <div className="screen">
        <h1>Давай знакомиться 👋</h1>
        <p className="muted">Заполни анкету — это займёт минуту.</p>
        <ProfileScreen state={state} onSaved={reload} onboarding />
      </div>
    );
  }

  const openPremium = () => setPremiumOpen(true);

  return (
    <div className="app">
      <main className="screen">
        {chatId !== null ? (
          <Chat matchId={chatId} meId={state.me.id} aiEnabled={state.limits.aiEnabled} onBack={() => setChatId(null)} />
        ) : tab === "feed" ? (
          <Feed state={state} onChanged={reload} onOpenChat={setChatId} onPremium={openPremium} />
        ) : tab === "likes" ? (
          <Likes onPremium={openPremium} />
        ) : tab === "matches" ? (
          <Matches onOpen={setChatId} />
        ) : (
          <ProfileScreen state={state} onSaved={reload} onPremium={openPremium} />
        )}
      </main>
      {chatId === null && (
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
      {premiumOpen && <Premium state={state} onClose={() => setPremiumOpen(false)} onPurchased={reload} />}
    </div>
  );
}
