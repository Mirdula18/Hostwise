import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** WCAG 2.0–2.2 A and AA rules plus axe best practices. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const fixture = (task: string) =>
  readFileSync(join(process.cwd(), "tests", "fixtures", "ai", `${task}.json`), "utf8");

/** Every /api/gemini call is answered from a fixture; the real API is never reached. */
export async function interceptAI(page: Page) {
  const tasks: string[] = [];
  await page.route("**/api/gemini", async (route) => {
    const body: unknown = route.request().postDataJSON();
    const task =
      typeof body === "object" && body !== null && "task" in body ? String(body.task) : "";
    tasks.push(task);
    await route.fulfill({ status: 200, contentType: "application/json", body: fixture(task) });
  });
  return tasks;
}

/** Simulates the assistant being down: every AI call returns 503. */
export async function failAI(page: Page) {
  await page.route("**/api/gemini", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "not_configured", message: "Unavailable" } }),
    }),
  );
}

/** Fails the test with the list of axe violations (rule id and help text). */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** Fails when the page scrolls sideways (WCAG 1.4.10 Reflow). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** A `yyyy-MM-dd` date `days` from today, for date inputs. */
export function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
