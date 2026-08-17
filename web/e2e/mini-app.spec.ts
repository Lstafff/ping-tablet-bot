import { devices, expect, test, type Locator, type Page } from "@playwright/test";

async function loadUntilCount(page: Page, rows: Locator, expectedCount: number) {
  for (let attempt = 0; attempt < 12 && await rows.count() < expectedCount; attempt += 1) {
    await page.evaluate(() => document.querySelector(".progressive-load")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(100);
  }
  await expect(rows).toHaveCount(expectedCount);
}

test("opens an opponent and records a score through the Vaul drawer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Загружаем матч")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "пинг понг каунтер" })).toBeVisible();
  await page.getByRole("button", { name: /Мария/ }).click();
  await expect(page.getByRole("heading", { name: "Мария" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отменить последний счёт" })).toHaveCount(0);

  await page.getByRole("button", { name: "Добавить счёт" }).click();
  await expect(page.getByRole("dialog", { name: "Добавить счёт" })).toBeVisible();
  const drawer = page.locator(".score-drawer-content");
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox?.x).toBe(0);
  expect(drawerBox?.width).toBe(390);
  expect(drawerBox?.height ?? 844).toBeLessThan(844);
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByRole("button", { name: "8", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByRole("dialog", { name: "Добавить счёт" })).toBeHidden();
  const addScoreButton = page.getByRole("button", { name: "Добавить счёт" });
  const undoScoreButton = page.getByRole("button", { name: "Отменить последний счёт" });
  await expect(undoScoreButton).toBeVisible();
  const addScoreBox = await addScoreButton.boundingBox();
  const undoScoreBox = await undoScoreButton.boundingBox();
  expect(undoScoreBox?.x ?? 0).toBeGreaterThan(addScoreBox?.x ?? Number.POSITIVE_INFINITY);
  await undoScoreButton.click();
  await expect(undoScoreButton).toHaveCount(0);
});

test("appends every progressive history batch without replacing existing rows", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "История" }).click();
  const historyRows = page.locator(".history-row");
  await loadUntilCount(page, historyRows, 8);
  await expect(historyRows.filter({ hasText: "Мария" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Матчи" }).click();
  await page.getByRole("button", { name: /Мария/ }).click();
  await page.getByRole("tab", { name: "По дням" }).click();
  await loadUntilCount(page, page.locator(".opponent-tab-content .table-row"), 7);

  await page.getByRole("tab", { name: "По играм" }).click();
  await loadUntilCount(page, page.locator(".opponent-tab-content .table-row"), 11);
});

test("keeps the main tab indicator on one horizontal track", async ({ page }) => {
  await page.goto("/");
  const pill = page.locator(".nav-active-pill");
  const positions: Array<{ x: number; y: number; height: number }> = [];

  for (const tab of ["История", "Матчи", "Профиль", "История"]) {
    await page.getByRole("button", { name: tab }).click();
    await expect(page.getByRole("button", { name: tab })).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(220);
    const box = await pill.boundingBox();
    if (!box) throw new Error("Не удалось измерить индикатор tabbar");
    positions.push({ x: box.x, y: box.y, height: box.height });
  }

  expect(new Set(positions.map(({ y }) => y)).size).toBe(1);
  expect(new Set(positions.map(({ height }) => height)).size).toBe(1);
  expect(positions[0].x).toBeLessThan(positions[1].x);
  expect(positions[1].x).toBeLessThan(positions[2].x);
  expect(positions[3].x).toBeCloseTo(positions[0].x, 2);
});

test.describe("Android avatar emoji fallback", () => {
  test.use({
    viewport: devices["Pixel 7"].viewport,
    userAgent: devices["Pixel 7"].userAgent,
    deviceScaleFactor: devices["Pixel 7"].deviceScaleFactor,
    isMobile: devices["Pixel 7"].isMobile,
    hasTouch: devices["Pixel 7"].hasTouch,
  });

  test("keeps a selected emoji visible in the profile and compact header avatar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Профиль" }).click();
    await page.getByRole("button", { name: /Настройки/ }).click();
    await page.getByRole("button", { name: "Изменить аватар" }).click();
    await page.getByRole("button", { name: "Эмодзи 😀" }).click();

    const profileEmoji = page.locator(".profile-hero .profile-avatar-emoji");
    await expect(profileEmoji).toHaveText("😀");
    await expect(profileEmoji).toHaveCSS("font-family", /Noto Color Emoji/);

    await page.getByRole("button", { name: "Сохранить" }).click();
    await page.getByRole("button", { name: "История" }).click();
    await expect(page.locator(".header-profile-avatar .profile-avatar-emoji")).toHaveText("😀");
  });
});
