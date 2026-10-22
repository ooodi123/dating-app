import { useEffect, useRef, useState } from "react";
import { api, errorText, type Message, type Profile } from "../api";
import { Avatar } from "./Avatar";
import { ReportSheet } from "./ReportSheet";

interface Props {
  matchId: number;
  meId: number;
  aiEnabled: boolean;
  onBack: () => void;
}

const POLL_MS = 3000;

/** Добавляет новые сообщения без дублей (поллинг и отправка могут вернуть одно и то же). */
function merge(list: Message[], incoming: Message[]) {
  const seen = new Set(list.map((m) => m.id));
  return [...list, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id);
}

export function Chat({ matchId, meId, aiEnabled, onBack }: Props) {
  const [user, setUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [openers, setOpeners] = useState<string[] | "loading" | null>(null);
  const [notice, setNotice] = useState("");
  const [reporting, setReporting] = useState(false);
  const lastId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const r = await api<{ user: Profile; messages: Message[] }>(`/api/matches/${matchId}/messages?after=${lastId.current}`);
      if (!alive) return;
      setUser(r.user);
      if (r.messages.length) {
        lastId.current = r.messages[r.messages.length - 1].id;
        setMessages((m) => merge(m, r.messages));
      }
    };
    void poll();
    const timer = setInterval(() => void poll().catch(() => {}), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [matchId]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages.length]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    let id: number;
    try {
      ({ id } = await api<{ id: number }>(`/api/matches/${matchId}/messages`, { method: "POST", body: { text: t } }));
    } catch (e) {
      setText(t);
      setNotice(errorText(e));
      return;
    }
    lastId.current = Math.max(lastId.current, id);
    setMessages((m) => merge(m, [{ id, senderId: meId, text: t, createdAt: Date.now() }]));
  }

  async function suggest() {
    setOpeners("loading");
    try {
      const r = await api<{ openers: string[] }>("/api/ai/icebreakers", { method: "POST", body: { matchId } });
      setOpeners(r.openers);
    } catch (e) {
      setOpeners(null);
      setNotice(errorText(e));
    }
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <button className="link" onClick={onBack}>← Назад</button>
        {user && (
          <>
            <Avatar user={user} className="small" />
            <b>{user.name} {user.verified && <span className="verified">✓</span>}</b>
            <button className="link push-right" onClick={() => setReporting(true)}>⋯</button>
          </>
        )}
      </div>
      <div className="chat-body">
        {messages.length === 0 && <p className="muted center">Начните разговор! Не знаешь, с чего начать? Спроси AI ✨</p>}
        {messages.map((m) => (
          <div key={m.id} className={m.senderId === meId ? "bubble mine" : "bubble"}>{m.text}</div>
        ))}
        <div ref={bottom} />
      </div>
      {notice && <div className="notice" onClick={() => setNotice("")}>{notice}</div>}
      {Array.isArray(openers) && (
        <div className="openers">
          {openers.map((o) => (
            <button key={o} className="chip" onClick={() => { setText(o); setOpeners(null); }}>{o}</button>
          ))}
        </div>
      )}
      {reporting && user && (
        <ReportSheet targetId={user.id} name={user.name} onClose={() => setReporting(false)} onDone={onBack} />
      )}
      <div className="composer">
        {aiEnabled && (
          <button className="round small" title="AI-подсказка" onClick={suggest} disabled={openers === "loading"}>
            {openers === "loading" ? "…" : "✨"}
          </button>
        )}
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение" />
        <button className="btn" onClick={send}>➤</button>
      </div>
    </div>
  );
}
