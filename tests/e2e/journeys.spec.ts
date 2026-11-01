import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  failAI,
  interceptAI,
  isoDaysFromNow,
} from "./helpers";

test("AI down: intake uses the standard questions and a starter plan", async ({ page }) => {
  await failAI(page);
  await page.goto("/intake");
  await expect(page.getByText(/assistant isn't reachable/)).toBeVisible();
  await expectNoAxeViolations(page);

  const next = page.getByRole("button", { name: "Next" });
  await next.click();
  await expect(page.getByRole("alert")).toHaveText("Choose what you're celebrating.");

  await page.getByLabel(/Occasion/).selectOption("anniversary");
  await next.click();
  await page.getByLabel(/Event date/).fill(isoDaysFromNow(60));
  await next.click();
  await page.getByLabel(/Number of guests/).fill("60");
  await next.click();
  await page.getByLabel(/Total budget/).fill("300000");
  await next.click();
  await page.getByLabel(/Currency/).selectOption("INR");
  await next.click();
  await expectNoAxeViolations(page);
  await next.click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Skip / not sure" }).click();

  await expect(page.getByRole("alert")).toContainText("Your answers are kept");
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Use a starter plan instead" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Anniversary on");
  await expect(page.getByText(/made without the AI assistant/)).toBeVisible();
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { name: "Do next" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("vendor desk: draft questions, add a quote, accept it and see it committed", async ({
  page,
}) => {
  const tasks = await interceptAI(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Use sample event" }).click();
  await page.getByRole("tab", { name: "Vendors" }).click();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Add a vendor" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a vendor" });
  await dialog.getByLabel(/Vendor name/).fill("Bloom Studio");
  await dialog.getByLabel(/Budget category/).selectOption("Décor");
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Add vendor" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Draft questions to ask Bloom Studio" }).click();
  await expect(page.getByRole("heading", { name: "Questions to ask Bloom Studio" })).toBeVisible();
  expect(tasks).toContain("vendor_questions");

  await page.getByRole("button", { name: "Add quote from Bloom Studio" }).click();
  const quote = page.getByRole("dialog", { name: "Add a quote from Bloom Studio" });
  await quote.getByLabel(/Quoted amount/).fill("20000");
  await quote.getByLabel("What's included").fill("Table flowers and a photo wall");
  await quote.getByRole("button", { name: "Add quote" }).click();
  await expect(quote).toBeHidden();

  await page.getByRole("button", { name: "Accept Bloom Studio quote of ₹20,000" }).click();
  await expect(page.getByRole("button", { name: "Unaccept Bloom Studio quote" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("tab", { name: "Budget" }).click();
  const decor = page.getByRole("listitem", { name: "Décor" });
  await expect(decor.getByRole("button", { name: "Vendor quote" })).toBeVisible();
  await expect(decor).toContainText("₹20,000");
});

test("backup: export every event, delete it, and import it back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use sample event" }).click();
  await page.getByRole("link", { name: "My events" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all events" }).click();
  const file = await (await download).path();
  const exported = readFileSync(file, "utf8");
  expect(exported).toContain("35th Anniversary");

  await page.getByRole("button", { name: /^Delete Mum & Dad/ }).click();
  await page
    .getByRole("dialog", { name: "Delete this event?" })
    .getByRole("button", { name: "Delete event" })
    .click();
  await expect(page.getByText(/No events yet/)).toBeVisible();

  await page.getByLabel("Choose a Hostwise export file").setInputFiles({
    name: "hostwise-events.json",
    mimeType: "application/json",
    buffer: Buffer.from(exported),
  });
  await expect(page.getByText("Imported 1 event.")).toBeVisible();
  await expect(page.getByRole("link", { name: /35th Anniversary/ }).first()).toBeVisible();
  await expectNoAxeViolations(page);
});

test("phone width: every screen reflows at 360 px without sideways scrolling", async ({ page }) => {
  await interceptAI(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Use sample event" }).click();
  for (const tab of ["Overview", "Budget", "Timeline", "Vendors"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  }
  await page.getByRole("link", { name: "What changed?" }).click();
  await expectNoHorizontalScroll(page);
  await page.goto("/intake");
  await expectNoHorizontalScroll(page);
});

test("forced colours, more contrast and reduced motion: still usable and axe-clean", async ({
  page,
}) => {
  await interceptAI(page);
  await page.emulateMedia({ forcedColors: "active", contrast: "more", reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Use sample event" }).click();
  await expectNoAxeViolations(page);
  const bar = page.getByRole("progressbar", { name: "Tasks done" });
  await expect(bar).toHaveCSS("border-top-style", "solid");
  await page.getByRole("tab", { name: "Budget" }).click();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Accessibility" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Accessibility" })).toBeVisible();
  await expectNoAxeViolations(page);
});
