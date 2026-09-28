import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { logEvent, newMatch } from "../src/lib/matchEngine";
import type { MatchSession } from "../src/types/match";

const portableData = (match: MatchSession) => ({
  ...match,
  id: undefined,
  events: match.events.map((event) => ({
    ...event,
    id: undefined,
    matchId: undefined,
  })),
});

test("saved match transfers into another device without replacing its matches", async ({
  page,
  browser,
}, testInfo) => {
  let match = newMatch("Granollers", "Barcelona", "Copa transfer");
  match.homeTeam.currentDefense = "3:2:1";
  match.awayTeam.currentDefense = "5:1";
  match.competition = "Copa";
  match.gameTimeSeconds = 145;
  match.attackPhase = "COUNTERATTACK";
  match = logEvent(match, "GOAL", { notes: "Fast break" });
  match = logEvent(match, "TECHNICAL_FAULT", {
    subType: "BAD_PASS",
    notes: "Pase interceptado",
  });
  match.period = 2;
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New match", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "match.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(match)),
  });
  await expect(page.getByTestId("home-score")).toHaveText("1");
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await page.getByLabel("Match name", { exact: true }).fill("Next game");
  await page.getByRole("button", { name: "Create match", exact: true }).click();
  await page.getByRole("button", { name: "My matches", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export match: Copa transfer", exact: true })
    .click();
  const exported = await download;
  const sourcePath = (await exported.path())!;
  const source: MatchSession = JSON.parse(await readFile(sourcePath, "utf8"));
  expect(portableData(source)).toEqual(portableData(match));
  await expect(page.getByTestId("home-score")).toHaveText("0");
  await page.screenshot({
    path: testInfo.outputPath("match-library-transfer.png"),
    fullPage: true,
  });

  const device = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 390, height: 844 },
  });
  try {
    const target = await device.newPage();
    await target.goto("/");
    await expect(
      target
        .getByText("Saved on this device", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await target.getByRole("button", { name: "Open menu" }).click();
    await target
      .getByRole("button", { name: "My matches", exact: true })
      .click();
    const picker = target.waitForEvent("filechooser");
    await target
      .getByRole("button", { name: "Import match", exact: true })
      .click();
    await (await picker).setFiles(sourcePath);
    await expect(
      target.getByText("Match imported and saved as a separate local copy."),
    ).toBeVisible();
    await expect(target.getByTestId("home-score")).toHaveText("1");
    await expect(
      target.getByRole("button", { name: "Adjust clock" }),
    ).toHaveText("02:25");
    await target.reload();
    await expect(target.getByTestId("home-score")).toHaveText("1");
    await target.getByRole("button", { name: "Open menu" }).click();
    await target
      .getByRole("button", { name: "My matches", exact: true })
      .click();
    await expect(target.locator(".match-row")).toHaveCount(2);
    const reexport = target.waitForEvent("download");
    await target
      .getByRole("button", { name: "Export match: Copa transfer", exact: true })
      .click();
    const restored: MatchSession = JSON.parse(
      await readFile((await (await reexport).path())!, "utf8"),
    );
    expect(restored.id).not.toBe(source.id);
    expect(portableData(restored)).toEqual(portableData(source));
    await target.screenshot({
      path: testInfo.outputPath("match-library-mobile.png"),
      fullPage: true,
    });
    await target.getByRole("button", { name: "Close", exact: true }).click();
    await target.getByRole("button", { name: "Open menu" }).click();
    await target
      .getByRole("button", { name: "Analysis report", exact: true })
      .click();
    await expect(target.getByTestId("home-attack")).toContainText("100.0%");
    await expect(target.getByTestId("away-attack")).toContainText("0.0%");
  } finally {
    await device.close();
  }
});
