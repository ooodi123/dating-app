interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  openTelegramLink(url: string): void;
  openInvoice(url: string, cb?: (status: "paid" | "cancelled" | "failed" | "pending") => void): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    notificationOccurred(type: "success" | "error" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export const tg = window.Telegram?.WebApp;
export const insideTelegram = Boolean(tg?.initData);

export function haptic(kind: "light" | "success" | "error" = "light") {
  if (kind === "light") tg?.HapticFeedback?.impactOccurred("light");
  else tg?.HapticFeedback?.notificationOccurred(kind);
}
