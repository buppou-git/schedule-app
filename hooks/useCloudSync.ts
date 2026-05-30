import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
// ※ご自身の環境に合わせて firebaseConfig のパスを調整してください（例: "../firebaseConfig" など）
import { db } from "../firebaseConfig";
import { ScheduleItem } from "../types";

export function useCloudSync(sharedRooms: { [layerName: string]: string }) {
  const [roomSchedules, setRoomSchedules] = useState<{
    [roomId: string]: { [date: string]: ScheduleItem[] };
  }>({});
  const syncQueue = useRef<{
    [id: string]: {
      item: ScheduleItem;
      date: string;
      timer: ReturnType<typeof setTimeout>;
    };
  }>({});

  // 🌟 1. 共有ルームのデータ受信（リアルタイム監視）
  useEffect(() => {
    const roomIds = Object.values(sharedRooms);
    if (roomIds.length === 0) {
      setRoomSchedules({});
      return;
    }

    const unsubscribes = roomIds.map((roomId) => {
      return onSnapshot(
        collection(db, "rooms", roomId, "schedules"),
        (snapshot) => {
          const itemsByDate: { [date: string]: ScheduleItem[] } = {};
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.date) {
              if (!itemsByDate[data.date]) itemsByDate[data.date] = [];
              itemsByDate[data.date].push({
                id: docSnap.id,
                ...data,
              } as ScheduleItem);
            }
          });
          setRoomSchedules((prev) => ({ ...prev, [roomId]: itemsByDate }));
        },
        (error) => console.error(`Room ${roomId} sync error:`, error),
      );
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [sharedRooms]);

  // 🌟 2. 共有データの送信処理
  const handleSaveItem = async (item: ScheduleItem, date: string) => {
    try {
      const itemTags = item.tags || (item.tag ? [item.tag] : []);
      const sharedLayerName = itemTags.find((tag) =>
        Object.keys(sharedRooms).includes(tag),
      );
      if (!sharedLayerName) return;

      const targetRoomId = sharedRooms[sharedLayerName];
      const schedulesRef = collection(db, "rooms", targetRoomId, "schedules");

      const safeId = item.id ? String(item.id) : undefined;

      const docRef = safeId ? doc(schedulesRef, safeId) : doc(schedulesRef);

      // ✅ データ構造を守る（categoryが消えるのを防ぐ）
      const cleanItem = {
        ...item,
        id: docRef.id,
        tags: item.tags || (item.tag ? [item.tag] : []),
        category: item.category || "", // ✅ これ超重要
        updatedAt: new Date().toISOString(),
      };

      setDoc(docRef, {
        ...cleanItem,
        date: date,
      });
    } catch (e) {
      console.error("共有保存エラー:", e);
    }
  };

  // 🌟 3. 安全なデバウンス（遅延）送信
  const safeDebouncedSync = useCallback(
    (item: ScheduleItem, date: string) => {
      const itemTags = item.tags || (item.tag ? [item.tag] : []);
      const isShared = itemTags.some((tag) =>
        Object.keys(sharedRooms).includes(tag),
      );
      if (!isShared) return;

      if (syncQueue.current[item.id]) {
        clearTimeout(syncQueue.current[item.id].timer);
      }

      // 1秒間操作がなければ送信
      const timer = setTimeout(() => {
        handleSaveItem(item, date);
        delete syncQueue.current[item.id];
      }, 1000);

      syncQueue.current[item.id] = { item, date, timer };
    },
    [sharedRooms],
  );

  // 🌟 4. アプリが裏に回った瞬間に、溜まった送信待ちを一気に放出する（データロス防止の最強の盾！）
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        Object.values(syncQueue.current).forEach(({ item, date, timer }) => {
          clearTimeout(timer);
          handleSaveItem(item, date);
        });
        syncQueue.current = {}; // キューを空にリセット
      }
    });
    return () => subscription.remove();
  }, [sharedRooms]);

  return { roomSchedules, safeDebouncedSync };
}
