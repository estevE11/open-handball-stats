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
    .getByRole("button", { name: /Possession regained Keep current/ })
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
    "Home attacking",
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
    defense.getByRole("button", { name: "5:1", exact: true }),
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
}) => {
  await expect(page).toHaveTitle("Open Handball Stats");
  const scoreboard = page.locator(".scoreboard");
  await expect(scoreboard).toHaveCSS("border-top-color", "rgb(86, 132, 163)");
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
