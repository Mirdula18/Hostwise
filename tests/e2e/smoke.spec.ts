import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalScroll, interceptAI } from "./helpers";

test("headline journey: sample → budget edit → add 20 guests → apply → undo → delay", async ({
  page,
}) => {
  const tasks = await interceptAI(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Your celebrations" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Use sample event" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("35th Anniversary");
  await expect(page.getByRole("heading", { name: "What I assumed" })).toBeVisible();
  await expectNoAxeViolations(page);

  // Budget: raise catering and rebalance by priority.
  await page.getByRole("tab", { name: "Budget" }).click();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Edit Catering" }).click();
  const edit = page.getByRole("dialog", { name: "Edit Catering" });
  await edit.getByLabel(/Amount for Catering/).fill("120000");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toBeHidden();
  const catering = page.getByRole("listitem", { name: "Catering" });
  await expect(catering.getByRole("button", { name: "Your number" })).toBeVisible();
  await expect(catering).toContainText("₹1,20,000");

  // Change: "add 20 guests" → ranked options → preview → apply.
  await page.getByRole("link", { name: "What changed?" }).click();
  await expectNoAxeViolations(page);
  await page.getByLabel("What changed?").fill("add 20 guests");
  await page.getByRole("button", { name: "Work out the impact" }).click();
  const options = page.getByRole("region", { name: "Your options" });
  await expect(options.getByRole("listitem").first()).toContainText("Recommended");
  await expect(options.getByRole("listitem").first()).toContainText("Food is your top priority");
  await expectNoAxeViolations(page);
  await options.getByRole("button", { name: "Preview this option" }).first().click();
  await expect(page.getByRole("table", { name: "Budget before and after" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Apply this change" }).click();

  await expect(page.getByText("80 guests", { exact: true })).toBeVisible();
  await expect(page.getByText(/Guests 60 → 80/)).toBeVisible();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("60 guests", { exact: true })).toBeVisible();
  expect(tasks).toEqual(["parse_change", "rank_options"]);

  // Timeline: the caterer is 5 days late.
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Delay Book the caterer" }).click();
  const delay = page.getByRole("dialog", { name: 'Delay "Book the caterer"' });
  await delay.getByLabel(/how many days/).fill("5");
  await expect(delay.getByText(/tasks will move/)).toBeVisible();
  await expectNoAxeViolations(page);
  await delay.getByRole("button", { name: "Apply delay" }).click();
  await expect(page.getByText("Delayed 5 days")).toBeVisible();

  // Vendors: draft questions and compare quotes.
  await page.getByRole("tab", { name: "Vendors" }).click();
  await expect(page.getByRole("table", { name: /Catering quotes compared/ })).toBeVisible();
  await page.getByRole("button", { name: "Draft questions to ask Annapurna Caterers" }).click();
  await expect(page.getByText(/fully vegetarian menu/)).toBeVisible();
  await expectNoAxeViolations(page);
});

test("works at 360 px with no horizontal scroll, and deep links load", async ({ page }) => {
  await interceptAI(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Use sample event" }).click();
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  for (const tab of ["Budget", "Timeline", "Vendors"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expectNoHorizontalScroll(page);
  }
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("35th Anniversary");
  await page.goto("/event/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("keyboard only: skip link, tabs with arrow keys", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByRole("button", { name: "Use sample event" }).press("Enter");
  await page.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Budget" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
});
