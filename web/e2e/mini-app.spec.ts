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
  expect(handleBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(handleBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect.poll(async () => page.locator(".score-value .t-digit").first().evaluate((element) => getComputedStyle(element).animationName))
    .toContain("t-digit-pop-in");
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

test("opens the central add-score flow without waiting and uses the shared selector", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  const rootMenu = page.getByRole("dialog", { name: "Добавить", exact: true });
  await expect(rootMenu).toBeVisible();
  await expect(rootMenu.locator(".add-flow-menu")).toHaveCount(1);
  const sharedSurfaceTransform = await page.evaluate(() => new Promise<string>((resolve) => requestAnimationFrame(() => {
    const surface = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Добавить"]');
    resolve(surface ? getComputedStyle(surface).transform : "none");
  })));
  expect(sharedSurfaceTransform).not.toBe("none");
  await rootMenu.getByRole("button", { name: /Добавить счёт/ }).click();

  const opponentPicker = page.getByRole("dialog", { name: "Добавить счёт", exact: true });
  await opponentPicker.getByRole("button", { name: /Мария/ }).click();
  const drawer = page.locator(".score-drawer-content");
  await expect(drawer).toBeVisible();
  await expect(page.locator(".score-opponent-row")).toHaveCount(0);
  await expect(drawer.getByRole("tab")).toHaveText(["Ты", "Противник"]);

  const indicator = drawer.locator(".segment-active-indicator");
  const ownPosition = await indicator.boundingBox();
  await drawer.getByRole("tab", { name: "Противник" }).click();
  await expect(drawer.getByRole("tab", { name: "Противник" })).toHaveAttribute("aria-selected", "true");
  await expect.poll(async () => (await indicator.boundingBox())?.x ?? 0).toBeGreaterThan(ownPosition?.x ?? Number.POSITIVE_INFINITY);
});

test("expands invalid-score guidance by swipe and keeps its handle reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Мария/ }).click();
  await page.getByRole("button", { name: "Добавить счёт" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();

  const compactNotice = page.locator(".score-validation-compact");
  const compactBox = await compactNotice.boundingBox();
  if (!compactBox) throw new Error("Не удалось измерить snackbar ошибки счёта");
  const hitTargetClass = await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest(".score-validation-surface")?.className ?? "", {
    x: compactBox.x + compactBox.width / 2,
    y: compactBox.y + compactBox.height / 2,
  });
  expect(String(hitTargetClass)).toContain("score-validation");
  await compactNotice.locator(".score-validation-gesture-layer").evaluate((element, { from, to }) => {
    const options = { bubbles: true, pointerId: 7, pointerType: "touch", isPrimary: true };
    element.dispatchEvent(new PointerEvent("pointerdown", { ...options, clientY: from }));
    element.dispatchEvent(new PointerEvent("pointermove", { ...options, clientY: to }));
    element.dispatchEvent(new PointerEvent("pointerup", { ...options, clientY: to }));
  }, { from: compactBox.y + compactBox.height / 2, to: compactBox.y - 42 });

  const rules = page.getByRole("dialog", { name: "Правила счёта" });
  await expect(rules).toBeVisible();
  await page.waitForTimeout(260);
  const handleBox = await rules.locator(".score-validation-handle").boundingBox();
  expect(handleBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  const rulesBox = await rules.boundingBox();
  if (!rulesBox) throw new Error("Не удалось измерить правила счёта");
  await rules.locator(".score-validation-gesture-layer").evaluate((element, { from, to }) => {
    const options = { bubbles: true, pointerId: 8, pointerType: "touch", isPrimary: true };
    element.dispatchEvent(new PointerEvent("pointerdown", { ...options, clientY: from }));
    element.dispatchEvent(new PointerEvent("pointermove", { ...options, clientY: to }));
    element.dispatchEvent(new PointerEvent("pointerup", { ...options, clientY: to }));
  }, { from: rulesBox.y + rulesBox.height - 22, to: rulesBox.y + rulesBox.height + 28 });
  await expect(compactNotice).toBeVisible();
});

test("keeps the main tab indicator on one horizontal track", async ({ page }) => {
  await page.goto("/");
  const pill = page.locator(".nav-active-pill");
  const positions: Array<{ x: number; y: number; height: number }> = [];

  for (const tab of ["История", "Матчи", "Профиль", "История"]) {
    await page.getByRole("button", { name: tab }).click();
    await expect(page.getByRole("button", { name: tab })).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(220);
    await expect(page.locator(".page-header .text-state-swap")).toHaveCount(tab === "Профиль" ? 0 : 1);
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
  const historyRows = page.locator(".history-row");
  await loadUntilCount(page, historyRows, 8);

  const sortButton = page.locator(".history-sort-button");
  await sortButton.click();
  const movingRows = await historyRows.evaluateAll((rows) => rows.filter((row) => getComputedStyle(row).transform !== "none").length);
  expect(movingRows).toBeGreaterThan(0);
  await page.waitForTimeout(220);
  await expect.poll(async () => historyRows.evaluateAll((rows) => rows.every((row) => getComputedStyle(row).transform === "none"))).toBe(true);
  await sortButton.click();
  await page.waitForTimeout(220);

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

test("keeps the compact avatar stationary and morphs it from the profile", async ({ page }) => {
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
  await page.waitForTimeout(32);
  await expect(avatar).not.toHaveCSS("transform", "none");
  await expect.poll(() => avatar.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  await expect(avatar).toHaveCSS("transform", "none");
  const profileToMatchesBox = await avatar.boundingBox();

  await page.getByRole("button", { name: "Профиль" }).click();
  await page.getByRole("button", { name: "История" }).click();
  await expect(avatar).toBeVisible();
  await page.waitForTimeout(32);
  await expect(avatar).not.toHaveCSS("transform", "none");
  await expect.poll(() => avatar.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
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
  const name = page.locator(".opponent-header-name");
  const score = page.locator(".opponent-header-score");
  const summary = page.locator(".opponent-header-summary");
  await expect(header).toHaveCSS("position", "sticky");
  const expandedHeaderBox = await header.boundingBox();
  const expandedAvatarBox = await avatar.boundingBox();
  const expandedNameBox = await name.boundingBox();
  const expandedScoreBox = await score.boundingBox();
  expect(expandedAvatarBox?.width).toBeCloseTo(76, 0);
  expect(expandedAvatarBox && expandedHeaderBox ? expandedAvatarBox.x + expandedAvatarBox.width / 2 : 0)
    .toBeCloseTo(expandedHeaderBox ? expandedHeaderBox.x + expandedHeaderBox.width / 2 : Number.POSITIVE_INFINITY, 1);
  expect(expandedNameBox && expandedAvatarBox ? expandedNameBox.y - (expandedAvatarBox.y + expandedAvatarBox.height) : Number.POSITIVE_INFINITY)
    .toBeGreaterThanOrEqual(-6);
  expect(expandedScoreBox && expandedNameBox ? expandedScoreBox.y : 0)
    .toBeGreaterThan(expandedNameBox ? expandedNameBox.y + expandedNameBox.height : Number.POSITIVE_INFINITY);
  await expect(page.locator(".opponent-header-avatar .profile-avatar-emoji")).toHaveCSS("font-size", "48px");

  await page.evaluate(() => window.scrollTo({ top: 84, behavior: "auto" }));
  const intermediateOpacity = await page.evaluate(() => new Promise<number>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(".opponent-header-avatar");
    resolve(Number(element ? getComputedStyle(element).opacity : 0));
  }))));
  expect(intermediateOpacity).toBeCloseTo(0.5, 1);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(168, 0);

  await page.evaluate(() => window.scrollTo({ top: 200, behavior: "auto" }));
  await expect.poll(async () => (await avatar.boundingBox())?.width ?? 0).toBeCloseTo(34.2, 0);
  await expect(avatar).toHaveCSS("opacity", "0");
  await expect(summary).toHaveCSS("opacity", "0");
  const compactHeaderBox = await header.boundingBox();
  const compactAvatarBox = await avatar.boundingBox();
  const compactNameBox = await name.boundingBox();
  const compactScoreBox = await score.boundingBox();
  expect(compactHeaderBox?.y).toBeCloseTo(expandedHeaderBox?.y ?? Number.POSITIVE_INFINITY, 1);
  expect(compactAvatarBox && compactHeaderBox ? compactAvatarBox.y : Number.POSITIVE_INFINITY)
    .toBeLessThan(compactHeaderBox?.y ?? 0);
  expect(compactNameBox && compactHeaderBox ? compactNameBox.x + compactNameBox.width / 2 : 0)
    .toBeCloseTo(compactHeaderBox ? compactHeaderBox.x + compactHeaderBox.width / 2 : Number.POSITIVE_INFINITY, 1);
  expect(compactScoreBox && compactHeaderBox ? compactScoreBox.x + compactScoreBox.width / 2 : 0)
    .toBeCloseTo(compactHeaderBox ? compactHeaderBox.x + compactHeaderBox.width / 2 : Number.POSITIVE_INFINITY, 1);
  expect(compactScoreBox && compactHeaderBox ? compactScoreBox.y + compactScoreBox.height : Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(compactHeaderBox ? compactHeaderBox.y + compactHeaderBox.height : 0);
  expect(compactScoreBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(18);
  await expect(score).toHaveCSS("font-weight", "400");
  const compactScoreColors = await page.locator(".opponent-header-score .score-pair > span").evaluateAll((parts) => parts.map((part) => getComputedStyle(part).color));
  expect(new Set(compactScoreColors).size).toBe(3);
  const [compactNameColor, pageTextColor] = await page.evaluate(() => [
    getComputedStyle(document.querySelector<HTMLElement>(".opponent-header-name")!).color,
    getComputedStyle(document.body).color,
  ]);
  expect(compactNameColor).toBe(pageTextColor);

  const outgoingOpponentScreen = page.locator('main[data-screen="opponent"]');
  await page.getByRole("button", { name: "Назад" }).click();
  await page.waitForTimeout(32);
  const opponentBackTranslate = await outgoingOpponentScreen.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
  expect(opponentBackTranslate).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "История" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "история" })).toBeVisible();
});

test("manages an FNT rating from Levels and promotes the player to Pro", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Профиль" }).click();

  await expect(page.locator(".profile-facts")).toHaveCount(1);
  await expect(page.getByText("ещё про вас", { exact: true })).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Рейтинг недоступен" })).toBeDisabled();
  await expect(page.locator(".profile-facts").first().getByText("Рейтинг", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /Уровень/ }).click();
  await expect(page.locator("main.screen")).toHaveCount(1);
  await expect(page.locator("main.screen")).toHaveCSS("opacity", "1");
  const levelsList = page.locator(".levels-list");
  const ratingEditor = page.locator(".levels-rating-editor");
  const levelsListBox = await levelsList.boundingBox();
  const ratingEditorBox = await ratingEditor.boundingBox();
  expect(ratingEditorBox?.y ?? 0).toBeGreaterThan(levelsListBox?.y ?? Number.POSITIVE_INFINITY);

  await page.getByLabel("Рейтинг или ссылка на профиль ФНТР").fill("https://ttfr.ru/sportsman/9");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Профик" })).toBeVisible();
  await expect(page.locator(".level-icon-fntr-badge")).toHaveText("ФНТР");
  await expect(page.getByRole("status")).toContainText("Теперь ваш уровень — «Профик»");

  const outgoingLevelsScreen = page.locator('main[data-screen="levels"]');
  await page.getByRole("button", { name: "Назад" }).click();
  await page.waitForTimeout(32);
  const levelsBackTranslate = await outgoingLevelsScreen.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
  expect(levelsBackTranslate).toBeGreaterThan(0);
  await expect(page.locator(".profile-avatar-fntr-badge")).toHaveText("ФНТР");
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
