/**
 * Chart extraction stub — chart features removed from Agent Farm.
 */

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'candle' | 'tv';
  title?: string;
  symbol?: string;
  interval?: string;
  data: {
    labels: string[];
    values?: number[];
    series?: { name: string; values: number[] }[];
    candles?: Array<{ open: number; high: number; low: number; close: number }>;
  };
}

/** No-op chart extraction — always returns empty array. */
export function extractChartMarkers(_text: string): { charts: ChartData[]; cleanText: string } {
  return { charts: [], cleanText: _text };
}
