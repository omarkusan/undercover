import { expect, it } from "vitest";
import { dateTime, day, money, time, words } from "./format";

it("shows money in US dollars", () => {
  expect(money(1250)).toBe("$1,250.00");
  expect(money(0)).toBe("$0.00");
});

it("shows a calendar date as written in the US", () => {
  expect(day("2026-06-24")).toBe("Jun 24, 2026");
});

it("shows timestamps as a date and time", () => {
  expect(dateTime("2026-11-15T18:00:00+00:00")).toMatch(/^Nov 1[56], 2026, \d/);
  expect(time("2026-11-15T18:00:05+00:00")).toMatch(/^\d{1,2}:\d{2}:05 [AP]M$/);
});

it("turns keys into words", () => {
  expect(words("emergency_medical")).toBe("Emergency medical");
});
