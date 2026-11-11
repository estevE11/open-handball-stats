import { test, expect, type Page } from "@playwright/test";

async function adjustTime(page: Page, digits: string) {
  await page.getByRole("button", { name: "Adjust clock", exact: true }).click();
  for (const [index, digit] of [...digits].entries()) {
    const name = `${index < 2 ? "Minutes" : "Seconds"} · Digit ${(index % 2) + 1}`;
    await page.getByRole("textbox", { name, exact: true }).fill(digit);
  }
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-11T12:00:00Z") });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New match", exact: true }),
  ).toBeEnabled();
});

test("25-minute halves always pause and Play automatically starts period 2 when enabled", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Clock settings", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Half length (minutes)" }),
  ).toHaveValue("30");
  await expect(
    page.getByRole("checkbox", { name: "Automatic switch to second half" }),
  ).toBeChecked();
  await page
    .getByRole("spinbutton", { name: "Half length (minutes)" })
    .fill("25");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await adjustTime(page, "2459");
  await page.getByRole("button", { name: "Start clock", exact: true }).click();
  await page.clock.fastForward(120_000);
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("25:00");
  await expect(page.locator(".period-label")).toHaveText(/Period 1.*Halftime/);
  await expect(
    page
      .getByText("Saved on this device", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".period-label")).toHaveText(/Period 1.*Halftime/);
  await page.getByRole("button", { name: "Start clock", exact: true }).click();
  await page.clock.fastForward(1000);
  await expect(page.locator(".period-label")).toHaveText(/Period 2.*Live/);
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("25:01");
  await page.getByRole("button", { name: /Goal Add a goal/ }).click();
  await expect(page.locator(".event-time small")).toHaveText("P2");
  await page.getByRole("button", { name: "Pause clock", exact: true }).click();
  await adjustTime(page, "4959");
  await page.getByRole("button", { name: "Start clock", exact: true }).click();
  await page.clock.fastForward(5000);
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("50:00");
  await expect(page.locator(".period-label")).toHaveText(/Period 2.*Full time/);
  await expect(
    page.getByRole("button", { name: "Start clock", exact: true }),
  ).toBeDisabled();
});

test("automatic switching off still stops at 30 and requires Next period before Play", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Clock settings", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Automatic switch to second half" })
    .uncheck();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await adjustTime(page, "2959");
  await page.getByRole("button", { name: "Start clock", exact: true }).click();
  await page.clock.fastForward(5000);
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("30:00");
  await expect(page.locator(".period-label")).toHaveText(/Period 1.*Halftime/);
  await expect(
    page.getByRole("button", { name: "Start clock", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next period", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Next period", exact: true })
    .click();
  await page.getByRole("button", { name: "Start clock", exact: true }).click();
  await page.clock.fastForward(1000);
  await expect(page.locator(".period-label")).toHaveText(/Period 2.*Live/);
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("30:01");
});
