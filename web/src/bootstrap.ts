import { ensureTelegramSdk } from "./lib/telegramSdk";

void ensureTelegramSdk().finally(() => import("./main"));
