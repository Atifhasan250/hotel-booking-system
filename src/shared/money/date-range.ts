/**
 * Shared date-range utilities.
 * All dates are YYYY-MM-DD strings (local calendar semantics).
 * No timezone arithmetic — callers supply property-local dates.
 */

/** Expand [checkIn, checkOut) into the nightly local date strings. */
export function expandNights(checkInDate: string, checkOutDate: string): string[] {
  const nights: string[] = [];
  const cur = new Date(`${checkInDate}T00:00:00Z`);
  const end = new Date(`${checkOutDate}T00:00:00Z`);

  if (end <= cur) return nights;

  while (cur < end) {
    nights.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return nights;
}

/** Number of nights between two local date strings (checkout - checkin). */
export function countNights(checkInDate: string, checkOutDate: string): number {
  const msPerDay = 86_400_000;
  return (
    (new Date(`${checkOutDate}T00:00:00Z`).getTime() -
      new Date(`${checkInDate}T00:00:00Z`).getTime()) /
    msPerDay
  );
}

/** Return all YYYY-MM-DD strings in [startDate, endDate] inclusive. */
export function expandDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}
