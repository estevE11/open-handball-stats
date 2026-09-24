import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New match", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
});

test("tablet tagging preserves team tactics, score, undo, sanctions and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 820 });
  const phase = page.getByRole("group", { name: "Attack phase", exact: true });
  const defense = page.getByRole("group", {
    name: "Defensive system",
    exact: true,
  });
  await phase
    .getByRole("button", { name: "Counterattack", exact: true })
    .click();
  await defense.getByRole("button", { name: "5:1", exact: true }).click();
  await page.getByRole("button", { name: /^.*Goal Add a goal/ }).click();
  await expect(page.getByTestId("home-score")).toHaveText("1");
  await expect(
    phase.getByRole("button", { name: "Static", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    defense.getByRole("button", { name: "6:0", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await defense.getByRole("button", { name: "3:2:1", exact: true }).click();
  await page
    .getByRole("button", { name: /Keeper save Switch possession/ })
    .click();
  await expect(
    defense.getByRole("button", { name: "5:1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: /Technical fault Choose a fault/ })
    .click();
  await page.getByRole("button", { name: "Bad pass", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Live event stream" }).getByRole("listitem"),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Possession regained", exact: true })
    .click();
  await page.getByRole("button", { name: "7m penalty", exact: true }).click();
  await page
    .getByRole("button", { name: "Cards & suspensions", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Sanctioned team" })
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await page
    .getByRole("button", { name: "2-minute suspension", exact: true })
    .click();
  await expect(page.locator(".scoreboard [role=status]")).toHaveText(
    "Away attacking",
  );
  await expect(
    page.getByRole("list", { name: "Live event stream" }).getByRole("listitem"),
  ).toHaveCount(5);
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("home-score")).toHaveText("1");
  await expect(
    page.getByRole("list", { name: "Live event stream" }).getByRole("listitem"),
  ).toHaveCount(5);
  await expect(
    defense.getByRole("button", { name: "3:2:1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("JSON import/export, invalid import isolation, CSV and XML downloads", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Goal Add a goal/ }).click();
  await page.getByRole("button", { name: "Export data", exact: true }).click();
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /^JSON/ }).click();
  const json = await jsonDownload;
  const path = await json.path();
  const data = JSON.parse(await readFile(path!, "utf8"));
  expect(data.events[0].eventType).toBe("GOAL");
  expect(data.events[0].defenseSystem).toBe("6:0");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /^CSV/ }).click();
  expect(await readFile((await (await csvDownload).path())!, "utf8")).toContain(
    "attack_phase,defense_system",
  );
  const xmlDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /^XML/ }).click();
  const xml = await readFile((await (await xmlDownload).path())!, "utf8");
  expect(xml).toContain("<ALL_INSTANCES>");
  const parsed = await page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, "application/xml");
    return {
      errors: doc.querySelectorAll("parsererror").length,
      count: doc.querySelectorAll("instance").length,
    };
  }, xml);
  expect(parsed).toEqual({ errors: 0, count: 1 });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles(path!);
  await expect(page.getByTestId("home-score")).toHaveText("1");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My matches", exact: true }).click();
  await expect(page.locator(".match-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"bad":true}'),
  });
  await expect(page.getByText(/Invalid match file/)).toBeVisible();
  await expect(page.getByTestId("home-score")).toHaveText("1");
  // Imported matches have no local action journal: use last-event undo.
  await page.reload();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("home-score")).toHaveText("0");
  await expect(page.locator(".scoreboard [role=status]")).toHaveText(
    "Home attacking",
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("home-score")).toHaveText("0");
});

test("language, new match library, notes and clock controls", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await page.getByLabel("Match name", { exact: true }).fill("Derbi");
  await page.locator("input[name=home]").fill("Granollers");
  await page.locator("input[name=away]").fill("Barcelona");
  await page.getByRole("button", { name: "Create match", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Derbi" })).toBeVisible();
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Gol Sumar gol/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Gol Sumar gol/ }).click();
  await page
    .getByRole("button", { name: "Editar nota de la acción", exact: true })
    .click();
  await page
    .getByLabel("Notas (opcional)")
    .fill("Contraataque de primera oleada");
  await page.getByRole("button", { name: "Guardar nota", exact: true }).click();
  await expect(page.getByText("Contraataque de primera oleada")).toBeVisible();
  await page
    .getByRole("button", { name: "Ajustar reloj", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Minutos · Dígito 1", exact: true })
    .fill("2");
  await page
    .getByRole("textbox", { name: "Minutos · Dígito 2", exact: true })
    .fill("9");
  await page
    .getByRole("textbox", { name: "Segundos · Dígito 1", exact: true })
    .fill("5");
  await page
    .getByRole("textbox", { name: "Segundos · Dígito 2", exact: true })
    .fill("9");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ajustar reloj", exact: true }),
  ).toHaveText("29:59");
  await page
    .getByRole("button", { name: "Siguiente periodo", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Siguiente periodo", exact: true })
    .click();
  await expect(page.locator(".period-label")).toContainText("Periodo 2");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".period-label")).toContainText("Periodo 1");
  await expect(
    page.getByText("Guardado en este dispositivo", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Gol Sumar gol/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mis partidos", exact: true }).click();
  await expect(page.locator(".match-row")).toHaveCount(2);
  await page.locator(".match-row:not(:disabled)").click();
  await expect(
    page.getByRole("heading", { name: "Home vs Away" }),
  ).toBeVisible();
});

test("production PWA reloads and saves new events offline", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page.getByRole("button", { name: /Goal Add a goal/ }).click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("home-score")).toHaveText("1");
  await page.getByRole("button", { name: /Goal Add a goal/ }).click();
  await expect(page.getByTestId("away-score")).toHaveText("1");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("away-score")).toHaveText("1");
  await context.setOffline(false);
});

