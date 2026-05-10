"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type Period = "day" | "week" | "month";

interface PeriodContextType {
  period: Period;
  setPeriod: (p: Period) => void;
  periodLabel: string;
}

const PeriodContext = createContext<PeriodContextType>({
  period: "day",
  setPeriod: () => {},
  periodLabel: "Hari Ini",
});

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>("day");

  const periodLabel = {
    day: "Hari Ini",
    week: "7 Hari Terakhir",
    month: "30 Hari Terakhir",
  }[period];

  return (
    <PeriodContext.Provider value={{ period, setPeriod, periodLabel }}>
      {children}
    </PeriodContext.Provider>
  );
}

export const usePeriod = () => useContext(PeriodContext);
