import React from "react";
import { ScheduleItem } from "../../../types";
import BudgetDashboard from "./BudgetDashboard";
import DailyExpense from "./DailyExpense";

interface Props {
  selectedDate: string;
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
  isSummaryMode?: boolean;
  displayData: Record<string, ScheduleItem[]>;
  sharedRooms?: { [layerName: string]: string }; // 🌟 1. ここに型定義を追加！
  roomWishes?: Record<string, any[]>; // 🌟 追加！
  safeDebouncedSyncWish?: (wish: any, roomId: string) => void; // 🌟 追加！
  safeDebouncedSync?: (item: any, date: string) => void;
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
  displayData,
  sharedRooms,
  roomWishes,
  safeDebouncedSyncWish,
  safeDebouncedSync,
}: Props) {
  if (isSummaryMode) {
    return (
      <BudgetDashboard
        selectedDate={selectedDate}
        activeTags={activeTags}
        setHasUnsavedChanges={setHasUnsavedChanges}
        displayData={displayData}
        sharedRooms={sharedRooms} // 🌟 2. 欲しいものリストがあるBudgetDashboardに渡す！
        roomWishes={roomWishes}
        safeDebouncedSyncWish={safeDebouncedSyncWish}
      />
    );
  }

  return (
    <DailyExpense
      selectedDate={selectedDate}
      activeTags={activeTags}
      setHasUnsavedChanges={setHasUnsavedChanges}
      displayData={displayData}
      sharedRooms={sharedRooms} // 🌟 復活！
      safeDebouncedSync={safeDebouncedSync} // 🌟 追加！
      // 🌟 3. DailyExpenseには不要なので削除（エラー防止）
    />
  );
}
