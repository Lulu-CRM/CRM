"use client";

import { useFormatter } from "next-intl";

export type Money = { amount: number; currency: string };

// Dates, numbers and money always go through Intl so they follow the user's language.
export function useFormat() {
  const format = useFormatter();

  return {
    money: (value: Money) =>
      format.number(value.amount, {
        style: "currency",
        currency: value.currency,
        maximumFractionDigits: 0,
      }),
    number: (value: number) => format.number(value),
    percent: (value: number) => format.number(value, { style: "percent" }),
    date: (value: Date | string) =>
      format.dateTime(new Date(value), { dateStyle: "medium" }),
    relative: (value: Date | string) => format.relativeTime(new Date(value), new Date()),
    // "2 hours ago" for the last week, then a short date and time.
    recent: (value: Date | string) => {
      const date = new Date(value);
      const week = 7 * 24 * 60 * 60 * 1000;
      return Date.now() - date.getTime() < week
        ? format.relativeTime(date, new Date())
        : format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
    },
  };
}
