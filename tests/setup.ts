import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

expect.extend(axeMatchers);

afterEach(() => {
  cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
});

// axe probes <canvas> for colour-contrast; jsdom has no canvas, so report "unsupported" quietly.
if (typeof HTMLCanvasElement !== "undefined") HTMLCanvasElement.prototype.getContext = () => null;
