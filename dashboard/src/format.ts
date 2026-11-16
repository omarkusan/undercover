import type { ClaimStatus, Decision } from "./api";

export const STATES: ClaimStatus[] = [
  "waiting",
  "in_progress",
  "waiting_for_sign_off",
  "decided",
];

export const statusLabels: Record<ClaimStatus, string> = {
  waiting: "Waiting",
  in_progress: "In progress",
  waiting_for_sign_off: "Waiting for sign-off",
  decided: "Decided",
};

export const decisionLabels: Record<Decision, string> = {
  approve: "Approve",
  decline: "Decline",
  refer: "Refer",
};

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const calendarDay = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const moment = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const clock = new Intl.DateTimeFormat("en-US", { timeStyle: "medium" });

export function money(amount: number): string {
  return dollars.format(amount);
}

/** A calendar date such as 2026-06-24, shown as Jun 24, 2026. */
export function day(isoDate: string): string {
  return calendarDay.format(new Date(isoDate));
}

/** A timestamp shown as a local date and time. */
export function dateTime(timestamp: string): string {
  return moment.format(new Date(timestamp));
}

/** A timestamp shown as a local time of day. */
export function time(timestamp: string): string {
  return clock.format(new Date(timestamp));
}

/** A key such as trip_delay, shown as Trip delay. */
export function words(key: string): string {
  const text = key.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
