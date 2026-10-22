import { useEffect, useState } from "react";
import { api, type Profile } from "../api";
import { Avatar } from "./Avatar";

interface MatchItem {
  id: number;
  user: Profile;
  lastText: string | null;
}

export function Matches({ onOpen }: { onOpen: (id: number) => void }) {
  const [matches, setMatches] = useState<MatchItem[] | null>(null);
  useEffect(() => void api<{ matches: MatchItem[] }>("/api/matches").then((r) => setMatches(r.matches)), []);

  if (!matches) return <div className="center">Загрузка…</div>;
  if (!matches.length) return <div className="center muted">Мэтчей пока нет. Листай ленту — всё впереди 💫</div>;

  return (
    <div>
      <h2>Чаты</h2>
      {matches.map((m) => (
        <button key={m.id} className="row" onClick={() => onOpen(m.id)}>
          <Avatar user={m.user} className="small" />
          <div className="row-text">
            <b>{m.user.name}</b>
            <span className="muted small">{m.lastText ?? "Новый мэтч — напиши первым(ой)!"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
