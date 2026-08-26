import { devices, expect, test, type Locator, type Page } from "@playwright/test";

async function loadUntilCount(page: Page, rows: Locator, expectedCount: number) {
  await page.waitForTimeout(220);
  for (let attempt = 0; attempt < 12 && await rows.count() < expectedCount; attempt += 1) {
    await page.evaluate(() => document.querySelector(".progressive-load")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(100);
  }
  await expect(rows).toHaveCount(expectedCount);
}

test("starts the public browser preview without requesting the Telegram SDK", async ({ page }) => {
  const telegramSdkRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("telegram-web-app.js")) telegramSdkRequests.push(request.url());
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "пинг понг каунтер" })).toBeVisible();
  expect(telegramSdkRequests).toEqual([]);
});

test("opens an opponent and records a score through the Vaul drawer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Загружаем матч")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "пинг понг каунтер" })).toBeVisible();
  await page.getByRole("button", { name: /Мария/ }).click();
  await expect(page.getByRole("heading", { name: "Мария" })).toBeVisible();
  await expect(page.locator(".opponent-scoreline .rolling-number")).toHaveCount(2);
  await expect.poll(async () => page.locator(".opponent-metrics .t-digit").first().evaluate((element) => getComputedStyle(element).animationName))
    .toContain("t-digit-pop-in");
  await expect(page.getByRole("button", { name: "Отменить последний счёт" })).toHaveCount(0);

  const activityCalendarBox = await page.locator(".activity-calendar").boundingBox();
  const todayBox = await page.locator(".match-activity-footer > span:last-child").boundingBox();
  expect(todayBox && activityCalendarBox ? todayBox.x + todayBox.width : 0)
    .toBeCloseTo(activityCalendarBox ? activityCalendarBox.x + activityCalendarBox.width : Number.POSITIVE_INFINITY, 1);

  await page.getByRole("button", { name: "Редактировать" }).click();
  const editDialog = page.getByRole("dialog", { name: "Что изменить?" });
  await expect(editDialog).toBeVisible();
  await expect.poll(async () => {
    const editDialogBox = await editDialog.boundingBox();
    const backgroundActionBox = await page.getByRole("button", { name: "Добавить счёт" }).boundingBox();
    if (!editDialogBox || !backgroundActionBox) return Number.POSITIVE_INFINITY;
    return Math.abs((editDialogBox.y + editDialogBox.height) - (backgroundActionBox.y + backgroundActionBox.height));
  }).toBeLessThanOrEqual(1);
  await expect.poll(async () => editDialog.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a)).toBeCloseTo(1, 2);
  const editDialogSettledBox = await editDialog.boundingBox();
  const toolbarBox = await page.locator(".bottom-nav").boundingBox();
  expect(editDialogSettledBox && toolbarBox
    ? Math.abs((editDialogSettledBox.y + editDialogSettledBox.height) - (toolbarBox.y + toolbarBox.height))
    : Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  await expect(editDialog.getByRole("button", { name: /Общий счёт партий/ })).toContainText("Не повлияет на ELO");
  await expect(editDialog.getByRole("button", { name: /Количество мячей/ })).toContainText("Не повлияет на ELO");
  await expect(editDialog.getByRole("button", { name: /Обнулить статистику/ })).toContainText("Только у себя, не изменит ELO");
  await expect(editDialog.getByRole("button", { name: /Удалить соперника/ })).toContainText("Только у себя, не изменит ELO");
  await expect(editDialog.getByRole("button", { name: /Обнулить статистику/ }).locator("strong")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(editDialog.getByRole("button", { name: /Удалить соперника/ }).locator("strong")).toHaveCSS("color", "rgb(255, 255, 255)");
  await editDialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(editDialog).toHaveCount(0);

  await page.getByRole("button", { name: "Добавить счёт" }).click();
  const scoreDialog = page.getByRole("dialog", { name: "Добавление счёта с Мария" });
  await expect(scoreDialog).toBeVisible();
  await expect(scoreDialog.locator(".score-header strong")).toHaveText("Добавление счёта");
  await expect(scoreDialog.locator(".score-header small")).toHaveText("с Мария");
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

  const dragSurface = drawer.locator(".score-progress");
  const dragBox = await dragSurface.boundingBox();
  if (!dragBox) throw new Error("Не удалось измерить область перетаскивания drawer");
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2 + 300, { steps: 8 });
  await page.mouse.up();
  await expect(scoreDialog).toBeHidden();

  await page.getByRole("button", { name: "Добавить счёт" }).click();
  await expect(scoreDialog).toBeVisible();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect.poll(async () => page.locator(".score-value .t-digit").first().evaluate((element) => getComputedStyle(element).animationName))
    .toContain("t-digit-pop-in");
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByRole("button", { name: "8", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(scoreDialog).toBeHidden();
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

  await page.getByRole("button", { name: "Главная" }).click();
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
  const dropdownSurfaceTransform = await page.evaluate(() => new Promise<string>((resolve) => requestAnimationFrame(() => {
    const surface = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Добавить"]');
    resolve(surface ? getComputedStyle(surface).transform : "none");
  })));
  expect(dropdownSurfaceTransform).not.toBe("none");
  const menuState = await rootMenu.locator(".add-flow-menu").evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42, filter: getComputedStyle(element).filter };
  });
  expect(menuState.x).toBe(0);
  expect(menuState.y).toBe(0);
  expect(["none", "blur(0px)"]).toContain(menuState.filter);
  await rootMenu.getByRole("button", { name: /Добавить счёт/ }).click();

  const opponentPicker = page.getByRole("dialog", { name: "Добавить счёт", exact: true });
  const handoffSamples = await opponentPicker.getByRole("button", { name: /Мария/ }).evaluate(async (button) => {
    (button as HTMLButtonElement).click();
    const samples: Array<{ actionScale: number | null; hasFloatingTrigger: boolean }> = [];
    for (let index = 0; index < 12; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const actionSurface = document.querySelector<HTMLElement>(".action-sheet");
      const matrix = actionSurface ? new DOMMatrixReadOnly(getComputedStyle(actionSurface).transform) : null;
      samples.push({
        actionScale: matrix?.a ?? null,
        hasFloatingTrigger: Boolean(document.querySelector(".floating-add-button")),
      });
    }
    return samples;
  });
  expect(handoffSamples.every(({ hasFloatingTrigger }) => !hasFloatingTrigger)).toBe(true);
  const actionScales = handoffSamples.flatMap(({ actionScale }) => actionScale === null ? [] : [actionScale]);
  if (actionScales.length > 1) {
    expect(Math.min(...actionScales)).toBeGreaterThanOrEqual(actionScales[0] - 0.05);
  }
  const drawer = page.locator(".score-drawer-content");
  await expect(drawer).toBeVisible();
  await expect(page.locator(".score-opponent-row")).toHaveCount(0);
  await expect(drawer.getByRole("radio")).toHaveText(["Ты", "Противник"]);

  const indicator = drawer.locator(".segment-active-indicator");
  const ownPosition = await indicator.boundingBox();
  await drawer.getByRole("radio", { name: "Противник" }).click();
  await expect(drawer.getByRole("radio", { name: "Противник" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await indicator.boundingBox())?.x ?? 0).toBeGreaterThan(ownPosition?.x ?? Number.POSITIVE_INFINITY);
});

