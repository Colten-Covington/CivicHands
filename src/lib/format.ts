const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
const dateTimeFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago", timeZoneName: "short" });

/** Formats ISO dates; sample-data labels like "Today" pass through unchanged. */
export function formatWhen(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormat.format(date);
}

export function formatDateTime(value: Date) {
  return dateTimeFormat.format(value);
}
