// En un archivo utils/date.utils.ts
export const normalizeToMidnight = (dateStr: string): string => {
  const date = new Date(dateStr);
  const normalized = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  return normalized.toISOString().slice(0, 19).replace('T', ' ');
};