test("keeps nested transitions anchored and closes the avatar picker visibly", async ({ page }) => {
  await page.goto("/");

  const addButton = page.getByRole("button", { name: "Добавить", exact: true });
  const initialAddBox = await addButton.boundingBox();
  if (!initialAddBox) throw new Error("Не удалось измерить кнопку добавления");

  await page.locator(".opponent-card").filter({ hasText: "Мария" }).click();
  await expect(page.getByRole("heading", { name: "Мария" })).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();

  const returningAddSamples = await page.evaluate(async () => {
    const samples: Array<{ x: number; y: number; scale: number }> = [];
    for (let index = 0; index < 24; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const button = document.querySelector<HTMLElement>('.floating-add-button');
      const scaleWrapper = document.querySelector<HTMLElement>('.floating-add-scale');
      const slot = document.querySelector<HTMLElement>('.floating-add-slot');
      if (!button || !scaleWrapper || !slot) continue;
      if (Number(getComputedStyle(slot).opacity) < 0.5) continue;
      const box = button.getBoundingClientRect();
      samples.push({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        scale: new DOMMatrixReadOnly(getComputedStyle(scaleWrapper).transform).a,
      });
    }
    return samples;
  });
  expect(returningAddSamples.length).toBeGreaterThan(0);
  for (const sample of returningAddSamples) {
    expect(sample.x).toBeCloseTo(initialAddBox.x + initialAddBox.width / 2, 1);
    expect(sample.y).toBeCloseTo(initialAddBox.y + initialAddBox.height / 2, 1);
    expect(sample.scale).toBeCloseTo(1, 2);
  }

  await expect(addButton).toBeVisible();
  const addCenter = {
    x: initialAddBox.x + initialAddBox.width / 2,
    y: initialAddBox.y + initialAddBox.height / 2,
  };
  await addButton.click();
  const openingSurface = await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const surface = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Добавить"]');
    if (!surface) return null;
    const box = surface.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  expect(openingSurface).not.toBeNull();
  expect(openingSurface?.x ?? 0).toBeGreaterThan(page.viewportSize()!.width / 2);
  expect(openingSurface?.y ?? 0).toBeGreaterThan(page.viewportSize()!.height / 2);
  expect(Math.hypot((openingSurface?.x ?? 0) - addCenter.x, (openingSurface?.y ?? 0) - addCenter.y)).toBeLessThan(140);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Профиль" }).click();
  await page.getByRole("button", { name: "Настройки" }).click();
  const nameInput = page.getByRole("textbox", { name: "Имя профиля" });
  await expect(nameInput).toBeFocused();
  const inputChrome = await nameInput.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outlineStyle,
      shadow: style.boxShadow,
      borderStyle: style.borderBottomStyle,
      borderWidth: style.borderBottomWidth,
      borderColor: style.borderBottomColor,
    };
  });
  expect(inputChrome).toEqual({
    outline: "none",
    shadow: "none",
    borderStyle: "solid",
    borderWidth: "1px",
    borderColor: "rgb(237, 237, 237)",
  });

  await page.getByRole("button", { name: "Изменить аватар" }).click();
  const avatarDialog = page.getByRole("dialog", { name: "Выбрать аватар" });
  await expect(avatarDialog).toBeVisible();
  const emojiGridHeight = await avatarDialog.locator(".avatar-emoji-grid").evaluate((element) => element.clientHeight);
  expect(emojiGridHeight).toBeLessThanOrEqual(380);
  const avatarDialogHandle = await avatarDialog.elementHandle();
  if (!avatarDialogHandle) throw new Error("Не найден dialog выбора аватара");
  await avatarDialog.getByRole("button", { name: "Закрыть" }).click();
  await page.waitForTimeout(32);
  const closingState = await avatarDialogHandle.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return { opacity: Number(style.opacity), scale: matrix.a, y: matrix.f };
  });
  expect(closingState.opacity).toBeLessThan(1);
  expect(closingState.scale).toBeLessThan(1);
  expect(closingState.y).toBeGreaterThan(0);
  await expect(avatarDialog).toHaveCount(0);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("keeps modal feedback and opponent states without positional travel", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const addButton = page.getByRole("button", { name: "Добавить", exact: true });
    await addButton.click();

    const menu = page.getByRole("dialog", { name: "Добавить", exact: true });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("transform", "none");
    await expect(menu.getByRole("button", { name: /Добавить счёт/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(addButton).toBeFocused();

    await page.getByRole("button", { name: /Мария/ }).click();
    await expect(page.getByRole("heading", { name: "Мария" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Редактировать" })).toBeVisible();
    await page.waitForTimeout(180);
    await page.evaluate(() => window.scrollTo({ top: 130, behavior: "auto" }));
    await page.waitForTimeout(180);

    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(130, 0);
    await expect(page.locator(".opponent-header-avatar-content")).toHaveCSS("transform", "none");
    await expect(page.locator(".opponent-header-name")).toHaveCSS("transform", "none");
    await expect(page.locator(".opponent-header-score")).toHaveCSS("transform", "none");

    const outgoingScreen = page.locator('main[data-screen="opponent"]');
    await page.getByRole("button", { name: "Назад" }).click();
    const reducedBackMatrix = await outgoingScreen.evaluate((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { scaleX: matrix.a, scaleY: matrix.d, translateX: matrix.e, translateY: matrix.f };
    });
    expect(reducedBackMatrix).toEqual({ scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 });
  });
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
  const tabbar = page.locator(".bottom-nav");
  const addButton = page.getByRole("button", { name: "Добавить", exact: true });
  const addMaterial = page.locator(".floating-add-material");
  const screenBox = await page.locator("main.screen").boundingBox();
  const tabbarBox = await tabbar.boundingBox();
  const addButtonBox = await addButton.boundingBox();
  expect(tabbarBox?.height).toBeCloseTo(60, 0);
  expect(addButtonBox?.width).toBeCloseTo(60, 0);
  expect(addButtonBox?.height).toBeCloseTo(60, 0);
  expect(addButtonBox && tabbarBox ? addButtonBox.x - (tabbarBox.x + tabbarBox.width) : 0).toBeCloseTo(4, 1);
  expect(addButtonBox && tabbarBox ? addButtonBox.y + addButtonBox.height / 2 : 0)
    .toBeCloseTo(tabbarBox ? tabbarBox.y + tabbarBox.height / 2 : Number.POSITIVE_INFINITY, 1);
  expect(addButtonBox ? addButtonBox.x + addButtonBox.width : 0)
    .toBeCloseTo(screenBox ? screenBox.x + screenBox.width : Number.POSITIVE_INFINITY, 1);
  await expect(page.locator(".progressive-bottom-blur")).toHaveCount(0);
  await expect(tabbar).toHaveAttribute("data-liquid-glass", "material");
  await expect(addMaterial).toHaveAttribute("data-liquid-glass", "material");
  await expect(addMaterial).toHaveCSS("width", "60px");
  await expect(addMaterial).toHaveCSS("height", "60px");
  const material = await tabbar.evaluate((element) => ({
    backdropFilter: getComputedStyle(element).backdropFilter,
    background: getComputedStyle(element).backgroundColor,
    manualOverlay: getComputedStyle(element, "::after").content,
    labelSizes: [...element.querySelectorAll(".nav-button-label")].map((label) => getComputedStyle(label).fontSize),
  }));
  expect(material.backdropFilter).toContain("blur(6px)");
  expect(material.backdropFilter).toContain("url(");
  expect(material.background).toBe("rgba(255, 255, 255, 0.24)");
  expect(material.manualOverlay).toBe("none");
  expect(material.labelSizes).toEqual(["11px", "11px", "11px"]);
  const addMaterialStyle = await addMaterial.evaluate((element) => ({
    backdropFilter: getComputedStyle(element).backdropFilter,
    background: getComputedStyle(element).backgroundColor,
  }));
  expect(addMaterialStyle.backdropFilter).toContain("blur(6px)");
  expect(addMaterialStyle.backdropFilter).toContain("url(");
  expect(addMaterialStyle.background).toMatch(/0(?:,? )0(?:,? )0/);
  const positions: Array<{ x: number; y: number; width: number; height: number; buttonWidth: number; buttonPadding: string }> = [];
  const tabButtonBoxes = await page.locator(".nav-button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { left: box.left, right: box.right, width: box.width };
  }));
  expect(tabButtonBoxes[1].left).toBeCloseTo(tabButtonBoxes[0].right, 1);
  expect(tabButtonBoxes[2].left).toBeCloseTo(tabButtonBoxes[1].right, 1);
  expect(tabbarBox?.width ?? 0).toBeCloseTo(tabButtonBoxes.reduce((sum, box) => sum + box.width, 12), 1);

  for (const tab of ["История", "Главная", "Профиль", "История"]) {
    await page.getByRole("button", { name: tab }).click();
    await expect(page.getByRole("button", { name: tab })).toHaveAttribute("aria-current", "page");
    const addAppearanceSamples = await page.evaluate(async () => {
      const samples: Array<{ opacity: number; transform: string; wrapperTransform: string }> = [];
      for (let index = 0; index < 8; index += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const button = document.querySelector<HTMLElement>(".floating-add-button");
        const wrapper = document.querySelector<HTMLElement>(".floating-add-scale");
        if (!button || !wrapper) continue;
        samples.push({
          opacity: Number(getComputedStyle(button).opacity),
          transform: getComputedStyle(button).transform,
          wrapperTransform: getComputedStyle(wrapper).transform,
        });
      }
      return samples;
    });
    expect(addAppearanceSamples.length).toBeGreaterThan(0);
    expect(addAppearanceSamples.every(({ opacity, transform, wrapperTransform }) => opacity === 1 && transform === "none" && wrapperTransform === "none")).toBe(true);
    await page.waitForTimeout(90);
    await expect(page.locator(".page-header .text-state-swap")).toHaveCount(1);
    await expect(page.locator("main.screen")).toHaveCSS("filter", "none");
    await expect(page.getByRole("button", { name: "Добавить", exact: true })).toBeVisible();
    if (tab === "Профиль") {
      await expect.poll(async () => page.locator(".profile-metrics .t-digit").first().evaluate((element) => getComputedStyle(element).animationName))
        .toContain("t-digit-pop-in");
    }
    const box = await pill.boundingBox();
    const activeButton = page.getByRole("button", { name: tab });
    const activeButtonBox = await activeButton.boundingBox();
    if (!box) throw new Error("Не удалось измерить индикатор tabbar");
    if (!activeButtonBox) throw new Error("Не удалось измерить активную кнопку tabbar");
    positions.push({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      buttonWidth: activeButtonBox.width,
      buttonPadding: await activeButton.evaluate((element) => getComputedStyle(element).padding),
    });
    await expect(activeButton).toHaveCSS("color", "rgb(10, 174, 240)");
    await expect(activeButton).toHaveCSS("padding-left", "20px");
    await expect(activeButton).toHaveCSS("padding-right", "20px");
    await expect(activeButton.locator(".nav-button-content")).toHaveCSS("padding-left", "0px");
    await expect(activeButton.locator(".nav-button-content")).toHaveCSS("padding-right", "0px");
    await expect(pill).toHaveCSS("background-color", "rgba(255, 255, 255, 0.94)");
  }

  expect(new Set(positions.map(({ y }) => y)).size).toBe(1);
  expect(new Set(positions.map(({ height }) => height)).size).toBe(1);
  expect(positions.every(({ width, buttonWidth }) => Math.abs(width - buttonWidth) <= 1)).toBe(true);
  expect(positions.every(({ buttonPadding }) => buttonPadding === "0px 20px")).toBe(true);
  expect(positions[0].x).toBeLessThan(positions[1].x);
  expect(positions[1].x).toBeLessThan(positions[2].x);
  expect(positions[3].x).toBeCloseTo(positions[0].x, 2);

  const trailingSlot = page.locator(".page-header-action-icon");
  const trailingSlotHandle = await trailingSlot.elementHandle();
  const trailingSlotBefore = await trailingSlot.boundingBox();
  if (!trailingSlotHandle || !trailingSlotBefore) throw new Error("Не найден правый слот хедера");
  await page.getByRole("button", { name: "Профиль" }).click();
  await page.waitForTimeout(32);
  const trailingSlotDuring = await trailingSlotHandle.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { connected: element.isConnected, x: box.x, y: box.y, transform: getComputedStyle(element).transform };
  });
  expect(trailingSlotDuring.connected).toBe(true);
  expect(trailingSlotDuring.x).toBeCloseTo(trailingSlotBefore.x, 1);
  expect(trailingSlotDuring.y).toBeCloseTo(trailingSlotBefore.y, 1);
  expect(trailingSlotDuring.transform).toBe("none");
  const settingsButton = page.getByRole("button", { name: "Настройки" });
  await expect(settingsButton).toBeVisible();
  const settingsHandle = await settingsButton.elementHandle();
  if (!settingsHandle) throw new Error("Не найдена кнопка настроек");
  await page.getByRole("button", { name: "Главная" }).click();
  await page.waitForTimeout(32);
  const settingsExit = await settingsHandle.evaluate((element) => ({
    connected: element.isConnected,
    opacity: Number(getComputedStyle(element).opacity),
    scale: new DOMMatrixReadOnly(getComputedStyle(element).transform).a,
  }));
  expect(settingsExit.connected).toBe(true);
  expect(settingsExit.opacity < 1 || settingsExit.scale < 1).toBe(true);
  await expect(settingsButton).toHaveCount(0);
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

  const stickyScroll = await page.locator(".history-group").nth(1).evaluate((group, top) => {
    const heading = group.querySelector<HTMLElement>(".history-group-heading");
    if (!heading) throw new Error("Не найден второй заголовок периода");
    return heading.getBoundingClientRect().top + window.scrollY - top + 12;
  }, stickyTop);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "auto" }), stickyScroll);
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

