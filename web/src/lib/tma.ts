// @ts-ignore The Deslop kit is JavaScript and supplies a browser-safe Telegram fallback.
import WebApp from "../../mini-app/lib/twa/webApp";
// @ts-ignore Keep the adapter independent from optional router components in the kit.
import { isTelegram } from "../../mini-app/lib/twa/env";

type HapticNotification = "error" | "success" | "warning";
type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";

type TelegramRuntime = {
  initData?: string;
  initDataUnsafe?: { start_param?: string };
  themeParams?: Record<string, string | undefined>;
  colorScheme?: "light" | "dark";
  isFullscreen?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: { top?: number; right?: number; bottom?: number; left?: number };
  contentSafeAreaInset?: { top?: number; right?: number; bottom?: number; left?: number };
  BackButton: { show(): void; hide(): void; onClick(callback: () => void): void; offClick(callback: () => void): void };
  HapticFeedback?: { selectionChanged(): void; impactOccurred(style: HapticImpact): void; notificationOccurred(type: HapticNotification): void };
  ready(): void;
  expand(): void;
  requestFullscreen?(): void;
  setHeaderColor?(color: string): void;
  isVersionAtLeast?(version: string): boolean;
  onEvent(event: string, callback: () => void): void;
  offEvent(event: string, callback: () => void): void;
  openTelegramLink?(url: string): void;
};

const runtime = WebApp as TelegramRuntime;
const supports = (version: string) => !runtime.isVersionAtLeast || runtime.isVersionAtLeast(version);

const cssNumber = (value: number | undefined) => `${Math.max(0, value ?? 0)}px`;

function startParamFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("tgWebAppStartParam") ?? params.get("startapp") ?? "";
}

function applyAppearance(): void {
  const root = document.documentElement;
  const contentInset = runtime.contentSafeAreaInset ?? runtime.safeAreaInset ?? {};
  root.dataset.tmaScheme = runtime.colorScheme ?? "light";
  root.style.setProperty("--tma-safe-top", cssNumber(contentInset.top));
  root.style.setProperty("--tma-safe-right", cssNumber(contentInset.right));
  root.style.setProperty("--tma-safe-bottom", cssNumber(contentInset.bottom));
  root.style.setProperty("--tma-safe-left", cssNumber(contentInset.left));
  root.style.setProperty("--tma-viewport-height", cssNumber(runtime.viewportStableHeight || runtime.viewportHeight || window.innerHeight));
  const theme = runtime.themeParams ?? {};
  if (theme.bg_color) root.style.setProperty("--tma-background", theme.bg_color);
  if (theme.text_color) root.style.setProperty("--tma-text", theme.text_color);
  if (theme.hint_color) root.style.setProperty("--tma-muted", theme.hint_color);
  if (theme.button_color) root.style.setProperty("--tma-accent", theme.button_color);
  if (supports("6.1")) runtime.setHeaderColor?.(theme.bg_color ?? "#ffffff");
}

export const tma = {
  isTelegram: (): boolean => isTelegram(),
  isLocalPreview: (): boolean => import.meta.env.DEV && !isTelegram(),
  initData: (): string => runtime.initData ?? "",
  startParam: (): string => runtime.initDataUnsafe?.start_param ?? startParamFromUrl(),
  openTelegramLink: (url: string): boolean => {
    if (!runtime.openTelegramLink) return false;
    runtime.openTelegramLink(url);
    return true;
  },
  haptic: {
    selection: (): void => { if (supports("6.1")) runtime.HapticFeedback?.selectionChanged(); },
    impact: (style: HapticImpact = "light"): void => { if (supports("6.1")) runtime.HapticFeedback?.impactOccurred(style); },
    notification: (type: HapticNotification): void => { if (supports("6.1")) runtime.HapticFeedback?.notificationOccurred(type); },
  },
  prepare: (): (() => void) => {
    runtime.ready();
    runtime.expand();
    if (supports("8.0")) {
      try {
        runtime.requestFullscreen?.();
      } catch {
        // `expand()` above remains the supported fallback when a client reports
        // a newer version but does not implement fullscreen correctly.
      }
    }
    applyAppearance();
    const update = () => applyAppearance();
    runtime.onEvent("themeChanged", update);
    runtime.onEvent("viewportChanged", update);
    runtime.onEvent("safeAreaChanged", update);
    runtime.onEvent("contentSafeAreaChanged", update);
    runtime.onEvent("fullscreenChanged", update);
    window.addEventListener("resize", update);
    return () => {
      runtime.offEvent("themeChanged", update);
      runtime.offEvent("viewportChanged", update);
      runtime.offEvent("safeAreaChanged", update);
      runtime.offEvent("contentSafeAreaChanged", update);
      runtime.offEvent("fullscreenChanged", update);
      window.removeEventListener("resize", update);
    };
  },
  backButton: (onClick: () => void): (() => void) => {
    if (!isTelegram()) return () => undefined;
    runtime.BackButton.onClick(onClick);
    runtime.BackButton.show();
    return () => {
      runtime.BackButton.offClick(onClick);
      runtime.BackButton.hide();
    };
  },
};
