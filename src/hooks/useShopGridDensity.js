import { useCallback, useState } from 'react';

const STORAGE_KEY = 'velvet-shop-grid-cols';
const DEFAULT_COLS = 4;
const MIN_COLS = 2;
const MAX_COLS = 4;

function readStoredCols() {
  try {
    const value = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (value >= MIN_COLS && value <= MAX_COLS) return value;
  } catch {
    /* ignore */
  }
  return DEFAULT_COLS;
}

export function useShopGridDensity() {
  const [gridCols, setGridColsState] = useState(readStoredCols);

  const setGridCols = useCallback((cols) => {
    const next = Math.min(MAX_COLS, Math.max(MIN_COLS, cols));
    setGridColsState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  return { gridCols, setGridCols, minCols: MIN_COLS, maxCols: MAX_COLS };
}

export { STORAGE_KEY as SHOP_GRID_DENSITY_KEY, DEFAULT_COLS as SHOP_GRID_DEFAULT_COLS };
