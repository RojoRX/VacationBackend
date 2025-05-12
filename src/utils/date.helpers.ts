import { DateTime } from "luxon";

/** Verifica si un periodo tiene al menos 1 día de duración */
export function isValidPeriod(start: DateTime, end: DateTime): boolean {
  return start < end && start.startOf('day') < end.startOf('day');
}

/** Ajusta el fin del periodo para no exceder límites */
export function adjustPeriodEnd(periodEnd: DateTime, endLimit: DateTime, now: DateTime): DateTime {
  return DateTime.min(periodEnd, endLimit, now);
}

/** Formatea Date o string a YYYY-MM-DD */
export function formatToSimpleDate(date: Date | string): string {
  return DateTime.fromJSDate(new Date(date)).toISODate();
}

/** Convierte una fecha JS a DateTime UTC con hora 00:00 */
export function parseToStartOfDay(date: Date): Date {
  return DateTime.fromJSDate(date).startOf("day").toJSDate();
}
