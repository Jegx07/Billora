/**
 * Timezone-aware, calendar-accurate billing date calculator for Billora.
 * Rules:
 * - Never add 30 days for monthly renewals.
 * - Preserve anchorBillingDay (1..31) across month-end clamping (e.g. Jan 31 -> Feb 28/29 -> Mar 31).
 * - Handle leap years accurately (e.g. Feb 29, 2024 + 1 year -> Feb 28, 2025; + 4 years -> Feb 29, 2028).
 * - Store UTC timestamps while respecting business timezone calendar dates.
 */

export type BillingFrequencyType = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[monthZeroIndexed];
}

/**
 * Extracts year, month (0..11), day (1..31) in the target IANA timezone (default UTC for deterministic math, or Asia/Kolkata).
 */
export function getCalendarPartsInTz(date: Date, timeZone = "UTC"): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  if (timeZone === "UTC") {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hours: date.getUTCHours(),
      minutes: date.getUTCMinutes(),
      seconds: date.getUTCSeconds(),
    };
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = parseInt(p.value, 10);
  }
  return {
    year: map.year,
    month: (map.month ?? 1) - 1,
    day: map.day ?? 1,
    hours: map.hour === 24 ? 0 : (map.hour ?? 0),
    minutes: map.minute ?? 0,
    seconds: map.second ?? 0,
  };
}

/**
 * Adds `monthsToAdd` calendar months while clamping to the month's last valid day using `anchorDay`.
 * Example: Jan 31 (anchorDay=31) + 1 month -> Feb 28 (or Feb 29 in leap year).
 *          Feb 28 (anchorDay=31) + 1 month -> Mar 31.
 */
export function addMonthsClamped(
  baseDate: Date,
  monthsToAdd: number,
  anchorDay?: number
): Date {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const targetAnchor = anchorDay ?? baseDate.getUTCDate();

  const totalMonths = year * 12 + month + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const maxDay = getDaysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(targetAnchor, maxDay);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      clampedDay,
      baseDate.getUTCHours(),
      baseDate.getUTCMinutes(),
      baseDate.getUTCSeconds(),
      baseDate.getUTCMilliseconds()
    )
  );
}

/**
 * Adds `yearsToAdd` calendar years while clamping Feb 29 -> Feb 28 on non-leap years.
 */
export function addYearsClamped(
  baseDate: Date,
  yearsToAdd: number,
  anchorDay?: number
): Date {
  return addMonthsClamped(baseDate, yearsToAdd * 12, anchorDay ?? baseDate.getUTCDate());
}

/**
 * Calculates the next billing date given a current period start date, billing frequency, and anchor billing day.
 */
export function calculateNextBillingDate(
  currentPeriodStart: Date,
  frequency: BillingFrequencyType,
  anchorDay?: number,
  intervals = 1
): Date {
  const anchor = anchorDay ?? currentPeriodStart.getUTCDate();

  switch (frequency) {
    case "DAILY": {
      const next = new Date(currentPeriodStart.getTime());
      next.setUTCDate(next.getUTCDate() + 1 * intervals);
      return next;
    }
    case "WEEKLY": {
      const next = new Date(currentPeriodStart.getTime());
      next.setUTCDate(next.getUTCDate() + 7 * intervals);
      return next;
    }
    case "MONTHLY": {
      return addMonthsClamped(currentPeriodStart, 1 * intervals, anchor);
    }
    case "YEARLY": {
      return addYearsClamped(currentPeriodStart, 1 * intervals, anchor);
    }
    default:
      throw new Error(`Unsupported billing frequency: ${frequency}`);
  }
}

/**
 *Deterministic idempotency key for a subscription billing period.
 */
export function buildBillingIdempotencyKey(
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date
): string {
  const s = periodStart.toISOString().slice(0, 10);
  const e = periodEnd.toISOString().slice(0, 10);
  return `bill_${subscriptionId}_${s}_${e}`;
}