for (const [width, height] of [
  [1440, 1000],
  [1024, 820],
  [768, 1024],
  [390, 844],
]) {
  test(`responsive EN/ES layout ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    for (const language of ["EN", "ES"]) {
      await page.getByRole("button", { name: language, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const actions = page.locator(".action");
      await expect(actions).toHaveCount(6);
      for (const action of await actions.all()) {
        const box = await action.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      if (language === "EN")
        await page.screenshot({
          path: testInfo.outputPath(`match-${width}.png`),
          fullPage: true,
        });
    }
  });
}

test("blank team names cannot create an unrecoverable match", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await page.locator("input[name=home]").fill("   ");
  await page.getByRole("button", { name: "Create match", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Enter two different, non-empty team names.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Home vs Away" }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
});

test("possession glow, sliding tactics, defending-team default and event styling", async ({
  page,
}, testInfo) => {
  await expect(page).toHaveTitle("Open Handball Stats");
  const scoreboard = page.locator(".scoreboard");
  await expect(scoreboard).toHaveCSS("border-top-color", "rgb(86, 132, 163)");
  const ball = page.locator(".possession-ball");
  const track = page.locator(".possession-ball-track");
  const boardBounds = (await scoreboard.boundingBox())!;
  const homeBall = (await ball.boundingBox())!;
  expect(homeBall.height).toBeGreaterThan(boardBounds.height);
  expect(homeBall.x + homeBall.width / 2).toBeLessThan(
    boardBounds.x + boardBounds.width / 2,
  );
  await expect(page.locator(".possession-ball-clip")).toHaveCSS(
    "overflow",
    "hidden",
  );
  await scoreboard.screenshot({
    path: testInfo.outputPath("possession-home.png"),
  });
  const phase = page.getByRole("group", { name: "Attack phase", exact: true });
  const before = await phase.locator(".segment-selection").boundingBox();
  await phase
    .getByRole("button", { name: "Counterattack", exact: true })
    .click();
  await expect
    .poll(
      async () => (await phase.locator(".segment-selection").boundingBox())!.x,
    )
    .toBeGreaterThan(before!.x + 20);
  await page.getByRole("button", { name: /Goal Add a goal/ }).click();
  await expect(scoreboard).toHaveCSS("border-top-color", "rgb(200, 146, 71)");
  await track.evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  );
  const awayBall = (await ball.boundingBox())!;
  expect(awayBall.x + awayBall.width / 2).toBeGreaterThan(
    boardBounds.x + boardBounds.width / 2,
  );
  await scoreboard.screenshot({
    path: testInfo.outputPath("possession-away.png"),
  });
  const event = page.locator(".event-list li").first();
  await expect(event.locator(".event-action-icon svg")).toBeVisible();
  await expect(event.locator(".event-action-icon")).toHaveCSS(
    "color",
    "rgb(84, 114, 60)",
  );
  await expect(
    event.locator(".note-button .lucide-message-circle"),
  ).toBeVisible();
  expect(
    await event.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--event-team-color").trim(),
    ),
  ).toBe("#5684a3");
  await page
    .getByRole("button", { name: "Cards & suspensions", exact: true })
    .click();
  let teams = page.getByRole("group", { name: "Sanctioned team" });
  await expect(
    teams.getByRole("button", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await teams.getByRole("button", { name: "Away", exact: true }).click();
  await page.getByRole("button", { name: "Yellow card", exact: true }).click();
  expect(
    await event.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--event-team-color").trim(),
    ),
  ).toBe("#c89247");
  await page
    .getByRole("button", { name: "Cards & suspensions", exact: true })
    .click();
  teams = page.getByRole("group", { name: "Sanctioned team" });
  await expect(
    teams.getByRole("button", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(scoreboard).toHaveCSS("border-top-color", "rgb(86, 132, 163)");
  await expect(scoreboard).toHaveAttribute("data-attacker", "home");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Switch possession", exact: true })
    .click();
  await expect(track).toHaveCSS("transition-duration", "0s");
  await expect(ball).toHaveCSS("transition-duration", "0s");
});

test("per-digit clock editing wraps safely and supports cancel and undo", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Adjust clock", exact: true }).click();
  await page
    .getByRole("button", { name: "Increase Minutes · Digit 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Decrease Seconds · Digit 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Decrease Seconds · Digit 2", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("10:59");
  await page.getByRole("button", { name: "Adjust clock", exact: true }).click();
  await page
    .getByRole("button", { name: "Increase Seconds · Digit 1", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Seconds · Digit 1", exact: true }),
  ).toHaveValue("0");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("10:59");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("00:00");
});

test("larger auxiliary controls, modal markers and saved dark mode", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 820 });
  const aux = page.locator(".secondary-actions");
  await expect(aux.getByRole("button")).toHaveCount(4);
  for (const button of await aux.getByRole("button").all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThan(140);
    expect(box.height).toBeGreaterThanOrEqual(80);
  }
  await expect(page.locator(".tagging-panel .modal-indicator")).toHaveCount(2);
  await expect(page.locator(".action.fault")).toHaveAttribute(
    "aria-haspopup",
    "dialog",
  );
  await expect(page.locator(".sanction-action")).toHaveAttribute(
    "aria-haspopup",
    "dialog",
  );
  await page
    .getByRole("button", { name: "Switch possession", exact: true })
    .click();
  await expect(page.locator(".scoreboard [role=status]")).toHaveText(
    "Away attacking",
  );
  await page.screenshot({
    path: testInfo.outputPath("tablet-light.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".scoreboard")).toHaveCSS(
    "background-color",
    "rgb(32, 41, 35)",
  );
  await page.getByRole("button", { name: /Goal Add a goal/ }).click();
  await page.screenshot({
    path: testInfo.outputPath("tablet-dark.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cards & suspensions", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCSS(
    "background-color",
    "rgb(32, 41, 35)",
  );
  const selection = page.locator(".sanction-teams .segment-selection");
  const selectedTeam = page.locator(
    ".sanction-teams button[aria-pressed=true]",
  );
  await expect(selection).toHaveCSS("height", "48px");
  const selectedBounds = (await selectedTeam.boundingBox())!;
  const selectionBounds = (await selection.boundingBox())!;
  expect(Math.abs(selectionBounds.width - selectedBounds.width)).toBeLessThan(
    2,
  );
  expect(Math.abs(selectionBounds.x - selectedBounds.x)).toBeLessThan(2);
  await page.screenshot({
    path: testInfo.outputPath("sanctions-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Activar modo claro" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("phone-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Activar modo claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("dark mode follows the device until an explicit preference is saved", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("undo survives reloads and reopening a match with exact action history", async ({
  page,
}) => {
  const saved = () =>
    expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
  const phase = page.getByRole("group", { name: "Attack phase", exact: true });
  const defense = page.getByRole("group", {
    name: "Defensive system",
    exact: true,
  });
  await phase
    .getByRole("button", { name: "Counterattack", exact: true })
    .click();
  await defense.getByRole("button", { name: "5:1", exact: true }).click();
  await page.getByRole("button", { name: /Goal Add a goal/ }).click();
  await page
    .getByRole("button", { name: "Edit event note", exact: true })
    .click();
  await page.getByLabel("Notes (optional)").fill("A note to undo after reload");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await saved();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("A note to undo after reload")).toHaveCount(0);
  await expect(page.getByTestId("home-score")).toHaveText("1");
  await saved();
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await page.getByLabel("Match name", { exact: true }).fill("Second match");
  await page.getByRole("button", { name: "Create match", exact: true }).click();
  await page.getByRole("button", { name: "My matches", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Home vs Away/ })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("home-score")).toHaveText("0");
  await expect(page.locator(".scoreboard [role=status]")).toHaveText(
    "Home attacking",
  );
  await expect(
    phase.getByRole("button", { name: "Counterattack", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    defense.getByRole("button", { name: "5:1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await saved();
  await page.reload();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    defense.getByRole("button", { name: "6:0", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await saved();
  await page.reload();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    phase.getByRole("button", { name: "Static", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await saved();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
});

test("all dialogs dismiss on backdrop clicks, but inside clicks preserve drafts", async ({
  page,
}) => {
  const triggers = [
    "New match",
    "My matches",
    "Export data",
    /Technical fault Choose a fault/,
    "Cards & suspensions",
    "Adjust clock",
    "Next period",
  ];
  for (const name of triggers) {
    await page
      .getByRole("button", { name, exact: typeof name === "string" })
      .click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    const bounds = (await modal.boundingBox())!;
    await page.mouse.click(bounds.x + 10, bounds.y + 10);
    await expect(modal).toBeVisible();
    if (name === "Adjust clock")
      await page
        .getByRole("button", {
          name: "Increase Minutes · Digit 1",
          exact: true,
        })
        .click();
    await page.mouse.click(2, 2);
    await expect(modal).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "Adjust clock", exact: true }),
  ).toHaveText("00:00");
  await expect(page.locator(".period-label")).toContainText("Period 1");
  await page.getByRole("button", { name: /Goal Add a goal/ }).click();
  await page
    .getByRole("button", { name: "Edit event note", exact: true })
    .click();
  await page.getByLabel("Notes (optional)").fill("Unsaved draft");
  await page.mouse.click(2, 2);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Unsaved draft")).toHaveCount(0);
});

test("blocked shot sits in the center and flips possession through reload and undo", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 820 });
  const main = page.locator(".action-grid button");
  await expect(main.nth(3)).toContainText("Steal");
  await expect(main.nth(4)).toContainText("Shot blocked");
  await expect(main.nth(5)).toContainText("Technical fault");
  const bottom = page.locator(".secondary-actions button");
  await expect(bottom).toHaveCount(4);
  await expect(bottom.nth(0)).toContainText("Possession regained");
  const boxes = await Promise.all(
    (await bottom.all()).map((button) => button.boundingBox()),
  );
  expect(new Set(boxes.map((box) => box!.y)).size).toBe(1);
  const phase = page.getByRole("group", { name: "Attack phase", exact: true });
  await phase
    .getByRole("button", { name: "Counterattack", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Shot blocked Switch possession/ })
    .click();
  await expect(page.locator(".scoreboard [role=status]")).toHaveText(
    "Away attacking",
  );
  await expect(page.getByTestId("home-score")).toHaveText("0");
  await expect(
    phase.getByRole("button", { name: "Static", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".event-list li").first()).toContainText(
    "Shot blocked",
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".event-list li").first()).toContainText(
    "Shot blocked",
  );
  await page.screenshot({
    path: testInfo.outputPath("blocked-shot-tablet.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".event-list li")).toHaveCount(0);
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Lanzamiento bloqueado/ }),
  ).toBeVisible();
});

for (const shot of ["Keeper save", "Shot blocked", "Off-target / post"]) {
  test(`${shot} then regained possession returns the attacker and supports undo after reload`, async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: new RegExp(`${shot} Switch possession`) })
      .click();
    await expect(page.locator(".scoreboard [role=status]")).toHaveText(
      "Away attacking",
    );
    await page
      .getByRole("button", { name: "Possession regained", exact: true })
      .click();
    await expect(page.locator(".scoreboard [role=status]")).toHaveText(
      "Home attacking",
    );
    await expect(page.locator(".event-list li")).toHaveCount(2);
    await expect(page.getByTestId("home-score")).toHaveText("0");
    await expect(page.getByTestId("away-score")).toHaveText("0");
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator(".scoreboard [role=status]")).toHaveText(
      "Home attacking",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator(".scoreboard [role=status]")).toHaveText(
      "Away attacking",
    );
    await expect(page.locator(".event-list li")).toHaveCount(1);
    await expect(page.locator(".event-list li")).toContainText(shot);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator(".scoreboard [role=status]")).toHaveText(
      "Home attacking",
    );
    await expect(page.locator(".event-list li")).toHaveCount(0);
  });
}
