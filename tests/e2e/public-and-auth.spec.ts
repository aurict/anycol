import { expect, test } from "@playwright/test";

test("public landing and health endpoints render", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Dağınık sinyaller/ }),
  ).toBeVisible();
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
});

test("protected workspace rejects missing and forged sessions", async ({
  page,
  context,
}) => {
  await page.goto("/demo/overview");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await context.addCookies([
    { name: "anycol_session", value: "forged", url: "http://127.0.0.1:3100" },
  ]);
  await page.goto("/demo/overview");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
});