test("keeps the compact avatar stationary without flying from the profile", async ({ page }) => {
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
  await page.getByRole("button", { name: "Главная" }).click();
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

  const firstBadge = page.locator(".history-badge").first();
  const firstBadgeBox = await firstBadge.boundingBox();
  if (!firstBadgeBox) throw new Error("Не найден badge результата в истории");
  const badgeVisibleAtLeftEdge = await page.evaluate(({ x, y }) => Boolean(
    document.elementFromPoint(x, y)?.closest(".history-badge"),
  ), { x: firstBadgeBox.x + 1, y: firstBadgeBox.y + firstBadgeBox.height / 2 });
  expect(badgeVisibleAtLeftEdge).toBe(true);

  const profileAvatarBefore = await page.locator(".page-header .header-profile-avatar").boundingBox();
  if (!profileAvatarBefore) throw new Error("Не найден аватар в хэдере истории");

  const mariaMatch = page.getByRole("button", { name: /Победа Мария/ }).last();
  await mariaMatch.scrollIntoViewIfNeeded();
  await expect(mariaMatch).toBeVisible();
  const outgoingHistory = page.locator('main[data-screen="stats"]');
  const outgoingHistoryHandle = await outgoingHistory.elementHandle();
  if (!outgoingHistoryHandle) throw new Error("Не найден исходящий экран истории");
  await mariaMatch.click();
  await page.waitForTimeout(64);
  const historyExitState = await outgoingHistoryHandle.evaluate((element) => ({
    connected: element.isConnected,
    opacity: Number(getComputedStyle(element).opacity),
  }));
  expect(historyExitState.connected ? historyExitState.opacity : 0).toBeLessThan(0.5);

  await expect(page.getByRole("heading", { name: "Мария" })).toBeVisible();
  const backMorph = page.locator(".opponent-header-back .header-leading-surface-back");
  await expect(backMorph).toBeVisible();
  await expect(page.locator(".opponent-header-back > .app-icon")).toHaveCount(0);
  const backMorphBox = await backMorph.boundingBox();
  expect(backMorphBox?.x).toBeCloseTo(profileAvatarBefore.x, 1);
  expect(backMorphBox?.y).toBeCloseTo(profileAvatarBefore.y, 1);
  await page.waitForTimeout(280);
  await expect(page.getByRole("heading", { name: "статистика" })).toHaveCount(0);
  const header = page.locator(".opponent-collapsing-header");
  const avatar = page.locator(".opponent-header-avatar-content");
  const name = page.locator(".opponent-header-name");
  const score = page.locator(".opponent-header-score");
  const summary = page.locator(".opponent-header-summary");
  const editButtonBox = await page.getByRole("button", { name: "Редактировать" }).boundingBox();
  const editIconBox = await page.locator(".opponent-header-edit .app-icon").boundingBox();
  const backIconBox = await page.locator(".opponent-header-back .header-leading-morph-icon").boundingBox();
  await expect(header).toHaveCSS("position", "sticky");
  const expandedHeaderBox = await header.boundingBox();
  expect(editButtonBox && expandedHeaderBox ? editButtonBox.x : 0)
    .toBeGreaterThan(expandedHeaderBox ? expandedHeaderBox.x + expandedHeaderBox.width / 2 : Number.POSITIVE_INFINITY);
  expect(editButtonBox && expandedHeaderBox ? editButtonBox.y + editButtonBox.height / 2 : 0)
    .toBeCloseTo(expandedHeaderBox ? expandedHeaderBox.y + expandedHeaderBox.height / 2 : Number.POSITIVE_INFINITY, 1);
  expect(editIconBox?.width ?? 0).toBeCloseTo(backIconBox?.width ?? Number.POSITIVE_INFINITY, 1);
  expect(editIconBox?.height ?? 0).toBeCloseTo(backIconBox?.height ?? Number.POSITIVE_INFINITY, 1);
  const expandedAvatarBox = await avatar.boundingBox();
  const expandedNameBox = await name.boundingBox();
  const expandedScoreBox = await score.boundingBox();
  expect(expandedAvatarBox?.width).toBeCloseTo(76, 0);
  expect(expandedAvatarBox && expandedHeaderBox ? expandedAvatarBox.x + expandedAvatarBox.width / 2 : 0)
    .toBeCloseTo(expandedHeaderBox ? expandedHeaderBox.x + expandedHeaderBox.width / 2 : Number.POSITIVE_INFINITY, 1);
  expect(expandedNameBox && expandedAvatarBox ? expandedNameBox.y - (expandedAvatarBox.y + expandedAvatarBox.height) : Number.POSITIVE_INFINITY)
    .toBeGreaterThanOrEqual(10);
  expect(expandedScoreBox && expandedNameBox ? expandedScoreBox.y : 0)
    .toBeGreaterThan(expandedNameBox ? expandedNameBox.y + expandedNameBox.height : Number.POSITIVE_INFINITY);
  await expect(page.locator(".opponent-header-avatar-content .profile-avatar-emoji")).toHaveCSS("font-size", "40px");
  const digitGaps = await page.locator(".opponent-metrics .rolling-number").first().locator(".rolling-digit").evaluateAll((digits) => digits.slice(0, -1).map((digit, index) => {
    const current = digit.getBoundingClientRect();
    const next = digits[index + 1].getBoundingClientRect();
    return next.left - current.right;
  }));
  expect(digitGaps.every((gap) => Math.abs(gap) <= 0.5)).toBe(true);

  await page.mouse.move(12, 180);
  await page.mouse.down();
  await page.evaluate(() => window.scrollTo({ top: 98, behavior: "auto" }));
  const intermediateState = await page.evaluate(() => new Promise<{ opacity: number; transform: string }>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(".opponent-header-avatar-content");
    const styles = element ? getComputedStyle(element) : null;
    resolve({ opacity: Number(styles?.opacity ?? 0), transform: styles?.transform ?? "none" });
  }))));
  expect(intermediateState.opacity).toBe(1);
  expect(intermediateState.transform).not.toBe("none");
  const intermediateSummaryBox = await summary.boundingBox();
  const intermediateActivityBox = await page.locator(".match-activity").boundingBox();
  expect(intermediateSummaryBox && intermediateActivityBox ? intermediateSummaryBox.y + intermediateSummaryBox.height : Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(intermediateActivityBox?.y ?? 0);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(196, 0);

  await expect.poll(async () => (await avatar.boundingBox())?.width ?? 0).toBeCloseTo(34.2, 0);
  await expect(summary).toHaveCSS("opacity", "0");
  const compactHeaderBox = await header.boundingBox();
  const compactAvatarBox = await avatar.boundingBox();
  const compactNameBox = await name.boundingBox();
  const compactScoreBox = await score.boundingBox();
  expect(compactHeaderBox?.y).toBeCloseTo(expandedHeaderBox?.y ?? Number.POSITIVE_INFINITY, 1);
  expect(compactAvatarBox ? compactAvatarBox.y + compactAvatarBox.height : Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(0);
  expect(compactNameBox && compactHeaderBox ? compactNameBox.x + compactNameBox.width / 2 : 0)
    .toBeCloseTo(compactHeaderBox ? compactHeaderBox.x + compactHeaderBox.width / 2 : Number.POSITIVE_INFINITY, 1);
  expect(compactScoreBox && compactHeaderBox ? compactScoreBox.x + compactScoreBox.width / 2 : 0)
    .toBeCloseTo(compactHeaderBox ? compactHeaderBox.x + compactHeaderBox.width / 2 : Number.POSITIVE_INFINITY, 1);
  expect(compactScoreBox && compactHeaderBox ? compactScoreBox.y + compactScoreBox.height : Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(compactHeaderBox ? compactHeaderBox.y + compactHeaderBox.height : 0);
  expect(compactScoreBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(18);
  const activityBox = await page.locator(".match-activity").boundingBox();
  expect(activityBox && compactHeaderBox ? activityBox.y - (compactHeaderBox.y + compactHeaderBox.height) : Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(28);
  await expect(score).toHaveCSS("font-weight", "400");
  const compactScoreColors = await page.locator(".opponent-header-score .score-pair > span").evaluateAll((parts) => parts.map((part) => getComputedStyle(part).color));
  expect(new Set(compactScoreColors).size).toBe(3);
  const [compactNameColor, pageTextColor] = await page.evaluate(() => [
    getComputedStyle(document.querySelector<HTMLElement>(".opponent-header-name")!).color,
    getComputedStyle(document.body).color,
  ]);
  expect(compactNameColor).toBe(pageTextColor);

  await page.getByRole("tab", { name: "По дням" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(196, 0);
  await page.getByRole("tab", { name: "По играм" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(196, 0);

  const outgoingOpponentScreen = page.locator('main[data-screen="opponent"]');
  const navigationState = () => page.evaluate(() => {
    const slot = document.querySelector<HTMLElement>(".bottom-toolbar-slot");
    if (!slot) throw new Error("Не найден tabbar");
    const rect = slot.getBoundingClientRect();
    return {
      bottomGap: window.innerHeight - rect.bottom,
      position: getComputedStyle(slot).position,
      transform: getComputedStyle(slot).transform,
    };
  });
  const navigationBeforeBack = await navigationState();
  expect(navigationBeforeBack).toMatchObject({ position: "fixed", transform: "none" });
  await page.getByRole("button", { name: "Назад" }).click();
  await page.waitForTimeout(32);
  const opponentBackTranslate = await outgoingOpponentScreen.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
  expect(opponentBackTranslate).toBeGreaterThan(0);
  const navigationDuringBack = await navigationState();
  expect(navigationDuringBack).toMatchObject({ position: "fixed", transform: "none" });
  expect(navigationDuringBack.bottomGap).toBeCloseTo(navigationBeforeBack.bottomGap, 1);
  await expect(page.getByRole("button", { name: "История" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "история" })).toBeVisible();
  const navigationAfterBack = await navigationState();
  expect(navigationAfterBack).toMatchObject({ position: "fixed", transform: "none" });
  expect(navigationAfterBack.bottomGap).toBeCloseTo(navigationBeforeBack.bottomGap, 1);
});

test("manages an FNT rating from Levels and promotes the player to Pro", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Профиль" }).click();

  await expect(page.locator(".profile-facts")).toHaveCount(1);
  await expect(page.getByText("ещё про вас", { exact: true })).toHaveCount(0);

  await expect(page.locator(".profile-actions")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Настройки" })).toBeVisible();
  await expect(page.locator(".profile-facts").first().getByText("Рейтинг", { exact: true })).toHaveCount(0);
  const profileIdentityBox = await page.locator(".profile-identity").boundingBox();
  const profileMetricsBox = await page.locator(".profile-metrics").boundingBox();
  expect(profileMetricsBox && profileIdentityBox ? profileMetricsBox.y - (profileIdentityBox.y + profileIdentityBox.height) : 0)
    .toBeCloseTo(48, 0);
  const dividerBox = await page.locator(".profile-divider").boundingBox();
  expect(dividerBox?.y ?? 0).toBeGreaterThan(profileMetricsBox?.y ?? Number.POSITIVE_INFINITY);
  await expect(page.locator(".profile-elo-badge")).toContainText("ELO");
  await expect(page.locator(".profile-identity")).toHaveCSS("padding-top", "8px");
  await expect(page.locator(".profile-identity > span")).toHaveText(["@alexey", "·", "720 ELO"]);
  await expect(page.locator(".profile-elo-badge")).toHaveCSS("background-color", "rgb(0, 176, 255)");
  await expect(page.locator(".profile-elo-badge")).toHaveCSS("color", "rgb(255, 255, 255)");

  await page.locator(".profile-fact-link").click();
  await expect(page.locator("main.screen")).toHaveCount(1);
  await expect(page.locator("main.screen")).toHaveCSS("opacity", "1");
  const levelsList = page.locator(".levels-list");
  const ratingEditor = page.locator(".levels-rating-editor");
  const levelsListBox = await levelsList.boundingBox();
  const ratingEditorBox = await ratingEditor.boundingBox();
  expect(ratingEditorBox?.y ?? 0).toBeGreaterThan(levelsListBox?.y ?? Number.POSITIVE_INFINITY);

  await page.getByLabel("Рейтинг или ссылка на профиль ФНТР").fill("https://ttfr.ru/sportsman/9");
  await ratingEditor.getByRole("button", { name: "Добавить", exact: true }).click();

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
