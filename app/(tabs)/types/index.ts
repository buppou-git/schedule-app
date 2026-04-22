// types/index.ts

// 🌟 サブタスクの型定義
export interface SubTask {
  id: number;
  title: string;
  date: Date; // または string（API通信後など）
  hasDateTime?: boolean;
  amount: number;
  isExpense: boolean;
  category?: string;
  endTime?: Date; // または string
  reminderOption?: string;
  notificationId?: string;
  isDone?: boolean;
}

// 🌟 メインの予定・タスク・支出の型定義
export interface ScheduleItem {
  id: string;
  title: string;
  tag?: string; // 過去の互換性用
  tags?: string[]; // 現在のメイン属性
  amount: number;
  isDone: boolean;
  color: string;
  isEvent: boolean;
  isTodo: boolean;
  isExpense: boolean;
  category?: string;
  recurringGroupId?: string;
  isAllDay?: boolean;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  notificationIds?: string[];
  reminderOptions?: string[];
  customReminderTimes?: string[];
  completedDates?: string[]; // 完了した日付のリスト
  exceptionDates?: string[]; // 繰り返しから除外する日付
  linkedMasterId?: string;
  subTasks?: SubTask[];
  repeatType?: "none" | "daily" | "weekly" | "monthly" | "custom";
  repeatDays?: number[]; // [1, 2, 3, 4, 5] (月〜金) など
  repeatInterval?: number;
}

// 🌟 タグとレイヤーのマスターデータの型定義
export interface TagMasterInfo {
  layer: string;
  color: string;
}

export interface TagMaster {
  [tagName: string]: TagMasterInfo;
}

export interface LayerMaster {
  [layerName: string]: string; // 値は色（Hexコード）
}

// 🌟 日付をキーにしたスケジュール全体のデータ構造
export interface ScheduleData {
  [dateString: string]: ScheduleItem[];
}
