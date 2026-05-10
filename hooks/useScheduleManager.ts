import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
// ※ auth と db のパスは、ご自身の環境に合わせて修正してください
import { auth, db } from "../firebaseConfig";
import { ScheduleItem } from "../types";

// 🌟 追加：Zustand の魔法の倉庫をインポート
import { useAppStore } from "../store/useAppStore";

export const useScheduleManager = () => {
  // 🌟 倉庫からデータと「純粋な更新関数」を引き出す
  const { scheduleData, setScheduleData: setZustandScheduleData } =
    useAppStore();

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // 1. アプリ起動時にローカルデータ（スマホ本体）から読み込む
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const storedData = await AsyncStorage.getItem("scheduleData");
        if (storedData) {
          // 🌟 読み込んだデータを直接Zustandの倉庫に格納
          setZustandScheduleData(JSON.parse(storedData));
        }
        const syncedAt = await AsyncStorage.getItem("lastSyncedAt");
        if (syncedAt) setLastSyncedAt(syncedAt);
      } catch (error) {
        console.error("ローカルデータの読み込みに失敗しました:", error);
      }
    };
    loadInitialData();
  }, []);

  // 🌟 修正：newData として「オブジェクト」または「関数」を受け取れるようにする
  const setScheduleData = async (
    updater:
      | { [key: string]: ScheduleItem[] }
      | ((prev: { [key: string]: ScheduleItem[] }) => { [key: string]: ScheduleItem[] })
  ) => {
    // 1. まず、新しいデータを確定させる
    // updater が関数の場合（prev => ...）は、現在のZustandのデータ（scheduleData）を渡して計算させる
    const newData = typeof updater === "function" ? updater(scheduleData) : updater;

    // 2. 確定した新しいデータをZustandの倉庫に格納して、画面を即座に更新！
    setZustandScheduleData(newData);

    // 3. 裏側でローカルとFirebaseに保存する（ここは非同期でOK）
    try {
      await AsyncStorage.setItem("scheduleData", JSON.stringify(newData));

      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const now = new Date().toISOString();

        // 不要な関数などが混じらないように安全に文字列化→復元
        const sanitizedData = JSON.parse(JSON.stringify(newData));

        await setDoc(
          userRef,
          { scheduleData: sanitizedData, lastSyncedAt: now },
          { merge: true }
        );

        setLastSyncedAt(now);
        await AsyncStorage.setItem("lastSyncedAt", now);
      }
    } catch (error) {
      console.error("データの保存に失敗しました:", error);
    }
  };

  return { scheduleData, setScheduleData, lastSyncedAt };
};
