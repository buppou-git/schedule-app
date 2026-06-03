import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
// ※ご自身の環境に合わせて firebaseConfig のパスを調整してください（例: "../firebaseConfig" など）
import { db } from "../firebaseConfig";
import { ScheduleItem } from "../types";

const [debugInfo, setDebugInfo] = useState<any>(null);

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
                layer: data.layer || data.sharedLayer,
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
      // ✅ 親レイヤーを取得（これが最重要）
      const parentLayer =
        item.sharedLayer ||
        item.layer ||
        (item.tags && item.tags.length > 0 ? item.tags[0] : item.tag);

      if (!parentLayer || !sharedRooms[parentLayer]) return;

      const targetRoomId = sharedRooms[parentLayer];
      const schedulesRef = collection(db, "rooms", targetRoomId, "schedules");

      const safeId = item.id ? String(item.id) : undefined;
      const docRef = safeId ? doc(schedulesRef, safeId) : doc(schedulesRef);

      const cleanItem = {
        ...item,
        id: docRef.id,
        tags:
          item.tags && item.tags.length > 0
            ? item.tags
            : item.tag
              ? [item.tag]
              : [],
        category: item.category || "",
        layer: parentLayer,
        updatedAt: new Date().toISOString(),
      };


      await setDoc(
        docRef,
        {
          ...cleanItem,
          date,
        },
        { merge: true }
      );


    } catch (e) {
      console.error("共有保存エラー:", e);
    }
  };

  // 🌟 3. 安全なデバウンス（遅延）送信
  const safeDebouncedSync = useCallback(
    (item: ScheduleItem, date: string) => {
      const parentLayer =
        item.sharedLayer ||
        item.layer ||
        (item.tags && item.tags.length > 0 ? item.tags[0] : item.tag);

      // 👇 🌟 これを追加！
      // parentLayer が無い(undefined)場合は共有予定ではないので、ここで処理を止める！
      if (!parentLayer) return;

      const debug = {
        step: "sync_attempt",
        parentLayer,
        sharedRooms,
        hasRoom: !!sharedRooms[parentLayer],
      };
      
      setDebugInfo(debug);
      

      // 🌟 先に `if (!parentLayer) return;` で弾いているため、
      // ここで undefined エラー（ts2538）が起きなくなる！
      const isShared = !!sharedRooms[parentLayer];
      if (!isShared) return;

      const key = String(item.id || Date.now());

      if (syncQueue.current[key]) {
        clearTimeout(syncQueue.current[key].timer);
      }

      // 1秒間操作がなければ送信
      const timer = setTimeout(() => {
        handleSaveItem(item, date);
        delete syncQueue.current[key];
      }, 1000);

      syncQueue.current[key] = { item, date, timer };
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

  return { roomSchedules, safeDebouncedSync, debugInfo };
}
