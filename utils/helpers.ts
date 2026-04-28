import { ScheduleItem } from "../types";

// 🌟 支出の合計を計算する共通ロジック
export const getItemTotalExpense = (item: ScheduleItem) => {
  let total = item.isExpense ? item.amount || 0 : 0;
  if (item.subTasks && item.subTasks.length > 0) {
    item.subTasks.forEach((sub) => {
      if (sub.isExpense && sub.isDone) total += sub.amount || 0;
    });
  }
  return total;
};

// 🌟 収入の合計を計算する共通ロジック
export const getItemTotalIncome = (item: ScheduleItem) => {
  let total = item.isIncome ? item.amount || 0 : 0;
  if (item.subTasks && item.subTasks.length > 0) {
    item.subTasks.forEach((sub) => {
      if (sub.isIncome && sub.isDone) total += sub.amount || 0;
    });
  }
  return total;
};

// 🌟 サブカテゴリ追加時などに使う共通カラーパレット
export const PRESET_COLORS = [
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#00C7BE",
  "#32ADE6", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#A2845E",
];

// 🌟 円グラフ描画用のカラーパレット
export const CHART_PALETTE = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#F9CA24", "#6AB04C", "#E056FD", "#FFBE76"
];