import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { auth, db } from "../firebaseConfig";
import { ScheduleItem } from "../types";

// 🌟 目標（Wish）の型を簡易定義
export interface SharedWishItem {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  icon: string;
  color: string;
  sharedRoomId?: string;
  [key: string]: any;
}

export function useCloudSync(sharedRooms: { [layerName: string]: string }) {
  const [roomSchedules, setRoomSchedules] = useState<{
    [roomId: string]: { [date: string]: ScheduleItem[] };
  }>({});

  // 🌟 追加：クラウドから受信した共有目標を保存する箱
  const [roomWishes, setRoomWishes] = useState<{
    [roomId: string]: SharedWishItem[];
  }>({});

  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const syncQueue = useRef<{
    [id: string]: { item: ScheduleItem; date: string; timer: ReturnType<typeof setTimeout> };
  }>({});

  // 🌟 追加：目標送信用のキュー（デバウンス用）
  const wishSyncQueue = useRef<{
    [id: string]: { wish: SharedWishItem; roomId: string; timer: ReturnType<typeof setTimeout> };
  }>({});

  // ==========================================
  // 1. 受信ロジック（予定 ＆ 目標）
  // ==========================================
  useEffect(() => {
    if (!isAuthReady) return;

    const roomIds = Object.values(sharedRooms);
    if (roomIds.length === 0) {
      setRoomSchedules({});
      setRoomWishes({}); // 🌟 クリア
      return;
    }

    const unsubscribes: (() => void)[] = [];

    roomIds.forEach((roomId) => {
      // ① スケジュールの監視
      const unsubSchedules = onSnapshot(
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
        (error) => console.error(`Room ${roomId} schedules sync error:`, error)
      );
      unsubscribes.push(unsubSchedules);

      // 🌟 ② 目標（Wishes）の監視を追加！
      const unsubWishes = onSnapshot(
        collection(db, "rooms", roomId, "wishes"),
        (snapshot) => {
          const wishes: SharedWishItem[] = [];
          snapshot.forEach((docSnap) => {
            wishes.push({ id: docSnap.id, ...docSnap.data() } as SharedWishItem);
          });
          setRoomWishes((prev) => ({ ...prev, [roomId]: wishes }));
        },
        (error) => console.error(`Room ${roomId} wishes sync error:`, error)
      );
      unsubscribes.push(unsubWishes);
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [sharedRooms, isAuthReady]);


  // ==========================================
  // 2. 送信ロジック（予定 ＆ 目標）
  // ==========================================
  const handleSaveItem = async (item: ScheduleItem, date: string) => {
    try {
      const parentLayer = item.sharedLayer || item.layer || (item.tags && item.tags.length > 0 ? item.tags[0] : item.tag);
      if (!parentLayer || !sharedRooms[parentLayer]) return;

      const targetRoomId = sharedRooms[parentLayer];
      const schedulesRef = collection(db, "rooms", targetRoomId, "schedules");
      const safeId = item.id ? String(item.id) : undefined;
      const docRef = safeId ? doc(schedulesRef, safeId) : doc(schedulesRef);

      const cleanItem = {
        ...item,
        id: docRef.id,
        tags: item.tags && item.tags.length > 0 ? item.tags : item.tag ? [item.tag] : [],
        category: item.category || "",
        layer: parentLayer,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, { ...cleanItem, date }, { merge: true });
    } catch (e) {
      console.error("共有保存エラー:", e);
    }
  };

  const safeDebouncedSync = useCallback(
    (item: ScheduleItem, date: string) => {
      const parentLayer = item.sharedLayer || item.layer || (item.tags && item.tags.length > 0 ? item.tags[0] : item.tag);
      if (!parentLayer) return;
      const isShared = !!sharedRooms[parentLayer];
      if (!isShared) return;

      const key = String(item.id || Date.now());
      if (syncQueue.current[key]) clearTimeout(syncQueue.current[key].timer);

      const timer = setTimeout(() => {
        handleSaveItem(item, date);
        delete syncQueue.current[key];
      }, 1000);
      syncQueue.current[key] = { item, date, timer };
    },
    [sharedRooms]
  );

  // 🌟 追加：共有目標の送信ロジック
  const handleSaveWish = async (wish: SharedWishItem, roomId: string) => {
    try {
      const wishesRef = collection(db, "rooms", roomId, "wishes");
      const docRef = doc(wishesRef, String(wish.id));
      await setDoc(docRef, { ...wish, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error("共有目標保存エラー:", e);
    }
  };

  // 🌟 追加：目標のデバウンス送信（連打防止）
  const safeDebouncedSyncWish = useCallback((wish: SharedWishItem, roomId: string) => {
    if (!roomId) return;
    const key = String(wish.id);
    if (wishSyncQueue.current[key]) clearTimeout(wishSyncQueue.current[key].timer);

    const timer = setTimeout(() => {
      handleSaveWish(wish, roomId);
      delete wishSyncQueue.current[key];
    }, 1000);
    wishSyncQueue.current[key] = { wish, roomId, timer };
  }, []);

  // アプリが裏に回った時のフラッシュ処理
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        Object.values(syncQueue.current).forEach(({ item, date, timer }) => {
          clearTimeout(timer);
          handleSaveItem(item, date);
        });
        syncQueue.current = {};

        // 🌟 目標もフラッシュ
        Object.values(wishSyncQueue.current).forEach(({ wish, roomId, timer }) => {
          clearTimeout(timer);
          handleSaveWish(wish, roomId);
        });
        wishSyncQueue.current = {};
      }
    });
    return () => subscription.remove();
  }, [sharedRooms]);

  // 🌟 新しく作成した2つもエクスポートする！
  return { roomSchedules, roomWishes, safeDebouncedSync, safeDebouncedSyncWish };
}