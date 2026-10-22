import { useState } from "react";
import type { MeResponse } from "../api";
import { tg } from "../tg";

export function Invite({ invite }: { invite: MeResponse["invite"] }) {
  const [copied, setCopied] = useState(false);
  if (!invite.link) return null;
  const link = invite.link;
  const toNextPremium = invite.premiumEvery - (invite.friends % invite.premiumEvery);

  function share() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Знакомлюсь тут, присоединяйся 💘")}`;
    if (tg) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  }

  async function copy() {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
  }

  return (
    <section className="ai-box">
      <b>🎁 Пригласи друзей</b>
      <span className="small">
        За каждого друга, который заполнит анкету, вы оба получите +{invite.superLikesBonus} суперлайка ⭐.
        Каждые {invite.premiumEvery} друзей — Premium на {invite.premiumDays} дней.
      </span>
      <span className="small muted">
        Приглашено: {invite.friends}. До Premium: {toNextPremium}.
      </span>
      <div className="pair">
        <button className="btn small" onClick={share}>Поделиться</button>
        <button className="btn small secondary" onClick={copy}>{copied ? "Скопировано ✓" : "Копировать ссылку"}</button>
      </div>
    </section>
  );
}
