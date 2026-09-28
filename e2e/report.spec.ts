import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newMatch, logEvent } from "../src/lib/matchEngine";
function fixture() {
  let match = newMatch("Granollers", "Barça", "Análisis · Jornada 4");
  match.awayTeam.currentDefense = "5:1";
  match = logEvent(match, "GOAL");
  match = logEvent({ ...match, attackPhase: "COUNTERATTACK" }, "GK_SAVE");
  match = logEvent(
    { ...match, attackPhase: "COUNTERATTACK_ATTEMPTED" },
    "SHOT_OUT",
  );
  match = logEvent(match, "STEAL");
  match = logEvent(match, "TECHNICAL_FAULT", { subType: "BAD_PASS" });
  match = logEvent(match, "SHOT_BLOCKED");
  match = logEvent({ ...match, period: 2 }, "GOAL");
  match = logEvent(match, "GOAL");
  return match;
}
async function loadFixture(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New match", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "report.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture())),
  });
  await expect(page.getByTestId("home-score")).toHaveText("2");
  await page
    .getByRole("button", { name: "Analysis report", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Analysis report", exact: true }),
  ).toBeVisible();
}

test("report mirrors team metrics, filters periods and inspects defense bands", async ({
  page,
}, testInfo) => {
  await loadFixture(page);
  await expect(page.getByTestId("home-attack")).toContainText("50.0%");
  await expect(page.getByTestId("away-attack")).toContainText("25.0%");
  await page.getByLabel("Report scope").selectOption("1");
  await expect(page.getByTestId("home-attack")).toContainText("33.3%");
  await expect(page.getByTestId("away-defense")).toContainText("66.7%");
  await page.getByLabel("Inspect possession").fill("2");
  await expect(page.locator(".possession-inspector")).toContainText(
    "#3 · Granollers",
  );
  const awayBands = page.getByRole("button", { name: /^Barça: 5:1/ });
  await expect(awayBands).toHaveCount(1);
  await awayBands.click();
  await expect(
    page.getByRole("button", { name: "Show all possessions" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Show all possessions" }).click();
  await page
    .getByRole("combobox", { name: "Perspective", exact: true })
    .selectOption("away");
  await page.getByRole("button", { name: "Keeper save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keeper save", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: testInfo.outputPath("report-desktop.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Analysis report", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to tagging" }).click();
  await expect(page.getByTestId("home-score")).toHaveText("2");
  await page
    .getByRole("button", { name: "Analysis report", exact: true })
    .click();
  await page.getByLabel("Report scope").selectOption("2");
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await page.getByRole("button", { name: "Create match", exact: true }).click();
  await expect(page.getByLabel("Report scope")).toHaveValue("all");
  await expect(page.getByTestId("home-attack")).toContainText("—");
});

test("report exports complete EN/ES PDFs offline and works on mobile", async ({
  page,
  context,
}, testInfo) => {
  await loadFixture(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await context.setOffline(true);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  const file = await download;
  const pdfPath = testInfo.outputPath("report-es.pdf");
  await file.saveAs(pdfPath);
  expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  const english = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  await (await english).saveAs(testInfo.outputPath("report-en.pdf"));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Download PDF" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("report-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to tagging" }).click();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("button", { name: "Analysis report", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Analysis report", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("report-mobile-dark.png"),
    fullPage: true,
  });
});

test("empty report has unavailable percentages and no invented possessions", async ({
  page,
}) => {
  await page.goto("/#report");
  await expect(
    page.getByRole("heading", { name: "Analysis report", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tag your first attack to start the analysis."),
  ).toBeVisible();
  await expect(page.getByTestId("home-attack")).toContainText("—");
  await expect(page.locator(".difference-chart")).toHaveCount(0);
});
