import { expect, test } from "@playwright/test";

test("opens an opponent and records a score through the Vaul drawer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "пинг понг каунтер" })).toBeVisible();
  await page.getByRole("button", { name: /Мария/ }).click();
  await expect(page.getByRole("heading", { name: "Мария" })).toBeVisible();

  await page.getByRole("button", { name: "Добавить счёт" }).click();
  await expect(page.getByRole("dialog", { name: "Добавить счёт" })).toBeVisible();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByRole("button", { name: "8", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByRole("dialog", { name: "Добавить счёт" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Отменить последний счёт" })).toBeVisible();
});
