// store/useAppStore.ts
import { create } from "zustand";
import { LayerMaster, ScheduleData, TagMaster } from "../types";

// 🌟 1. 倉庫（Store）に保管するデータと、それを操作する関数の型を定義
interface AppState {
  scheduleData: ScheduleData;
  layerMaster: LayerMaster;
  tagMaster: TagMaster;
  activeMode: string; // "calendar" | "todo" | "money"

  // データを更新するための関数たち
  setScheduleData: (data: ScheduleData) => void;
  setLayerMaster: (data: LayerMaster) => void;
  setTagMaster: (data: TagMaster) => void;
  setActiveMode: (mode: string) => void;
}

// 🌟 2. 実際の倉庫（Store）を作成！
export const useAppStore = create<AppState>((set) => ({
  // 初期値
  scheduleData: {},
  layerMaster: {},
  tagMaster: {},
  activeMode: "calendar",

  // 更新用の関数（set関数を呼ぶだけで、アプリ全体が自動で再描画されます）
  setScheduleData: (data) => set({ scheduleData: data }),
  setLayerMaster: (data) => set({ layerMaster: data }),
  setTagMaster: (data) => set({ tagMaster: data }),
  setActiveMode: (mode) => set({ activeMode: mode }),
}));
