import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
// ※ auth と db のパスは、ご自身の環境に合わせて修正してください
import { auth, db } from "../app/(tabs)/firebaseConfig";

// 🌟 index.tsx にあった型定義をここに引っ越し！
export interface ScheduleItem {
  id: string;
  title: string;
  tag?: string;
  tags?: string[];
  amount: number;
  isDone: boolean;
  color: string;
  isEvent: boolean;
  isTodo: boolean;
  isExpense: boolean;
  category?: string;
  recurringGroupId?: string;
  repeatType?: "daily" | "weekly" | "monthly";
  isAllDay?: boolean;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

export const useScheduleManager = () => {
  const [scheduleData, setScheduleState] = useState<{
    [key: string]: ScheduleItem[];
  }>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // 1. アプリ起動時にローカルデータ（スマホ本体）から読み込む
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const storedData = await AsyncStorage.getItem("scheduleData");
        if (storedData) {
          setScheduleState(JSON.parse(storedData));
        }
        const syncedAt = await AsyncStorage.getItem("lastSyncedAt");
        if (syncedAt) setLastSyncedAt(syncedAt);
      } catch (error) {
        console.error("ローカルデータの読み込みに失敗しました:", error);
      }
    };
    loadInitialData();
  }, []);

  // 2. データを更新した時に、スマホ本体とFirebaseの両方に保存する魔法の関数
  const setScheduleData = async (newData: {
    [key: string]: ScheduleItem[];
  }) => {
    // 画面の表示を即座に更新する（サクサク感を維持）
    setScheduleState(newData);

    try {
      // ローカル（スマホ本体）に保存
      await AsyncStorage.setItem("scheduleData", JSON.stringify(newData));

      // クラウド（Firebase）に同期
      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const now = new Date().toISOString();

        // merge: true をつけることで、他のデータ（タグ設定など）を消さずに上書きできます
        await setDoc(
          userRef,
          { scheduleData: newData, lastSyncedAt: now },
          { merge: true },
        );

        setLastSyncedAt(now);
        await AsyncStorage.setItem("lastSyncedAt", now);
      }
    } catch (error) {
      console.error("データの保存に失敗しました:", error);
    }
  };

  // index.tsx からは、この3つだけを呼び出せるようにする
  return { scheduleData, setScheduleData, lastSyncedAt };
};
