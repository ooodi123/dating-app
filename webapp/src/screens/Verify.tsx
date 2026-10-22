import { useEffect, useState } from "react";
import { api, errorText } from "../api";
import { haptic } from "../tg";
import { toJpeg } from "./image";

interface Props {
  status: "none" | "pending" | "verified" | "rejected";
  hasPhotos: boolean;
  onChanged: () => void;
}

export function Verify({ status, hasPhotos, onChanged }: Props) {
  const [gesture, setGesture] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "none" || status === "rejected") void api<{ gesture: string }>("/api/verify").then((r) => setGesture(r.gesture));
  }, [status]);

  if (status === "verified") return <section className="ai-box"><b>✅ Профиль подтверждён</b></section>;
  if (status === "pending") return <section className="ai-box"><b>⏳ Селфи на проверке</b><span className="small muted">Обычно это занимает несколько часов.</span></section>;

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await api<{ status: string }>("/api/verify", { method: "POST", body: { dataUrl: await toJpeg(file) } });
      haptic("success");
      setMessage(r.status === "verified" ? "Готово, профиль подтверждён ✅" : "Отправили на проверку ⏳");
      onChanged();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-box">
      <b>✅ Получи галочку</b>
      <span className="small">
        Подтверждённые анкеты показываются выше в ленте, и им больше доверяют.
        {status === "rejected" && " Прошлое селфи не подошло — попробуй ещё раз."}
      </span>
      {!hasPhotos ? (
        <span className="small muted">Сначала добавь хотя бы одно своё фото.</span>
      ) : (
        gesture && (
          <>
            <span>Сделай селфи, на котором ты <b>{gesture}</b></span>
            <label className={busy ? "btn small disabled" : "btn small"}>
              {busy ? "Проверяем…" : "📷 Сделать селфи"}
              <input type="file" accept="image/*" capture="user" hidden disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </>
        )
      )}
      {message && <span className="small">{message}</span>}
    </section>
  );
}
