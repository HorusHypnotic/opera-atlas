import { createContext, useContext, useState } from "react";

export type PeriodFilter = "7d" | "15d" | "30d" | "all";

interface PeriodFilterContextType {
  period: PeriodFilter;
  setPeriod: (p: PeriodFilter) => void;
  getDateFrom: () => string | null;
}

const PeriodFilterContext = createContext<PeriodFilterContextType | undefined>(undefined);

export { PeriodFilterContext };

export function usePeriodFilter() {
  const ctx = useContext(PeriodFilterContext);
  if (!ctx) {
    // Fallback: return a default so components work without provider
    return {
      period: "30d" as PeriodFilter,
      setPeriod: () => {},
      getDateFrom: () => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().substring(0, 10);
      },
    };
  }
  return ctx;
}

export function createPeriodFilter(period: PeriodFilter) {
  const getDateFrom = (): string | null => {
    if (period === "all") return null;
    const days = period === "7d" ? 7 : period === "15d" ? 15 : 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().substring(0, 10);
  };
  return { period, getDateFrom };
}

/** Filter an array by a date field using the current period */
export function filterByPeriod<T>(items: T[], dateField: string, period: PeriodFilter): T[] {
  if (period === "all") return items;
  const days = period === "7d" ? 7 : period === "15d" ? 15 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  return items.filter((item: any) => {
    const val = item[dateField];
    return val && val >= cutoffStr;
  });
}
