import { useEffect, useState } from "react";
import { api, type Profile } from "../api";
import { Avatar } from "./Avatar";

type Like = (Profile & { super: boolean }) | { blurredPhoto: string | null; super: boolean };

export function Likes({ onPremium }: { onPremium: () => void }) {
  const [data, setData] = useState<{ count: number; likes: Like[]; locked: boolean } | null>(null);
  useEffect(() => void api<typeof data>("/api/likes").then(setData), []);

  if (!data) return <div className="center">Загрузка…</div>;
  if (data.count === 0) return <div className="center muted">Пока никто не лайкнул. Заполни анкету ярче — помогут фото и AI-описание ✨</div>;

  return (
    <div>
      <h2>Тебя лайкнули: {data.count}</h2>
      {data.locked && (
        <div className="upsell" onClick={onPremium}>
          Узнай, кто это, с Premium ✨ <button className="btn small">Открыть</button>
        </div>
      )}
      <div className="grid">
        {data.likes.map((l, i) =>
          "id" in l ? (
            <div key={l.id} className="tile">
              <Avatar user={l} />
              <div className="tile-name">{l.super && "⭐ "}{l.name}, {l.age} {l.verified && "✓"}</div>
            </div>
          ) : (
            <div key={i} className="tile locked" onClick={onPremium}>
              {l.blurredPhoto ? <img className="avatar blur" src={l.blurredPhoto} alt="" /> : <div className="avatar placeholder blur">?</div>}
              <div className="tile-name">{l.super ? "⭐ Суперлайк" : "💛"}</div>
            </div>
          ),
        )}
      </div>
      <p className="muted small">Лайкни их в ленте в ответ, чтобы получился мэтч.</p>
    </div>
  );
}
