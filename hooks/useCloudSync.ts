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

  // 🌟 クラウドから受信した共有目標を保存する箱
  const [roomWishes, setRoomWishes] = useState<{
    [roomId: string]: SharedWishItem[];
  }>({});

  // 🌟 追加：クラウドから受信した属性（タグ）を保存する箱
  const [roomTags, setRoomTags] = useState<{
    [roomId: string]: { [tagName: string]: { layer: string; color: string } };
  }>({});

  // 🌟 追加：属性送信用のタイマー箱
  const tagSyncQueue = useRef<{ [key: string]: any }>({});

  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const syncQueue = useRef<{
    [id: string]: {
      item: ScheduleItem;
      date: string;
      timer: ReturnType<typeof setTimeout>;
    };
  }>({});

  // 目標送信用のキュー（デバウンス用）
  const wishSyncQueue = useRef<{
    [id: string]: {
      wish: SharedWishItem;
      roomId: string;
      timer: ReturnType<typeof setTimeout>;
    };
  }>({});

  // ==========================================
  // 1. 受信ロジック（予定 ＆ 目標 ＆ 属性）
  // ==========================================
  useEffect(() => {
    if (!isAuthReady) return;

    const roomIds = Object.values(sharedRooms);
    if (roomIds.length === 0) {
      setRoomSchedules({});
      setRoomWishes({});
      setRoomTags({}); // 🌟 追加
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
        (error) => console.error(`Room ${roomId} schedules sync error:`, error),
      );
      unsubscribes.push(unsubSchedules);

      // ② 目標（Wishes）の監視
      const unsubWishes = onSnapshot(
        collection(db, "rooms", roomId, "wishes"),
        (snapshot) => {
          const wishes: SharedWishItem[] = [];
          snapshot.forEach((docSnap) => {
            wishes.push({
              id: docSnap.id,
              ...docSnap.data(),
            } as SharedWishItem);
          });
          setRoomWishes((prev) => ({ ...prev, [roomId]: wishes }));
        },
        (error) => console.error(`Room ${roomId} wishes sync error:`, error),
      );
      unsubscribes.push(unsubWishes);

      // 🌟 ③ 追加：属性（Tags）の監視
      const unsubTags = onSnapshot(
        collection(db, "rooms", roomId, "tags"),
        (snapshot) => {
          const tags: any = {};
          snapshot.forEach((docSnap) => {
            tags[docSnap.id] = docSnap.data();
          });
          setRoomTags((prev) => ({ ...prev, [roomId]: tags }));
        },
        (error) => console.error(`Room ${roomId} tags sync error:`, error),
      );
      unsubscribes.push(unsubTags);
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [sharedRooms, isAuthReady]);

  // ==========================================
  // 2. 送信ロジック（予定 ＆ 目標 ＆ 属性）
  // ==========================================
  const handleSaveItem = async (item: ScheduleItem, date: string) => {
    try {
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

      await setDoc(docRef, { ...cleanItem, date }, { merge: true });
    } catch (e) {
      console.error("共有保存エラー:", e);
    }
  };

  const safeDebouncedSync = useCallback(
    (item: ScheduleItem, date: string) => {
      const parentLayer =
        item.sharedLayer ||
        item.layer ||
        (item.tags && item.tags.length > 0 ? item.tags[0] : item.tag);
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
    [sharedRooms],
  );

  // 共有目標の送信ロジック
  const handleSaveWish = async (wish: SharedWishItem, roomId: string) => {
    try {
      const wishesRef = collection(db, "rooms", roomId, "wishes");
      const docRef = doc(wishesRef, String(wish.id));
      await setDoc(
        docRef,
        { ...wish, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    } catch (e) {
      console.error("共有目標保存エラー:", e);
    }
  };

  // 目標のデバウンス送信（連打防止）
  const safeDebouncedSyncWish = useCallback(
    (wish: SharedWishItem, roomId: string) => {
      if (!roomId) return;
      const key = String(wish.id);
      if (wishSyncQueue.current[key])
        clearTimeout(wishSyncQueue.current[key].timer);

      const timer = setTimeout(() => {
        handleSaveWish(wish, roomId);
        delete wishSyncQueue.current[key];
      }, 1000);
      wishSyncQueue.current[key] = { wish, roomId, timer };
    },
    [],
  );

  // 🌟 追加：属性（タグ）のデバウンス送信
  const safeDebouncedSyncTag = useCallback(
    (tagName: string, tagData: any, roomId: string) => {
      if (!roomId) return;
      const key = tagName;
      if (tagSyncQueue.current[key])
        clearTimeout(tagSyncQueue.current[key].timer);

      const timer = setTimeout(async () => {
        try {
          const docRef = doc(db, "rooms", roomId, "tags", tagName);
          await setDoc(
            docRef,
            { ...tagData, updatedAt: new Date().toISOString() },
            { merge: true },
          );
        } catch (e) {
          console.error("属性保存エラー:", e);
        }
        delete tagSyncQueue.current[key];
      }, 1000);
      tagSyncQueue.current[key] = { tagName, tagData, roomId, timer };
    },
    [],
  );

  // アプリが裏に回った時のフラッシュ処理
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        Object.values(syncQueue.current).forEach(({ item, date, timer }) => {
          clearTimeout(timer);
          handleSaveItem(item, date);
        });
        syncQueue.current = {};

        // 目標もフラッシュ
        Object.values(wishSyncQueue.current).forEach(
          ({ wish, roomId, timer }) => {
            clearTimeout(timer);
            handleSaveWish(wish, roomId);
          },
        );
        wishSyncQueue.current = {};

        // 🌟 属性もフラッシュ（追加）
        Object.values(tagSyncQueue.current).forEach(
          async ({ tagName, tagData, roomId, timer }) => {
            clearTimeout(timer);
            try {
              const docRef = doc(db, "rooms", roomId, "tags", tagName);
              await setDoc(
                docRef,
                { ...tagData, updatedAt: new Date().toISOString() },
                { merge: true },
              );
            } catch (e) {
              console.error("属性フラッシュエラー:", e);
            }
          },
        );
        tagSyncQueue.current = {};
      }
    });
    return () => subscription.remove();
  }, [sharedRooms]);

  // 🌟 追加：roomTags と safeDebouncedSyncTag もエクスポート！
  return {
    roomSchedules,
    roomWishes,
    roomTags,
    safeDebouncedSync,
    safeDebouncedSyncWish,
    safeDebouncedSyncTag,
  };
}
