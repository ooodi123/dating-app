import { useState } from "react";
import { api, errorText } from "../api";
import { haptic } from "../tg";

const REASONS: [string, string][] = [
  ["fake", "Фейк / чужие фото"],
  ["scam", "Мошенничество / просит деньги"],
  ["offensive", "Оскорбления"],
  ["underage", "Младше 18"],
  ["spam", "Спам / реклама"],
  ["other", "Другое"],
];

interface Props {
  targetId: number;
  name: string;
  onClose: () => void;
  /** Вызывается после блокировки или жалобы: человек исчезает из ленты и чатов. */
  onDone: () => void;
}

export function ReportSheet({ targetId, name, onClose, onDone }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");

  async function submit(path: "/api/block" | "/api/report") {
    try {
      await api(path, { method: "POST", body: path === "/api/block" ? { targetId } : { targetId, reason, comment } });
      haptic("success");
      onDone();
    } catch (e) {
      setStatus(errorText(e));
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <h2>{name}</h2>
        <button className="product" onClick={() => submit("/api/block")}>
          <span className="product-icon">🚫</span>
          <span className="product-text"><b>Заблокировать</b><span className="small muted">Вы больше не увидите друг друга</span></span>
        </button>
        <p className="muted small">Или пожалуйся — модераторы проверят анкету:</p>
        <div className="chips">
          {REASONS.map(([id, label]) => (
            <button key={id} className={reason === id ? "chip common" : "chip"} onClick={() => setReason(id)}>{label}</button>
          ))}
        </div>
        {reason && (
          <>
            <textarea placeholder="Что случилось? (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} style={{ marginTop: 10 }} />
            <button className="btn wide" onClick={() => submit("/api/report")}>Отправить жалобу</button>
          </>
        )}
        {status && <p>{status}</p>}
        <button className="link" onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}
