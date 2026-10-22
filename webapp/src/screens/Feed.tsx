import { useEffect, useRef, useState } from "react";
import { api, ApiError, errorText, type Card, type MeResponse, type Profile } from "../api";
import { haptic } from "../tg";
import { Avatar } from "./Avatar";

interface Props {
  state: MeResponse;
  onChanged: () => void;
  onOpenChat: (matchId: number) => void;
  onPremium: () => void;
}

const SWIPE_THRESHOLD = 100;

export function Feed({ state, onChanged, onOpenChat, onPremium }: Props) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [match, setMatch] = useState<{ id: number; user: Profile } | null>(null);
  const [compat, setCompat] = useState<Record<number, { score: number; reason: string } | "loading">>({});
  const [notice, setNotice] = useState("");
  const [dx, setDx] = useState(0);
  const drag = useRef<number | null>(null);

  const load = () => api<{ cards: Card[] }>("/api/feed").then((r) => setCards(r.cards));
  useEffect(() => void load(), []);

  const card = cards?.[0];

  async function swipe(kind: "like" | "pass" | "super") {
    if (!card) return;
    setDx(0);
    try {
      const r = await api<{ match: { id: number; user: Profile } | null }>("/api/swipe", {
        method: "POST",
        body: { targetId: card.id, kind },
      });
      haptic(r.match ? "success" : "light");
      setCards((c) => c!.slice(1));
      if (r.match) setMatch(r.match);
      if (kind !== "pass") onChanged();
      if (cards!.length <= 1) void load();
    } catch (e) {
      if (e instanceof ApiError && (e.code === "likes_limit" || e.code === "no_super_likes")) {
        setNotice(e.code === "likes_limit" ? "Лайки на сегодня закончились" : "Суперлайки закончились");
        onPremium();
      } else setNotice(errorText(e));
    }
  }

  async function askCompat() {
    if (!card) return;
    setCompat((c) => ({ ...c, [card.id]: "loading" }));
    try {
      const r = await api<{ score: number; reason: string }>("/api/ai/compat", { method: "POST", body: { targetId: card.id } });
      setCompat((c) => ({ ...c, [card.id]: r }));
    } catch (e) {
      setCompat(({ [card.id]: _, ...rest }) => rest);
      setNotice(errorText(e));
    }
  }

  if (!cards) return <div className="center">Ищем людей рядом…</div>;

  const c = card && compat[card.id];

  return (
    <div className="feed">
      <div className="feed-head">
        <h2>Лента</h2>
        <span className="muted small">
          {state.limits.likesLeft === null ? "Premium ✨" : `Лайков сегодня: ${state.limits.likesLeft}`} · ⭐ {state.me.superLikes}
        </span>
      </div>
      {notice && <div className="notice" onClick={() => setNotice("")}>{notice}</div>}

      {!card ? (
        <div className="center empty">
          <p>Анкеты закончились 🙌</p>
          <p className="muted">Загляни позже или включи буст, чтобы тебя увидело больше людей.</p>
          <button className="btn" onClick={onPremium}>🚀 Буст</button>
        </div>
      ) : (
        <>
          <div
            className="card"
            style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)` }}
            onPointerDown={(e) => (drag.current = e.clientX)}
            onPointerMove={(e) => drag.current !== null && setDx(e.clientX - drag.current)}
            onPointerUp={() => {
              drag.current = null;
              if (dx > SWIPE_THRESHOLD) void swipe("like");
              else if (dx < -SWIPE_THRESHOLD) void swipe("pass");
              else setDx(0);
            }}
          >
            <Avatar user={card} className="card-photo" />
            {dx > 40 && <div className="stamp like">LIKE</div>}
            {dx < -40 && <div className="stamp nope">NOPE</div>}
            <div className="card-info">
              {card.superLikedMe && <div className="badge">⭐ Суперлайкнул(а) тебя</div>}
              <h3>
                {card.name}, {card.age} {card.premium && <span title="Premium">✨</span>}
              </h3>
              {card.city && <div className="muted">📍 {card.city}</div>}
              {card.bio && <p>{card.bio}</p>}
              <div className="chips">
                {card.interests.map((i) => (
                  <span key={i} className={card.commonInterests.includes(i) ? "chip common" : "chip"}>{i}</span>
                ))}
              </div>
              {state.limits.aiEnabled && (
                <div className="compat">
                  {c === undefined && <button className="link" onClick={askCompat}>✨ AI: насколько мы совпадаем?</button>}
                  {c === "loading" && <span className="muted">AI думает…</span>}
                  {c && c !== "loading" && (
                    <>
                      <b>Совместимость {c.score}%</b>
                      <p className="small">{c.reason}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="actions">
            <button className="round nope" onClick={() => swipe("pass")}>✕</button>
            <button className="round super" onClick={() => swipe("super")}>⭐</button>
            <button className="round like" onClick={() => swipe("like")}>♥</button>
          </div>
        </>
      )}

      {match && (
        <div className="modal" onClick={() => setMatch(null)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <h2>Это мэтч! 💘</h2>
            <Avatar user={match.user} className="big" />
            <p>Вы с {match.user.name} понравились друг другу.</p>
            <button className="btn" onClick={() => { onOpenChat(match.id); setMatch(null); }}>Написать</button>
            <button className="link" onClick={() => setMatch(null)}>Продолжить листать</button>
          </div>
        </div>
      )}
    </div>
  );
}
