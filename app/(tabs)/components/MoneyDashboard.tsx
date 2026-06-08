import React from "react";
import { ScheduleItem } from "../../../types"; // 🌟 必要に応じてWishItemのインポートも確認してください
import BudgetDashboard from "./BudgetDashboard";
import DailyExpense from "./DailyExpense";

// 🌟 もしtypes等に共通化されていればそれをインポート、なければここで簡易的に型合わせします
interface WishItem {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  icon: string;
  color: string;
  sharedRoomId?: string;
  [key: string]: any;
}

interface Props {
  selectedDate: string;
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
  isSummaryMode?: boolean;
  displayData: Record<string, ScheduleItem[]>;
  sharedRooms?: { [layerName: string]: string }; 
  roomWishes?: Record<string, WishItem[]>; // 🌟 any[] から WishItem[] に修正！
  safeDebouncedSyncWish?: (wish: WishItem, roomId: string) => void; // 🌟 wish: any から wish: WishItem に修正！
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
        sharedRooms={sharedRooms} 
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
      sharedRooms={sharedRooms} 
      safeDebouncedSync={safeDebouncedSync} 
    />
  );
}