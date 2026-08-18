import { devices, expect, test, type Locator, type Page } from "@playwright/test";

async function loadUntilCount(page: Page, rows: Locator, expectedCount: number) {
  await page.waitForTimeout(220);
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
  await expect(page.locator(".opponent-scoreline .rolling-number")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Отменить последний счёт" })).toHaveCount(0);

  const activityCalendarBox = await page.locator(".activity-calendar").boundingBox();
  const todayBox = await page.locator(".match-activity-footer > span:last-child").boundingBox();
  expect(todayBox && activityCalendarBox ? todayBox.x + todayBox.width : 0)
    .toBeCloseTo(activityCalendarBox ? activityCalendarBox.x + activityCalendarBox.width : Number.POSITIVE_INFINITY, 1);

  await page.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Изменить" });
  await expect(editDialog).toBeVisible();
  await expect(editDialog).toHaveCSS("transform", "none");
  await editDialog.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Добавить счёт" }).click();
  await expect(page.getByRole("dialog", { name: "Добавить счёт" })).toBeVisible();
  const drawer = page.locator(".score-drawer-content");
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox?.x).toBe(0);
  expect(drawerBox?.width).toBe(390);
  expect(drawerBox?.height ?? 844).toBeLessThan(844);
  const handleBox = await page.locator(".score-drawer-handle").boundingBox();
  expect(handleBox && drawerBox ? handleBox.x + handleBox.width / 2 : 0)
    .toBeCloseTo(drawerBox ? drawerBox.x + drawerBox.width / 2 : Number.POSITIVE_INFINITY, 1);
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
  await page.locator(".opponent-card").filter({ hasText: "Мария" }).click();
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
    await expect(page.locator(".page-header .screen-title-wave")).toHaveCount(tab === "Профиль" ? 0 : 1);
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

test("keeps history chrome sticky and restores a previously scrolled position before paint", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "История" }).click();
  await loadUntilCount(page, page.locator(".history-row"), 8);

  const header = page.locator(".page-header-sticky");
  await expect(header).toHaveCSS("position", "sticky");
  const stickyBackgrounds = await page.locator(".page-header-sticky, .history-group-heading").evaluateAll((elements) => elements.map((element) => getComputedStyle(element, "::before").backgroundColor));
  expect(stickyBackgrounds.every((color) => color !== "rgba(0, 0, 0, 0)" && color !== "transparent")).toBe(true);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  const headerBefore = await header.boundingBox();
  if (!headerBefore) throw new Error("Не удалось измерить закреплённый хэдер");
  const stickyTop = headerBefore.y + headerBefore.height + 8;
  const firstGroup = page.locator(".history-group").first();
  const firstHeading = firstGroup.locator(".history-group-heading");
  const firstGroupMetrics = await firstGroup.evaluate((group) => {
    const heading = group.querySelector<HTMLElement>(".history-group-heading");
    if (!heading) throw new Error("Не найден заголовок периода");
    const groupRect = group.getBoundingClientRect();
    return {
      bottom: groupRect.bottom + window.scrollY,
      headingHeight: heading.getBoundingClientRect().height,
    };
  });
  const releaseScroll = firstGroupMetrics.bottom - firstGroupMetrics.headingHeight - stickyTop + 18;
  await page.evaluate((top) => window.scrollTo({ top, behavior: "auto" }), releaseScroll);
  const releasedHeadingBox = await firstHeading.boundingBox();
  const releasedGroupBox = await firstGroup.boundingBox();
  const releasedHeadingBottom = releasedHeadingBox ? releasedHeadingBox.y + releasedHeadingBox.height : Number.POSITIVE_INFINITY;
  const releasedGroupBottom = releasedGroupBox ? releasedGroupBox.y + releasedGroupBox.height : 0;
  expect(releasedHeadingBottom).toBeLessThanOrEqual(releasedGroupBottom + 1);
  expect(releasedHeadingBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(stickyTop - 8);

  await page.evaluate(() => window.scrollTo({ top: Math.min(420, document.documentElement.scrollHeight), behavior: "auto" }));
  const rememberedScroll = await page.evaluate(() => window.scrollY);
  expect(rememberedScroll).toBeGreaterThan(100);
  const headerAfter = await header.boundingBox();
  expect(headerAfter?.y).toBeCloseTo(headerBefore?.y ?? Number.POSITIVE_INFINITY, 1);

  const groupTops = await page.locator(".history-group-heading").evaluateAll((headings) => headings.map((heading) => heading.getBoundingClientRect().top));
  expect(groupTops.some((top) => Math.abs(top - stickyTop) <= 2)).toBe(true);

  await page.getByRole("button", { name: "Профиль" }).click();
  await expect(page.getByRole("button", { name: "Профиль" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("ping-tablet:scroll:stats"))).toBe(String(rememberedScroll));
  await page.getByRole("button", { name: "История" }).click();
  await expect(page.getByRole("button", { name: "История" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(rememberedScroll, -1);
});

test("keeps the compact avatar stationary across main tabs", async ({ page }) => {
  await page.goto("/");
  const avatar = page.locator(".header-profile-avatar");
  await expect(avatar).toBeVisible();
  const homeBox = await avatar.boundingBox();
  if (!homeBox) throw new Error("Не удалось измерить аватар в хэдере");

  await page.getByRole("button", { name: "История" }).click();
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveCSS("transform", "none");
  const historyBox = await avatar.boundingBox();
  expect(historyBox?.x).toBeCloseTo(homeBox.x, 1);
  expect(historyBox?.y).toBeCloseTo(homeBox.y, 1);

  await page.getByRole("button", { name: "Профиль" }).click();
  await expect(avatar).toHaveCount(0);
  await page.getByRole("button", { name: "Матчи" }).click();
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveCSS("transform", "none");
  const profileToMatchesBox = await avatar.boundingBox();

  await page.getByRole("button", { name: "Профиль" }).click();
  await page.getByRole("button", { name: "История" }).click();
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveCSS("transform", "none");
  const profileToHistoryBox = await avatar.boundingBox();
  expect(profileToHistoryBox?.x).toBeCloseTo(profileToMatchesBox?.x ?? Number.POSITIVE_INFINITY, 1);
  expect(profileToHistoryBox?.y).toBeCloseTo(profileToMatchesBox?.y ?? Number.POSITIVE_INFINITY, 1);
});

test("collapses the opponent header and returns to the originating history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "История" }).click();
  await loadUntilCount(page, page.locator(".history-row"), 8);

  const mariaMatch = page.getByRole("button", { name: /Победа Мария/ }).last();
  await mariaMatch.scrollIntoViewIfNeeded();
  await expect(mariaMatch).toBeVisible();
  await mariaMatch.click();

  await expect(page.getByRole("heading", { name: "Мария" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "статистика" })).toHaveCount(0);
  const header = page.locator(".opponent-collapsing-header");
  const avatar = page.locator(".opponent-header-avatar");
  await expect(header).toHaveCSS("position", "sticky");
  const expandedHeaderBox = await header.boundingBox();
  const expandedAvatarBox = await avatar.boundingBox();
  expect(expandedAvatarBox?.width).toBeCloseTo(76, 0);

  await page.evaluate(() => window.scrollTo({ top: 200, behavior: "auto" }));
  await expect.poll(async () => (await avatar.boundingBox())?.width ?? 0).toBeCloseTo(34.2, 0);
  const compactHeaderBox = await header.boundingBox();
  const compactAvatarBox = await avatar.boundingBox();
  expect(compactHeaderBox?.y).toBeCloseTo(expandedHeaderBox?.y ?? Number.POSITIVE_INFINITY, 1);
  expect(compactAvatarBox && compactHeaderBox ? compactAvatarBox.y : 0).toBeGreaterThanOrEqual(compactHeaderBox?.y ?? Number.POSITIVE_INFINITY);
  expect(compactAvatarBox && compactHeaderBox ? compactAvatarBox.y + compactAvatarBox.height : Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual((compactHeaderBox?.y ?? 0) + (compactHeaderBox?.height ?? 0) + 1);
  const compactScoreColors = await page.locator(".opponent-header-score .score-pair > span").evaluateAll((parts) => parts.map((part) => getComputedStyle(part).color));
  expect(new Set(compactScoreColors).size).toBe(1);

  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("button", { name: "История" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "история" })).toBeVisible();
});

test("opens profile subpages without a screen opacity flash", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Профиль" }).click();

  await page.getByRole("button", { name: /Рейтинг/ }).click();
  await expect(page.locator("main.screen")).toHaveCount(1);
  await expect(page.locator("main.screen")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Назад" }).click();

  await page.getByRole("button", { name: /Уровень/ }).click();
  await expect(page.locator("main.screen")).toHaveCount(1);
  await expect(page.locator("main.screen")).toHaveCSS("opacity", "1");
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
