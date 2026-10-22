import { useState } from "react";
import { api, errorText, type MeResponse } from "../api";
import { haptic, tg } from "../tg";

interface Props {
  state: MeResponse;
  onClose: () => void;
  onPurchased: () => void;
}

const ICONS: Record<string, string> = { premium_month: "✨", super_likes_5: "⭐", boost_30m: "🚀" };

export function Premium({ state, onClose, onPurchased }: Props) {
  const [status, setStatus] = useState("");

  async function buy(product: string) {
    try {
      const { link } = await api<{ link: string }>(`/api/pay/${product}`, { method: "POST" });
      if (!tg) return void window.open(link, "_blank");
      tg.openInvoice(link, (s) => {
        if (s === "paid") {
          haptic("success");
          setStatus("Оплата прошла, спасибо! ✨");
          // Начисление приходит через бота, даём ему секунду
          setTimeout(onPurchased, 1500);
        } else if (s === "failed") setStatus("Оплата не прошла");
      });
    } catch (e) {
      setStatus(errorText(e));
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <h2>Больше мэтчей ✨</h2>
        {Object.entries(state.products).map(([id, p]) => (
          <button key={id} className="product" onClick={() => buy(id)}>
            <span className="product-icon">{ICONS[id]}</span>
            <span className="product-text">
              <b>{p.title}</b>
              <span className="small muted">{p.description}</span>
            </span>
            <span className="price">{p.stars} ⭐</span>
          </button>
        ))}
        {status && <p>{status}</p>}
        <button className="link" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
