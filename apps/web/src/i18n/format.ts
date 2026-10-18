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
    // Short day and month for cards ("28 Oct", "28. Okt.", "10月28日").
    dayMonth: (value: Date | string) =>
      format.dateTime(new Date(value), { day: "numeric", month: "short" }),
    relative: (value: Date | string) => format.relativeTime(new Date(value)),
  };
}
