const MONTH_INITIALS = Object.freeze([
  '',
  'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D',
]);

const MONTH_ABBREVIATIONS = Object.freeze([
  '',
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

const MONTH_NAME_TO_NUMBER = Object.freeze({
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
});

const LEGACY_GROUPED_MONTHS_PATTERN = /^(\d{2}(?:-\d{2})+)\s+\((\d{4})\)$/;
const LEGACY_MONTHLY_PATTERN = /^(\d{2})-(\d{4})$/;
const MONTHLY_NAME_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i;
const YEAR_RANGE_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+[–-]\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i;
const FINANCIAL_YEAR_PATTERN = /^FY\s+(\d{4})-(\d{4})\s+\(Starts\s+[A-Za-z]{3}\)$/;
const DISPLAY_WITH_FY_PATTERN = /^(.+?)\s+\(FY\s+([^)]+)\)$/;

const DEFAULT_FY_START_MONTH = 4;

function resolveFyStartMonth(fyStartMonth) {
  const value = Number(fyStartMonth);
  if (Number.isInteger(value) && value >= 1 && value <= 12) {
    return value;
  }
  return DEFAULT_FY_START_MONTH;
}

function groupedMonthsToInitials(monthTokenString) {
  return monthTokenString
    .split('-')
    .map((token) => {
      const monthNumber = Number.parseInt(token, 10);
      return Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12
        ? MONTH_INITIALS[monthNumber]
        : null;
    })
    .filter(Boolean)
    .join('');
}

export function calculateFinancialYearBoundary(calendarMonth, calendarYear, fyStartMonth) {
  const resolvedFyStartMonth = resolveFyStartMonth(fyStartMonth);

  if (resolvedFyStartMonth === 1) {
    return { fyStartYear: calendarYear, fyEndYear: calendarYear };
  }
  if (calendarMonth >= resolvedFyStartMonth) {
    return { fyStartYear: calendarYear, fyEndYear: calendarYear + 1 };
  }
  return { fyStartYear: calendarYear - 1, fyEndYear: calendarYear };
}

export function formatFinancialYearLabel(fyStartYear, fyEndYear, fyStartMonth) {
  if (fyStartYear == null || fyEndYear == null) {
    return '';
  }
  const startYy = String(fyStartYear % 100).padStart(2, '0');
  if (resolveFyStartMonth(fyStartMonth) === 1) {
    return startYy;
  }
  const endYy = String(fyEndYear % 100).padStart(2, '0');
  return `${startYy}-${endYy}`;
}

function formatFinancialYearSuffix(calendarMonth, calendarYear, fyStartMonth) {
  const { fyStartYear, fyEndYear } = calculateFinancialYearBoundary(
    calendarMonth,
    calendarYear,
    fyStartMonth,
  );
  const label = formatFinancialYearLabel(fyStartYear, fyEndYear, fyStartMonth);
  return label ? `(FY ${label})` : '';
}

function parseDisplayAnchor(backendString, anchorMonth, anchorYear) {
  if (Number.isInteger(anchorMonth) && Number.isInteger(anchorYear)) {
    return { calendarMonth: anchorMonth, calendarYear: anchorYear };
  }

  const trimmed = String(backendString).trim();

  const monthlyNameMatch = MONTHLY_NAME_PATTERN.exec(trimmed);
  if (monthlyNameMatch) {
    const month = MONTH_NAME_TO_NUMBER[monthlyNameMatch[1][0].toUpperCase() + monthlyNameMatch[1].slice(1).toLowerCase()];
    if (month) {
      return {
        calendarMonth: month,
        calendarYear: Number.parseInt(monthlyNameMatch[2], 10),
      };
    }
  }

  const legacyMonthlyMatch = LEGACY_MONTHLY_PATTERN.exec(trimmed);
  if (legacyMonthlyMatch) {
    return {
      calendarMonth: Number.parseInt(legacyMonthlyMatch[1], 10),
      calendarYear: Number.parseInt(legacyMonthlyMatch[2], 10),
    };
  }

  const yearRangeMatch = YEAR_RANGE_PATTERN.exec(trimmed);
  if (yearRangeMatch) {
    const monthKey = yearRangeMatch[1][0].toUpperCase() + yearRangeMatch[1].slice(1).toLowerCase();
    const month = MONTH_NAME_TO_NUMBER[monthKey];
    if (month) {
      return {
        calendarMonth: month,
        calendarYear: Number.parseInt(yearRangeMatch[2], 10),
      };
    }
  }

  const legacyGroupedMatch = LEGACY_GROUPED_MONTHS_PATTERN.exec(trimmed);
  if (legacyGroupedMatch) {
    return {
      calendarMonth: Number.parseInt(legacyGroupedMatch[1].slice(0, 2), 10),
      calendarYear: Number.parseInt(legacyGroupedMatch[2], 10),
    };
  }

  return null;
}

function toBaseDisplayName(backendString) {
  const trimmed = String(backendString).trim();

  const legacyGroupedMatch = LEGACY_GROUPED_MONTHS_PATTERN.exec(trimmed);
  if (legacyGroupedMatch) {
    return groupedMonthsToInitials(legacyGroupedMatch[1]);
  }

  const legacyMonthlyMatch = LEGACY_MONTHLY_PATTERN.exec(trimmed);
  if (legacyMonthlyMatch) {
    const month = Number.parseInt(legacyMonthlyMatch[1], 10);
    const year = Number.parseInt(legacyMonthlyMatch[2], 10);
    if (month >= 1 && month <= 12) {
      return `${MONTH_ABBREVIATIONS[month]} ${year}`;
    }
  }

  const withFy = DISPLAY_WITH_FY_PATTERN.exec(trimmed);
  if (withFy) {
    return withFy[1].trim();
  }

  return trimmed;
}

/**
 * Append agreement-specific FY suffix to absolute DB base names.
 * Examples: "Jan 2026" → "Jan 2026 (FY 26-27)"; "AMJ" + anchor → "AMJ (FY 26-27)".
 *
 * @param {string} backendString absolute base name from DB
 * @param {number} [fyStartMonth=4] agreement financial year start month
 * @param {{ calendarMonth?: number, calendarYear?: number, monthNumber?: number, periodYear?: number }} [anchor]
 */
export function formatTimePeriodBaseName(backendString) {
  if (backendString == null || backendString === '') return '';
  const trimmed = String(backendString).trim();
  if (!trimmed || trimmed === 'ONE_TIME' || FINANCIAL_YEAR_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return toBaseDisplayName(trimmed);
}

export const formatTimePeriodDisplay = (
  backendString,
  fyStartMonth = DEFAULT_FY_START_MONTH,
  anchor = null,
) => {
  if (backendString == null || backendString === '') return '';
  const trimmed = String(backendString).trim();
  if (!trimmed) return '';

  if (trimmed === 'ONE_TIME' || FINANCIAL_YEAR_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const existingFyMatch = DISPLAY_WITH_FY_PATTERN.exec(trimmed);
  const baseName = toBaseDisplayName(trimmed);
  const resolvedAnchor = parseDisplayAnchor(
    existingFyMatch ? existingFyMatch[1].trim() : trimmed,
    Number(anchor?.calendarMonth ?? anchor?.monthNumber),
    Number(anchor?.calendarYear ?? anchor?.periodYear),
  );

  if (!resolvedAnchor) {
    // Initials-only needs absolute month anchor; keep prior FY suffix if already display-formatted.
    if (existingFyMatch) {
      return `${baseName} (FY ${existingFyMatch[2]})`.trim();
    }
    return baseName;
  }

  const fySuffix = formatFinancialYearSuffix(
    resolvedAnchor.calendarMonth,
    resolvedAnchor.calendarYear,
    fyStartMonth,
  );

  return fySuffix ? `${baseName} ${fySuffix}`.trim() : baseName;
};
