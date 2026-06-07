import React from "react";
import { ScheduleItem } from "../../../types";
import BudgetDashboard from "./BudgetDashboard";
import DailyExpense from "./DailyExpense";

interface Props {
  selectedDate: string;
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
  isSummaryMode?: boolean;
  displayData: Record<string, ScheduleItem[]>;}

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
  displayData
}: Props) {
  if (isSummaryMode) {
    return (
      <BudgetDashboard selectedDate={selectedDate} activeTags={activeTags} setHasUnsavedChanges={setHasUnsavedChanges}displayData={displayData}/>
    );
  }

  return (
    <DailyExpense
      selectedDate={selectedDate}
      activeTags={activeTags}
      setHasUnsavedChanges={setHasUnsavedChanges}
      displayData={displayData}
    />
  );
}
