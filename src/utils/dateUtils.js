import dayjs from 'dayjs';

/** Format date as YYYY-MM-DD in local timezone (avoids UTC ISO off-by-one). */
export function formatLocalDateString(value) {
  if (value == null || value === '') return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
}
