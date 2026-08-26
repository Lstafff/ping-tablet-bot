const TELEGRAM_SDK_URL = "https://telegram.org/js/telegram-web-app.js";
const TELEGRAM_LAUNCH_KEYS = ["tgWebAppData", "tgWebAppVersion", "tgWebAppPlatform", "tgWebAppThemeParams"] as const;

export function isTelegramLaunch(search: string, hash: string, hasRuntime = false): boolean {
  if (hasRuntime) return true;
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return TELEGRAM_LAUNCH_KEYS.some((key) => query.has(key) || fragment.has(key));
}

export async function ensureTelegramSdk(): Promise<void> {
  const telegramWindow = window as Window & { Telegram?: { WebApp?: unknown } };
  if (!isTelegramLaunch(window.location.search, window.location.hash, Boolean(telegramWindow.Telegram?.WebApp))) return;
  if (telegramWindow.Telegram?.WebApp) return;

  await new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = TELEGRAM_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.append(script);
  });
}
