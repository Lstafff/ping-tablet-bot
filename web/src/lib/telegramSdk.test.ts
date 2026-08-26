import { describe, expect, it } from "vitest";

import { isTelegramLaunch } from "./telegramSdk";
// @ts-ignore The copied Telegram helper is JavaScript and intentionally browser-safe.
import WebApp from "../../mini-app/lib/twa/webApp";

describe("isTelegramLaunch", () => {
  it("recognizes Telegram launch data in both supported URL locations", () => {
    expect(isTelegramLaunch("?tgWebAppPlatform=ios", "")).toBe(true);
    expect(isTelegramLaunch("", "#tgWebAppData=signed&tgWebAppVersion=8.0")).toBe(true);
    expect(isTelegramLaunch("", "", true)).toBe(true);
  });

  it("does not load the Telegram SDK for an ordinary browser preview", () => {
    expect(isTelegramLaunch("?ref=website", "#section", false)).toBe(false);
    expect(WebApp.ready).toBeTypeOf("function");
  });
});
