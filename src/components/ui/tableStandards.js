/**
 * Standard layout for wide data tables (6+ columns):
 * - Parent container: width 100% + overflowX auto (scroll, don't squish)
 * - Table: width max-content, tableLayout auto
 * - Every column: explicit minWidth; fixed cols also get width + maxWidth
 * - flex only on variable long-text columns (no maxWidth)
 * - Text cells: TruncatedText for ellipsis + hover tooltip
 */

export const HORIZONTAL_SCROLL_CONTAINER_SX = {
  width: '100%',
  overflowX: 'auto',
  overflowY: 'auto',
};

export const HORIZONTAL_SCROLL_TABLE_SX = {
  tableLayout: 'auto',
  width: 'max-content',
  minWidth: '100%',
};

export function fixedColumnSx(width) {
  return {
    width,
    minWidth: width,
    maxWidth: width,
    boxSizing: 'border-box',
  };
}

export function flexColumnSx(minWidth) {
  return {
    minWidth,
    width: 'auto',
  };
}

export function columnCellSx(width, { flex = false } = {}) {
  return flex ? flexColumnSx(width) : fixedColumnSx(width);
}
