import React from "react";
import BudgetDashboard from "./BudgetDashboard";
import DailyExpense from "./DailyExpense";

interface Props {
  selectedDate: string;
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
  isSummaryMode?: boolean;
}

/**
 * MoneyDashboard
 * 家計簿のトップコンポーネント。
 * モードに応じて「予算管理（Budget）」と「日別詳細（Daily）」を切り替えるだけの交通整理役です。
 */
export default function MoneyDashboard({
  selectedDate,
  activeTags,
  setHasUnsavedChanges,
  isSummaryMode,
}: Props) {
  if (isSummaryMode) {
    return (
      <BudgetDashboard selectedDate={selectedDate} activeTags={activeTags} setHasUnsavedChanges={setHasUnsavedChanges}/>
    );
  }

  return (
    <DailyExpense
      selectedDate={selectedDate}
      activeTags={activeTags}
      setHasUnsavedChanges={setHasUnsavedChanges}
    />
  );
}
