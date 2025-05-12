// src/utils/dateUtils.ts
import { DateTime } from 'luxon';

export function formatToSimpleDate(date: Date | string | DateTime): string {
  let dt: DateTime;
  
  if (date instanceof Date) {
    dt = DateTime.fromJSDate(date).toUTC();
  } else if (typeof date === 'string') {
    dt = DateTime.fromISO(date).toUTC();
  } else if (date instanceof DateTime) {
    dt = date.toUTC();
  } else {
    throw new Error('Tipo de fecha no soportado');
  }

  return dt.toFormat('yyyy-MM-dd');
}

export function parseToStartOfDay(date: Date | string): Date {
  const dateStr = formatToSimpleDate(date);
  return new Date(`${dateStr}T00:00:00Z`);
}