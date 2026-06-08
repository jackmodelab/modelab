import { format } from 'date-fns';

/** Brand standard: DD MMM YYYY, e.g. 01 Apr 2026 */
export function formatDate(value: string | Date): string {
  return format(new Date(value), 'dd MMM yyyy');
}

/** e.g. 01 Apr 2026 · 9:30 AM */
export function formatDateTime(value: string | Date): string {
  return format(new Date(value), 'dd MMM yyyy · h:mm a');
}

/** e.g. 9:30 AM */
export function formatTime(value: string | Date): string {
  return format(new Date(value), 'h:mm a');
}

/** cents → $80 (no trailing .00) or $38.50 */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

const BOOKING_LABELS: Record<string, string> = {
  pending: 'Awaiting trainer',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled_24hr_plus: 'Cancelled',
  cancelled_under_24hr: 'Late cancel',
  no_show: 'No-show',
  rescheduled: 'Rescheduled',
};

export function bookingStatusLabel(status: string): string {
  return BOOKING_LABELS[status] ?? status;
}
