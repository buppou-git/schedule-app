import "react-native-get-random-values";

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useScheduleManager } from "../../hooks/useScheduleManager";

import { ScheduleItem, SubTask } from "../../types";

import { useCalendarData } from "../../hooks/useCalendarData";
import { useNotificationManager } from "../../hooks/useNotificationManager";

import { signInAnonymously } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { AppState } from "react-native";
import { auth, db } from "../../firebaseConfig";

import EventItem from "./components/EventItem";
import TodoItem from "./components/TodoItem";

import { useAppStore } from "../../store/useAppStore";

import OnboardingModal from "./components/OnboardingModal";

import PresetSaveModal from "./components/PresetSaveModal";

//広告関係
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { MobileAds } from "react-native-google-mobile-ads";

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import CryptoJS from "crypto-js";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

import {
  CalendarList,
  CalendarProvider,
  WeekCalendar,
} from "react-native-calendars";

import ConfigModal from "./components/ConfigModal";
import LayerManagementModal from "./components/LayerManagementModal";
import MoneyDashboard from "./components/MoneyDashboard";
import QuickActionModal from "./components/QuickActionModal";
import ScheduleModal from "./components/ScheduleModal";
import SearchModal from "./components/SearchModal"; // 🌟 これを追加
import SubTaskEditModal from "./components/SubTaskEditModal";
import TabBar from "./components/TabBar";

import { useExternalCalendar } from "../../hooks/useExternalCalendar";

function useStableCallback<T extends (...args: never[]) => unknown>(
  callback: T,
) {
  const ref = useRef(callback);
  // 🌟 useEffect を useLayoutEffect に変更！
  useLayoutEffect(() => {
    ref.current = callback;
  }, [callback]);
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}

const getTodayString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${("0" + (date.getMonth() + 1)).slice(-2)}-${("0" + date.getDate()).slice(-2)}`;
};

const getPastelColor = (hex: string) => {
  if (!hex || hex.length !== 7) return "#F8F9FA";
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  const mix = 0.08;
  return `rgb(${Math.round(r * mix + 255 * (1 - mix))}, ${Math.round(g * mix + 255 * (1 - mix))}, ${Math.round(b * mix + 255 * (1 - mix))})`;
};

const getOrGenerateMasterKey = async () => {
  const user = auth.currentUser;

  // 念のためのフォールバック（通常は発生しません）
  if (!user) return "default_fallback_key_12345";

  // 🌟 ユーザー固有のUIDをベースにした固定の鍵（機種変更しても同じ鍵になる）
  return user.uid + "_unical_secure_key_2026";
};

const calculateStreak = (completedDates: string[] | undefined) => {
  if (!completedDates || completedDates.length === 0) return 0;

  const sortedDates = [...completedDates].sort((a, b) => (a > b ? -1 : 1));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let checkDate = new Date(today);
  const firstDateInArray = new Date(sortedDates[0]);
  firstDateInArray.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - firstDateInArray.getTime();
  const diffDays = diffTime / (1000 * 3600 * 24);

  if (diffDays > 1) {
    return 0;
  } else if (diffDays === 1) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (const dateStr of sortedDates) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (d.getTime() > checkDate.getTime()) {
      continue;
    } else {
      break;
    }
  }
  return streak;
};

export default function Index() {
  useEffect(() => {
    const initAds = async () => {
      try {
        // 1. iOSのトラッキング許可を求める
        const { status } = await requestTrackingPermissionsAsync();
        // 2. 広告SDKを初期化
        await MobileAds().initialize();
      } catch (e) {
        console.error("Ads initialization error:", e);
      }
    };
    initAds();
  }, []);

  const [onboardingVisible, setOnboardingVisible] = useState(false);

  const [sharedRooms, setSharedRooms] = useState<{
    [layerName: string]: string;
  }>({});

  const [roomSchedules, setRoomSchedules] = useState<{
    [roomId: string]: { [date: string]: ScheduleItem[] };
  }>({});

  const [sharedScheduleData, setSharedScheduleData] = useState<{
    [key: string]: ScheduleItem[];
  }>({});

  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const { scheduleData, setScheduleData, lastSyncedAt } = useScheduleManager();

  const { externalEvents } = useExternalCalendar(selectedDate);

  const {
    layerMaster,
    setLayerMaster,
    tagMaster,
    setTagMaster,
    activeMode,
    setActiveMode,
  } = useAppStore();

  const { cancelItemNotification, scheduleItemNotification } =
    useNotificationManager();

  const [subTaskModalVisible, setSubTaskModalVisible] = useState(false);
  const [editingSubTaskInfo, setEditingSubTaskInfo] = useState<{
    parentId: string;
    parentTitle: string;
    date: string;
    subTask: SubTask;
  } | null>(null);
  const [quickActionVisible, setQuickActionVisible] = useState(false);
  const [quickActionItem, setQuickActionItem] = useState<ScheduleItem | null>(
    null,
  );

  const [presets, setPresets] = useState<{ [key: string]: string[] }>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [isMoneySummaryMode, setIsMoneySummaryMode] = useState(false);

  const [isAppLocked, setIsAppLocked] = useState(false);
  const [pinForUnlock, setPinForUnlock] = useState("");

  const handleAuthenticate = async () => {
    const useBio = await AsyncStorage.getItem("useBiometricLock");
    const usePin = await AsyncStorage.getItem("usePinLock");

    if (useBio !== "true" && usePin !== "true") {
      setIsAppLocked(false);
      return;
    }

    if (useBio === "true") {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "認証してUniCalを開く",
        fallbackLabel: "パスコードを入力",
      });
      if (result.success) {
        setIsAppLocked(false);
        setPinForUnlock("");
        return;
      }
    }

    if (usePin === "true") {
      setIsAppLocked(true);
    } else {
      setIsAppLocked(false);
    }
  };

  const authenticatePin = async (pin: string) => {
    const savedPin = await SecureStore.getItemAsync("app_pin_code");
    if (pin === savedPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsAppLocked(false);
      setPinForUnlock("");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("エラー", "暗証番号が違います");
      setPinForUnlock("");
    }
  };

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    handleAuthenticate(); // 初回起動時

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // 🌟 修正：完全に「バックグラウンド（裏側）」から戻ってきた時だけ認証する
      if (appState.current === "background" && nextAppState === "active") {
        handleAuthenticate();
      }
      // 🌟 アプリがバックグラウンドに行った時にロックをかける
      else if (nextAppState === "background") {
        AsyncStorage.getItem("useBiometricLock").then((val) => {
          if (val === "true") setIsAppLocked(true);
        });
        AsyncStorage.getItem("usePinLock").then((val) => {
          if (val === "true") setIsAppLocked(true);
        });
      }
      appState.current = nextAppState; // 状態を更新
    });

    return () => subscription.remove();
  }, []);

  const [activeTags, setActiveTags] = useState<string[]>([]);

  const [isExternalSyncEnabled, setIsExternalSyncEnabled] = useState(false);

  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    // アプリ起動から0.1秒だけ待って、UIの準備完了フラグを立てる（これで一気に軽くなる）
    const timer = setTimeout(() => setIsAppReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("externalCalendarSync").then((val) =>
      setIsExternalSyncEnabled(val === "true"),
    );
  }, []);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [layerModalVisible, setLayerModalVisible] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [tempPresetName, setTempPresetName] = useState("");
  const [tempActiveTags, setTempActiveTags] = useState<string[]>([]);

  const [editPresetModalVisible, setEditPresetModalVisible] = useState(false);
  const [editingPresetOriginalName, setEditingPresetOriginalName] =
    useState("");
  const [editingPresetName, setEditingPresetName] = useState("");

  const calendarKey = useMemo(() => activeMode, [activeMode]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [configModalVisible, setConfigModalVisible] = useState(false);

  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const openFilterModal = useCallback(() => {
    setTempActiveTags(activeTags);
    setFilterModalVisible(true);
  }, [activeTags]);

  const toggleTempTag = useCallback(
    (layer: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTempActiveTags((prev) => {
        const next = prev.includes(layer)
          ? prev.filter((t) => t !== layer)
          : [...prev, layer];

        // 🌟 修正：「すべて表示」に戻す条件を、外部予定も含めた「全レイヤー数」と厳密に比較するように変更
        // isExternalSyncEnabled が true の時、layerMaster の数 + 1 が全レイヤー数になる
        const totalLayerCount =
          Object.keys(layerMaster).length + (isExternalSyncEnabled ? 1 : 0);

        // 全て選択されたら「すべて表示（空配列）」に戻す
        return next.length >= totalLayerCount ? [] : next;
      });
    },
    [layerMaster, isExternalSyncEnabled], // 🌟 修正：依存配列を最新状態に更新
  );

  const applyFilters = useCallback(() => {
    setActiveTags(tempActiveTags);
    setFilterModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [tempActiveTags]);

  const handleOpenPresetModal = () => {
    setFilterModalVisible(false);
    setTimeout(() => {
      setPresetModalVisible(true);
    }, 300);
  };

  const confirmSavePreset = async () => {
    if (!tempPresetName.trim()) return;
    const newPresets = { ...presets, [tempPresetName.trim()]: tempActiveTags };
    setPresets(newPresets);
    await AsyncStorage.setItem("filterPresets", JSON.stringify(newPresets));

    setHasUnsavedChanges(true);

    setActiveTags(tempActiveTags);
    setTempPresetName("");
    setPresetModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deletePreset = async (name: string) => {
    const newPresets = { ...presets };
    delete newPresets[name];
    setPresets(newPresets);
    await AsyncStorage.setItem("filterPresets", JSON.stringify(newPresets));

    setHasUnsavedChanges(true);
    setEditPresetModalVisible(false);
  };

  const handleLongPressPreset = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingPresetOriginalName(name);
    setEditingPresetName(name);
    setEditPresetModalVisible(true);
  };

  const saveEditedPreset = async () => {
    const trimmed = editingPresetName.trim();
    if (!trimmed || trimmed === editingPresetOriginalName) {
      setEditPresetModalVisible(false);
      return;
    }
    const newPresets = { ...presets };
    if (newPresets[trimmed]) {
      Alert.alert("エラー", "既に同じ名前のプリセットが存在します");
      return;
    }
    newPresets[trimmed] = newPresets[editingPresetOriginalName];
    delete newPresets[editingPresetOriginalName];

    setPresets(newPresets);
    await AsyncStorage.setItem("filterPresets", JSON.stringify(newPresets));
    setHasUnsavedChanges(true);
    setEditPresetModalVisible(false);
  };

  const isSharedItem = (item: ScheduleItem) => {
    const itemTags = item.tags || (item.tag ? [item.tag] : []);
    return itemTags.some((tag) => Object.keys(sharedRooms).includes(tag));
  };

  const handleSaveItem = async (newItem: ScheduleItem, targetDate?: string) => {
    if (isSharedItem(newItem)) {
      try {
        const itemTags = newItem.tags || (newItem.tag ? [newItem.tag] : []);
        const sharedLayerName = itemTags.find((tag) =>
          Object.keys(sharedRooms).includes(tag),
        );
        if (!sharedLayerName) return;

        const targetRoomId = sharedRooms[sharedLayerName];
        const { doc, collection, setDoc } = await import("firebase/firestore");
        const schedulesRef = collection(db, "rooms", targetRoomId, "schedules");
        const docRef = newItem.id
          ? doc(schedulesRef, newItem.id)
          : doc(schedulesRef);

        await setDoc(docRef, {
          ...newItem,
          id: docRef.id,
          date: targetDate || selectedDate, // 🌟 どの日付でも対応できるように進化！
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("共有保存エラー:", e);
      }
    }
  };

  // 🌟 追加：通信を節約する「デバウンス（遅延）同期」関数
  const syncTimeoutRef = useRef<{
    [key: string]: ReturnType<typeof setTimeout>;
  }>({});
  const debouncedSyncSharedItem = (item: ScheduleItem, date: string) => {
    if (!isSharedItem(item)) return; // 共有アイテムじゃなければ何もしない

    if (syncTimeoutRef.current[item.id]) {
      clearTimeout(syncTimeoutRef.current[item.id]); // 前のタイマーをキャンセル
    }
    // 1秒間操作がなければクラウドに送信する
    syncTimeoutRef.current[item.id] = setTimeout(() => {
      handleSaveItem(item, date);
      delete syncTimeoutRef.current[item.id];
    }, 1000);
  };

  // 🌟 追加・修正：通信を1回にまとめる「安全な移動・コピー」
  const handleMoveOrCopy = async (
    item: ScheduleItem & { date?: string },
    targetLayer: string,
    isCopy: boolean,
  ) => {
    const newItem = {
      ...item,
      id: isCopy ? Date.now().toString() : item.id,
      tags: [targetLayer],
    };

    const targetDate = item.date || selectedDate;

    try {
      // 🌟 魔法の封筒（バッチ処理）を用意する
      const { writeBatch, doc } = await import("firebase/firestore");
      const batch = writeBatch(db);
      let hasCloudAction = false;

      // ① 古い共有データを消す（コピーではなく移動の時）
      if (!isCopy && isSharedItem(item)) {
        const itemTags = item.tags || (item.tag ? [item.tag] : []);
        const oldSharedLayer = itemTags.find((tag) =>
          Object.keys(sharedRooms).includes(tag),
        );
        if (oldSharedLayer) {
          const oldRoomId = sharedRooms[oldSharedLayer];
          // 💡 ついでに間違っていた削除パスのバグも修正！
          const oldDocRef = doc(db, "rooms", oldRoomId, "schedules", item.id);
          batch.delete(oldDocRef); // 封筒に「削除」を入れる
          hasCloudAction = true;
        }
      }

      // ② 新しい共有先に保存する
      if (Object.keys(sharedRooms).includes(targetLayer)) {
        const targetRoomId = sharedRooms[targetLayer];
        const newDocRef = doc(
          db,
          "rooms",
          targetRoomId,
          "schedules",
          newItem.id,
        );
        batch.set(newDocRef, {
          ...newItem,
          date: targetDate,
          updatedAt: new Date().toISOString(),
        }); // 封筒に「保存」を入れる
        hasCloudAction = true;
      }

      // 🌟 ③ 封筒の中身を【1回の通信】で一気に実行！（電波が切れても安全）
      if (hasCloudAction) {
        await batch.commit();
      }

      // ④ 自分の端末内（ローカル）の画面を更新
      const newData = { ...scheduleData };

      if (!isCopy && !isSharedItem(item)) {
        // 🌟 O(N)ループを撤去し、ピンポイントで削除！
        if (
          newData[targetDate] &&
          newData[targetDate].some((i) => i.id === item.id)
        ) {
          newData[targetDate] = newData[targetDate].filter(
            (i) => i.id !== item.id,
          );
        } else {
          // 万が一見つからなかった場合のみ全検索
          Object.keys(newData).forEach((d) => {
            newData[d] = newData[d].filter((i) => i.id !== item.id);
          });
        }
      }

      if (!Object.keys(sharedRooms).includes(targetLayer)) {
        if (!newData[targetDate]) newData[targetDate] = [];
        const existingIdx = newData[targetDate].findIndex(
          (i) => i.id === newItem.id,
        );
        if (existingIdx >= 0) {
          newData[targetDate][existingIdx] = newItem;
        } else {
          newData[targetDate].push(newItem);
        }
      }

      setScheduleData(newData);
      setHasUnsavedChanges(true);
    } catch (e) {
      console.error("Move/Copy Error:", e);
      Alert.alert(
        "エラー",
        "データの移動に失敗しました。電波の良いところで再度お試しください。",
      );
    }

    setQuickActionVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // 🌟 消えてしまった関数を復活！
  const handleAddSharedRoom = async (layerName: string, roomId: string) => {
    const newRooms = { ...sharedRooms, [layerName]: roomId };
    setSharedRooms(newRooms);
    await AsyncStorage.setItem("sharedRoomsData", JSON.stringify(newRooms));

    // レイヤーマスターにも追加（ランダムな色を割り当て）
    if (!layerMaster[layerName]) {
      const PRESET_COLORS = [
        "#FF3B30",
        "#FF9500",
        "#FFCC00",
        "#34C759",
        "#007AFF",
        "#5856D6",
        "#AF52DE",
      ];
      const randomColor =
        PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      const newLayerMaster = { ...layerMaster, [layerName]: randomColor };
      setLayerMaster(newLayerMaster);
      await AsyncStorage.setItem(
        "layerMasterData",
        JSON.stringify(newLayerMaster),
      );
    }
  };

  // 🌟 追加：手動バックアップ機能
  const handleManualBackup = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("エラー", "ログイン状態が確認できません。");
      return;
    }
    try {
      const rawDataString = JSON.stringify({
        scheduleData,
        layerMaster,
        tagMaster,
        presets,
        activeTags,
        sharedRooms,
      });
      const masterKey = await getOrGenerateMasterKey();
      const encryptedData = CryptoJS.AES.encrypt(
        rawDataString,
        masterKey,
      ).toString();
      await setDoc(doc(db, "users", user.uid), {
        secureData: encryptedData,
        lastSyncedAt: new Date().toISOString(),
      });
      Alert.alert("バックアップ完了", "クラウドにデータを手動保存しました！");
      setConfigModalVisible(false);
    } catch (error) {
      console.error(error);
      Alert.alert("エラー", "バックアップに失敗しました。");
    }
  };

  const handleCompleteOnboarding = async (setupData: {
    layers: { [key: string]: string };
    presets: { [key: string]: string[] };
  }) => {
    // ユーザーが選んだテンプレートのレイヤーとプリセットを適用
    setLayerMaster(setupData.layers);
    setPresets(setupData.presets);
    setTagMaster({}); // タグは最初は空
    setActiveTags([]); // 最初はすべて表示状態

    // ローカルストレージに保存＆完了フラグを立てる
    await AsyncStorage.setItem(
      "layerMasterData",
      JSON.stringify(setupData.layers),
    );
    await AsyncStorage.setItem(
      "filterPresets",
      JSON.stringify(setupData.presets),
    );
    await AsyncStorage.setItem("hasCompletedOnboarding", "true");

    setOnboardingVisible(false);
  };

  // 🌟 アカウントとデータを完全に削除する機能
  const handleDeleteAccount = async () => {
    Alert.alert(
      "アカウントとデータの削除",
      "本当にすべてのアカウント情報とスケジュールデータを削除しますか？この操作は取り消せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: async () => {
            const user = auth.currentUser;
            if (user) {
              try {
                // 1. クラウド上のユーザーデータを削除
                const { deleteDoc, doc } = await import("firebase/firestore");
                await deleteDoc(doc(db, "users", user.uid));

                // 2. Firebase Auth からユーザーを削除
                await user.delete();

                // 3. 端末内のローカルデータをすべて消去
                await AsyncStorage.multiRemove([
                  "myScheduleData",
                  "layerMasterData",
                  "tagMasterData",
                  "filterPresets",
                  "activeTags",
                  "sharedRoomsData",
                  "hasCompletedOnboarding", // 🌟 追加：初回フラグも消去する！
                  "useBiometricLock", // 🌟 追加：生体認証の設定をリセット
                  "usePinLock", // 🌟 追加：暗証番号の設定をリセット
                ]);
                await SecureStore.deleteItemAsync("app_pin_code");

                // 4. メモリ上のステートを初期化
                setScheduleData({});
                setLayerMaster({}); // 🌟 オンボーディングで再設定されるので空にしてOK
                setTagMaster({});
                setPresets({});
                setActiveTags([]);
                setSharedRooms({});

                // 🌟 追加：設定モーダルを閉じて、即座にマニュアルを表示！
                setConfigModalVisible(false);
                setTimeout(() => {
                  setOnboardingVisible(true);
                }, 500); // モーダルが重ならないように0.5秒だけ遅らせて開く
              } catch (error) {
                const err = error as { code?: string }; // 🌟 エラーの型を安全に定義
                console.error("Account Deletion Error:", error);
                if (err.code === "auth/requires-recent-login") {
                  // 🌟 error を err に変更
                  Alert.alert(
                    "エラー",
                    "セキュリティのため、一度アプリを完全に終了して再起動してから、再度削除をお試しください。",
                  );
                } else {
                  Alert.alert(
                    "エラー",
                    "アカウントの削除に失敗しました。通信環境を確認してください。",
                  );
                }
              }
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    signInAnonymously(auth).catch(
      (
        err, // 🌟 : any を削除
      ) => console.error("Auth Error:", err),
    );

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "background") {
          const user = auth.currentUser;
          if (!user) return;

          try {
            const rawDataString = JSON.stringify({
              scheduleData,
              layerMaster,
              tagMaster,
              presets,
              activeTags,
            });

            const masterKey = await getOrGenerateMasterKey();
            const encryptedData = CryptoJS.AES.encrypt(
              rawDataString,
              masterKey,
            ).toString();

            await setDoc(doc(db, "users", user.uid), {
              secureData: encryptedData,
              lastSyncedAt: new Date().toISOString(),
            });
          } catch (error) {
            console.error("Auto-save Error:", error);
          }
        }
      },
    );

    return () => subscription.remove();
  }, [scheduleData, layerMaster, tagMaster, presets, activeTags]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [layers, pre, tags, onboarded, scheduleExists, extSync] =
          await Promise.all([
            AsyncStorage.getItem("layerMasterData"),
            AsyncStorage.getItem("filterPresets"),
            AsyncStorage.getItem("tagMasterData"),
            AsyncStorage.getItem("hasCompletedOnboarding"),
            AsyncStorage.getItem("myScheduleData"),
            AsyncStorage.getItem("externalCalendarSync"), // 🌟 外部同期の設定も読み込む
          ]);

        let initialLayers = layers ? JSON.parse(layers) : {};

        // 🌟 追加：「外部同期」がONなのにレイヤーマスターに「外部予定」が無い場合、自動で追加する
        if (extSync === "true" && !initialLayers["外部予定"]) {
          initialLayers = { ...initialLayers, 外部予定: "#FF2D55" };
        } else if (extSync !== "true" && initialLayers["外部予定"]) {
          // 同期がOFFになったらレイヤーから消す
          delete initialLayers["外部予定"];
        }

        if (!onboarded && !scheduleExists) {
          setOnboardingVisible(true);
        } else {
          if (!onboarded && scheduleExists) {
            await AsyncStorage.setItem("hasCompletedOnboarding", "true");
          }

          setLayerMaster(initialLayers); // 🌟 更新したレイヤーマスターをセット
          if (pre) setPresets(JSON.parse(pre));
          if (tags) setTagMaster(JSON.parse(tags));
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadData();
  }, [isExternalSyncEnabled]); // 🌟 外部同期が切り替わった時にも再実行されるように依存配列に追加

  useEffect(() => {
    const syncToStorage = async () => {
      try {
        await AsyncStorage.setItem(
          "layerMasterData",
          JSON.stringify(layerMaster),
        );
        await AsyncStorage.setItem("tagMasterData", JSON.stringify(tagMaster));
        await AsyncStorage.setItem("filterPresets", JSON.stringify(presets));
        await AsyncStorage.setItem("activeTags", JSON.stringify(activeTags));
      } catch (e) {
        console.error("Storage Sync Error:", e);
      }
    };
    syncToStorage();
  }, [layerMaster, tagMaster, presets, activeTags]);

  // 🌟 変更：複数ルームのリアルタイム同期を並行管理
  useEffect(() => {
    const roomIds = Object.values(sharedRooms);
    if (roomIds.length === 0) {
      setRoomSchedules({});
      return;
    }

    // 参加しているすべてのルームIDに対して監視(onSnapshot)を張る
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
          // ルームごとにデータを分けて保存
          setRoomSchedules((prev) => ({ ...prev, [roomId]: itemsByDate }));
        },
        (error) => console.error(`Room ${roomId} sync error:`, error),
      );
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [sharedRooms]);

  // 🌟 変更：アルゴリズムを最適化して描画カクつきを防止！
  const displayData = useMemo(() => {
    // 日付をキーに、IDをキーとしたScheduleItemのMapを持つ
    const combinedMap: { [date: string]: Map<string, ScheduleItem> } = {};

    // Mapを初期化・取得するヘルパー
    const getMapForDate = (date: string) => {
      if (!combinedMap[date]) combinedMap[date] = new Map();
      return combinedMap[date];
    };

    // 1. ローカルデータをベースにする
    Object.keys(scheduleData).forEach((date) => {
      const map = getMapForDate(date);
      scheduleData[date].forEach((item) => map.set(item.id, item));
    });

    // 2. 共有データを上書きマージ（同IDなら上書きされて重複が消える）
    Object.values(roomSchedules).forEach((roomData) => {
      Object.keys(roomData).forEach((date) => {
        const map = getMapForDate(date);
        roomData[date].forEach((item) => map.set(item.id, item));
      });
    });

    // 3. 外部カレンダーをマージ
    Object.keys(externalEvents).forEach((date) => {
      const map = getMapForDate(date);
      externalEvents[date].forEach((item) => map.set(item.id, item));
    });

    // 最後に Map から Array に変換して返す
    const result: { [date: string]: ScheduleItem[] } = {};
    Object.keys(combinedMap).forEach((date) => {
      result[date] = Array.from(combinedMap[date].values());
    });

    return result;
  }, [scheduleData, roomSchedules, externalEvents]);

  const { expandedScheduleData, currentMarkedDates } = useCalendarData(
    displayData,
    activeMode,
    activeTags,
    layerMaster,
    tagMaster,
    selectedDate,
  );

  const currentSolidColor = useMemo(() => {
    if (activeTags.length === 1) {
      return layerMaster[activeTags[0]] || "#1C1C1E"; // 外部予定の色も layerMaster に登録される前提
    }
    return "#1C1C1E";
  }, [activeTags, layerMaster]);

  const currentBgColor = useMemo(() => {
    if (activeTags.length === 1) {
      return getPastelColor(layerMaster[activeTags[0]]) || "#F8F9FA";
    }
    return "#F8F9FA";
  }, [activeTags, layerMaster]);

  const currentHeaderTitle = useMemo(() => {
    if (activeTags.length === 0) return "ALL_LAYERS";

    const sortedActive = [...activeTags].sort().join(",");
    for (const [pName, pTags] of Object.entries(presets)) {
      if ([...pTags].sort().join(",") === sortedActive) {
        return pName.toUpperCase();
      }
    }
    return activeTags.join(", ").toUpperCase();
  }, [activeTags, presets]);

  const handleOpenNewModal = () => {
    setSelectedItem(null);
    setModalVisible(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const toggleTodo = (date: string, id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newData = { ...scheduleData };

    let targetItem: ScheduleItem | null = null;
    let originalDate = date;

    // 🌟 1. まず指定された日付の中をピンポイントで探す（O(1)の爆速処理）
    if (newData[date]) {
      targetItem = newData[date].find((i) => i.id === id) || null;
    }

    // 2. 万が一見つからなかった場合のみ、全体を検索する
    if (!targetItem) {
      for (const d of Object.keys(newData)) {
        const found = newData[d].find((i) => i.id === id);
        if (found) {
          targetItem = found;
          originalDate = d;
          break; // 見つけたらすぐやめる
        }
      }
    }

    if (!targetItem) return;

    if (targetItem.repeatType) {
      const completedDates = targetItem.completedDates || [];
      if (completedDates.includes(date)) {
        targetItem.completedDates = completedDates.filter((d) => d !== date);
      } else {
        targetItem.completedDates = [...completedDates, date];
      }
    } else {
      targetItem.isDone = !targetItem.isDone;
    }
    debouncedSyncSharedItem(targetItem, originalDate);

    setScheduleData(newData);
    setHasUnsavedChanges(true);
  };

  const toggleSubTodo = async (
    date: string,
    parentId: string,
    subTaskId: number,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newData = { ...scheduleData };

    let targetDate = date;
    let found = false;

    if (
      newData[targetDate] &&
      newData[targetDate].some((i) => i.id === parentId)
    ) {
      found = true;
    } else {
      for (const d of Object.keys(newData)) {
        if (newData[d].some((i) => i.id === parentId)) {
          targetDate = d;
          found = true;
          break;
        }
      }
    }
    if (!found) return;

    newData[targetDate] = newData[targetDate].map((item) => {
      if (item.id === parentId && item.subTasks) {
        const updatedSubTasks = item.subTasks.map((sub) => {
          if (sub.id === subTaskId) {
            const nextStatus = !sub.isDone;
            if (nextStatus && sub.notificationId) {
              cancelItemNotification(sub.notificationId);
            }
            return {
              ...sub,
              isDone: nextStatus,
              notificationId: nextStatus ? undefined : sub.notificationId,
              reminderOption: nextStatus ? "none" : sub.reminderOption,
            };
          }
          return sub;
        });

        // 1. お金の記録以外を完了判定の対象にする
        const pureTodos = updatedSubTasks.filter(
          (sub: SubTask) => !sub.isExpense && !sub.isIncome,
        );

        // 2. 全て完了しているか計算（純粋なタスクがない場合は元の状態を維持）
        const isAllSubTasksDone =
          pureTodos.length > 0
            ? pureTodos.every((sub: SubTask) => sub.isDone)
            : item.isDone || false;

        // 🌟 3. 習慣(ルーチン)予定の場合の特別処理
        let updatedCompletedDates = item.completedDates || [];
        if (item.repeatType) {
          // ⚠️ targetDate ではなく date を使うように修正！
          if (isAllSubTasksDone && !updatedCompletedDates.includes(date)) {
            updatedCompletedDates = [...updatedCompletedDates, date]; // 完了日に今日を追加
          } else if (
            !isAllSubTasksDone &&
            updatedCompletedDates.includes(date)
          ) {
            updatedCompletedDates = updatedCompletedDates.filter(
              (d: string) => d !== date,
            ); // 完了から外す
          }
        }

        // 🌟 変数に一旦入れてから返すように修正
        const updatedParentItem = {
          ...item,
          subTasks: updatedSubTasks,
          isDone: isAllSubTasksDone,
          completedDates: updatedCompletedDates,
        };

        // 🌟 追加：共有タスクなら裏で同期！
        debouncedSyncSharedItem(updatedParentItem, targetDate);

        return updatedParentItem;
      }
      return item;
    });

    setScheduleData(newData);
    setHasUnsavedChanges(true);
  };

  const layerSummary = useMemo(() => {
    if (activeTags.length !== 1) return null; // 1つのレイヤーに絞り込んでいる時だけ発動

    const targetLayer = activeTags[0];
    if (targetLayer === "外部予定") return null; // 外部予定はお金の計算がないので除外

    const [y, m] = selectedDate.split("-");
    const targetMonthPrefix = `${y}-${m}-`; // 例: "2026-04-"

    let eventCount = 0;
    let totalExpense = 0;

    Object.keys(displayData).forEach((date) => {
      // 選択中の「月」のデータだけを集計する
      if (date.startsWith(targetMonthPrefix)) {
        displayData[date].forEach((item) => {
          const itemTags =
            item.tags && item.tags.length > 0
              ? item.tags
              : item.tag
                ? [item.tag]
                : [];
          const matchLayer = itemTags.some(
            (tag) =>
              tag === targetLayer || tagMaster[tag]?.layer === targetLayer,
          );

          if (matchLayer) {
            if (item.isEvent || item.isTodo) eventCount++;

            // 支出の集計（親タスク + 子タスク）
            if (item.isExpense && item.amount) {
              totalExpense += Number(item.amount);
            }
            if (item.subTasks) {
              item.subTasks.forEach((sub) => {
                if (sub.isExpense && sub.amount) {
                  totalExpense += Number(sub.amount);
                }
              });
            }
          }
        });
      }
    });

    return { targetLayer, eventCount, totalExpense };
  }, [activeTags, displayData, selectedDate, tagMaster]);

  const handleSubTaskSave = async (updatedSub: SubTask) => {
    if (!editingSubTaskInfo) return;
    const { parentId, parentTitle, date } = editingSubTaskInfo;
    const newData = { ...scheduleData };

    let targetDate = date;
    let found = false;
    if (
      newData[targetDate] &&
      newData[targetDate].some((i) => i.id === parentId)
    ) {
      found = true;
    } else {
      for (const d of Object.keys(newData)) {
        if (newData[d].some((i) => i.id === parentId)) {
          targetDate = d;
          found = true;
          break;
        }
      }
    }
    if (!found) return;

    if (updatedSub.notificationId) {
      await cancelItemNotification(updatedSub.notificationId);
      updatedSub.notificationId = undefined;
    }
    if (
      updatedSub.hasDateTime &&
      updatedSub.endTime &&
      updatedSub.reminderOption !== "none" &&
      !updatedSub.isDone
    ) {
      let triggerDate = new Date(updatedSub.endTime);
      if (updatedSub.reminderOption === "1hour")
        triggerDate.setHours(triggerDate.getHours() - 1);
      else if (updatedSub.reminderOption === "1day")
        triggerDate.setDate(triggerDate.getDate() - 1);

      if (triggerDate > new Date()) {
        const id = await scheduleItemNotification(
          `🔔【${parentTitle}】${updatedSub.title}`,
          triggerDate,
        );
        if (id) updatedSub.notificationId = id;
      }
    }

    newData[targetDate] = newData[targetDate].map((item) => {
      if (item.id === parentId && item.subTasks) {
        return {
          ...item,
          subTasks: item.subTasks.map((sub) =>
            sub.id === updatedSub.id ? updatedSub : sub,
          ),
        };
      }
      return item;
    });

    setScheduleData(newData);
    setHasUnsavedChanges(true);
    setSubTaskModalVisible(false);
  };

  const handleSubTaskDelete = async (subTaskId: string | number) => {
    if (!editingSubTaskInfo) return;
    const { parentId, date } = editingSubTaskInfo;
    const newData = { ...scheduleData };

    let targetDate = date;
    if (
      !(
        newData[targetDate] &&
        newData[targetDate].some((i) => i.id === parentId)
      )
    ) {
      for (const d of Object.keys(newData)) {
        if (newData[d].some((i) => i.id === parentId)) {
          targetDate = d;
          break;
        }
      }
    }

    newData[targetDate] = newData[targetDate].map((item) => {
      if (item.id === parentId && item.subTasks) {
        const targetSub = item.subTasks.find((s) => s.id === subTaskId);
        if (targetSub?.notificationId)
          cancelItemNotification(targetSub.notificationId);

        return {
          ...item,
          subTasks: item.subTasks.filter((sub) => sub.id !== subTaskId),
        };
      }
      return item;
    });

    setScheduleData(newData);
    setHasUnsavedChanges(true);
    setSubTaskModalVisible(false);
  };

  const handleQuickSave = (
    item: ScheduleItem & { date?: string },
    newTitle: string,
  ) => {
    if (!newTitle.trim()) return;
    const newData = { ...scheduleData };

    // 🌟 ターゲットの日付を特定（今後の予定ならitem.date、それ以外なら選択中の日）
    const targetDate = item.date || selectedDate;
    let updatedItem: ScheduleItem | null = null;

    if (
      newData[targetDate] &&
      newData[targetDate].some((i) => i.id === item.id)
    ) {
      newData[targetDate] = newData[targetDate].map((i) => {
        if (i.id === item.id) {
          updatedItem = { ...i, title: newTitle }; // 🌟 ここで newTitle を使用
          return updatedItem;
        }
        return i;
      });
    } else {
      // フォールバック（全検索）
      for (const d of Object.keys(newData)) {
        if (newData[d].some((i) => i.id === item.id)) {
          newData[d] = newData[d].map((i) => {
            if (i.id === item.id) {
              updatedItem = { ...i, title: newTitle };
              return updatedItem;
            }
            return i;
          });
          break;
        }
      }
    }

    // 共有タスクなら裏で同期
    if (updatedItem) {
      debouncedSyncSharedItem(updatedItem, targetDate);
    }

    setScheduleData(newData);
    setHasUnsavedChanges(true);
  };

  const handleQuickDelete = (item: ScheduleItem & { date?: string }) => {
    Alert.alert("削除の確認", `「${item.title}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          // 1. 通知のキャンセル
          if (item.notificationIds) {
            for (const id of item.notificationIds) {
              await cancelItemNotification(id);
            }
          }

          // 2. 共有タスクの場合、クラウド(Firestore)からも削除
          if (isSharedItem(item)) {
            try {
              const itemTags = item.tags || (item.tag ? [item.tag] : []);
              const sharedLayerName = itemTags.find((tag) =>
                Object.keys(sharedRooms).includes(tag),
              );
              if (sharedLayerName) {
                const targetRoomId = sharedRooms[sharedLayerName];
                const { deleteDoc, doc } = await import("firebase/firestore");
                // 正しいルームパスで削除を実行
                await deleteDoc(
                  doc(db, "rooms", targetRoomId, "schedules", item.id),
                );
              }
            } catch (error) {
              console.error("共有データの削除に失敗:", error);
            }
          }

          // 3. ローカルデータの削除（filterを使うので newTitle は不要です！）
          const newData = { ...scheduleData };
          const targetDate = item.date || selectedDate;

          if (
            newData[targetDate] &&
            newData[targetDate].some((i) => i.id === item.id)
          ) {
            newData[targetDate] = newData[targetDate].filter(
              (i) => i.id !== item.id,
            );
          } else {
            // フォールバック（全検索して削除）
            for (const d of Object.keys(newData)) {
              if (newData[d].some((i) => i.id === item.id)) {
                newData[d] = newData[d].filter((i) => i.id !== item.id);
                break;
              }
            }
          }

          setScheduleData(newData);
          setHasUnsavedChanges(true);
        },
      },
    ]);
  };

  const handleRestore = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(
        "エラー",
        "ログイン状態が確認できません。一度アプリを再起動してください。",
      );
      return;
    }

    try {
      console.log("復元処理を開始...");
      const { getDoc, doc } = await import("firebase/firestore");
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const cloudData = docSnap.data();

        let parsedData;
        if (cloudData.secureData) {
          const masterKey = await getOrGenerateMasterKey();
          const bytes = CryptoJS.AES.decrypt(cloudData.secureData, masterKey);
          const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
          if (!decryptedString) throw new Error("復号失敗");
          parsedData = JSON.parse(decryptedString);
        } else {
          parsedData = cloudData;
        }

        await Promise.all([
          AsyncStorage.setItem(
            "myScheduleData",
            JSON.stringify(parsedData.scheduleData || {}),
          ),
          AsyncStorage.setItem(
            "layerMasterData",
            JSON.stringify(parsedData.layerMaster || {}),
          ),
          AsyncStorage.setItem(
            "tagMasterData",
            JSON.stringify(parsedData.tagMaster || {}),
          ),
          AsyncStorage.setItem(
            "filterPresets",
            JSON.stringify(parsedData.presets || {}),
          ),
          AsyncStorage.setItem(
            "activeTags",
            JSON.stringify(parsedData.activeTags || []),
          ),
        ]);

        setScheduleData(parsedData.scheduleData || {});
        setLayerMaster(parsedData.layerMaster || {});
        setTagMaster(parsedData.tagMaster || {});
        setPresets(parsedData.presets || {});
        setActiveTags(parsedData.activeTags || []);

        Alert.alert("復元完了", "クラウドデータを正常に復元しました！🔓🚀");
        setConfigModalVisible(false);
      } else {
        Alert.alert(
          "データなし",
          "クラウド上にバックアップが見つかりませんでした。一度保存（ホームに戻る操作）を行ってください。",
        );
      }
    } catch (error) {
      console.error("Restore Error:", error);
      Alert.alert("エラー", "復元に失敗しました。通信環境を確認してください。");
    }
  };

  const formatEventTime = (item: ScheduleItem) => {
    if (!item.startDate || !item.endDate) {
      if (item.isAllDay) return "終日";
      if (item.startTime)
        return `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ""}`;
      return "";
    }

    const sDateObj = new Date(item.startDate);
    const eDateObj = new Date(item.endDate);
    const isSameDay = sDateObj.getTime() === eDateObj.getTime();

    if (item.isAllDay) {
      if (isSameDay) return "終日";
      return `${sDateObj.getMonth() + 1}/${sDateObj.getDate()} 〜 ${eDateObj.getMonth() + 1}/${eDateObj.getDate()} (終日)`;
    } else {
      if (isSameDay) {
        return `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ""}`;
      } else {
        return `${sDateObj.getMonth() + 1}/${sDateObj.getDate()} ${item.startTime || ""} 〜 ${eDateObj.getMonth() + 1}/${eDateObj.getDate()} ${item.endTime || ""}`;
      }
    }
  };

  const { dayTasks, upcomingTasks, dayEvents } = useMemo(() => {
    const items = expandedScheduleData[selectedDate] || [];
    const isAllLayers = activeTags.length === 0;
    const activeTagsSet = new Set(activeTags);

    const dTasks: ScheduleItem[] = [];
    const dEvents: ScheduleItem[] = [];

    items.forEach((item: ScheduleItem) => {
      const itemTags =
        item.tags && item.tags.length > 0
          ? item.tags
          : item.tag
            ? [item.tag]
            : [];
      const matchLayer =
        isAllLayers ||
        itemTags.some((tag: string) => {
          const parentLayer = tagMaster[tag]?.layer || tag;
          return activeTagsSet.has(parentLayer);
        });
      if (matchLayer) {
        if (item.isTodo) dTasks.push(item);
        if (item.isEvent) dEvents.push(item);
      }
    });

    const uTasks: (ScheduleItem & { date: string })[] = [];
    const dayTaskIds = new Set(dTasks.map((t) => t.id));
    const addedUpcomingIds = new Set<string>();

    if (activeMode === "todo") {
      const sortedDates = Object.keys(expandedScheduleData).sort();
      sortedDates.forEach((date) => {
        if (date > selectedDate) {
          (displayData[date] || []).forEach((task) => {
            if (
              task.isTodo &&
              !task.isDone &&
              !task.repeatType &&
              !dayTaskIds.has(task.id) &&
              !addedUpcomingIds.has(task.id)
            ) {
              const itemTags =
                task.tags && task.tags.length > 0
                  ? task.tags
                  : task.tag
                    ? [task.tag]
                    : [];
              if (
                isAllLayers ||
                itemTags.some((tag) => {
                  const parentLayer = tagMaster[tag]?.layer || tag;
                  return activeTagsSet.has(parentLayer);
                })
              ) {
                uTasks.push({ ...task, date });
                addedUpcomingIds.add(task.id);
              }
            }
          });
        }
      });
    }
    const sortByTime = (a: ScheduleItem, b: ScheduleItem) => {
      // 終日の予定は一番上に持ってくる
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;

      // 時間が設定されていない場合は一番下に
      const timeA = a.startTime || "24:00";
      const timeB = b.startTime || "24:00";
      return timeA.localeCompare(timeB);
    };

    dTasks.sort(sortByTime);
    dEvents.sort(sortByTime);

    // 今後の予定（upcomingTasks）は、まず日付順にしてから時間順にする
    uTasks.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return sortByTime(a, b);
    });

    return { dayTasks: dTasks, upcomingTasks: uTasks, dayEvents: dEvents };
  }, [
    expandedScheduleData,
    selectedDate,
    activeTags,
    activeMode,
    tagMaster,
    displayData,
  ]);

  const stableToggleTodo = useStableCallback(toggleTodo);
  const stableToggleSubTodo = useStableCallback(toggleSubTodo);
  const stableOpenEditModal = useStableCallback(openEditModal);
  const stableFormatEventTime = useStableCallback(formatEventTime);
  const stableLongPress = useStableCallback((item: ScheduleItem) => {
    setQuickActionItem(item);
    setQuickActionVisible(true);
  });

  if (isAppLocked) {
    return (
      <View
        style={[
          styles.container,
          {
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#F2F2F7",
          },
        ]}
      >
        <View
          style={{
            backgroundColor: "#FFF",
            padding: 30,
            borderRadius: 30,
            alignItems: "center",
            width: "80%",
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 10,
          }}
        >
          <Ionicons name="lock-closed" size={50} color={currentSolidColor} />
          <Text
            style={{
              marginTop: 15,
              fontSize: 18,
              fontWeight: "800",
              color: "#1C1C1E",
            }}
          >
            UniCal Locked
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: "#8E8E93",
              marginBottom: 25,
              marginTop: 5,
            }}
          >
            パスコードを入力してください
          </Text>

          <View style={styles.pinInputWrapper}>
            <TextInput
              style={styles.hiddenTextInput}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              value={pinForUnlock}
              onChangeText={(text) => {
                setPinForUnlock(text);
                if (text.length === 4) {
                  authenticatePin(text);
                }
              }}
            />

            <View style={styles.pinDisplayContainer}>
              {[...Array(4)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pinBox,
                    pinForUnlock.length === i && styles.pinBoxFocused,
                  ]}
                >
                  {pinForUnlock.length > i && (
                    <Text style={styles.pinDot}>●</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={{ marginTop: 25, padding: 10 }}
            onPress={handleAuthenticate}
          >
            <Text
              style={{
                color: currentSolidColor,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              生体認証を使用する
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: currentBgColor }]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: currentBgColor,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerTitleContainer}
          onPress={openFilterModal}
          activeOpacity={0.6}
        >
          <Text style={styles.headerPrefix}>INDEX / CATEGORY</Text>
          <View style={styles.headerMainRow}>
            <Text style={styles.headerText} numberOfLines={1}>
              {currentHeaderTitle}
            </Text>
            <Ionicons
              name="chevron-down-outline"
              size={14}
              color="#C7C7CC"
              style={{ marginLeft: 6 }}
            />
          </View>
        </TouchableOpacity>

        {/* 🌟 アイコンを横に並べるために View で包む */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* 🌟 検索ボタンを追加！ */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSearchModalVisible(true);
            }}
            style={{ padding: 8, marginRight: 5 }}
          >
            <Ionicons name="search-outline" size={24} color="#1C1C1E" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setConfigModalVisible(true);
            }}
            style={{ padding: 8 }}
          >
            <Ionicons name="settings-outline" size={24} color="#1C1C1E" />
          </TouchableOpacity>
        </View>
      </View>
      <TabBar themeColor={currentSolidColor} />
      <View style={styles.mainContent}>
        <View style={styles.calendarArea}>
          {activeMode === "calendar" ? (
            // 🌟 修正：起動直後は空っぽのViewを出して一瞬で画面を開かせ、0.1秒後にカレンダーをフワッと出す
            !isAppReady ? (
              <View
                style={{
                  height: 350,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="small" color={currentSolidColor} />
              </View>
            ) : (
              <CalendarList
                current={selectedDate}
                key={calendarKey}
                markingType={"multi-dot"}
                // 🌟 修正：前後6ヶ月の制限を外し、50ヶ月（約4年）に変更！
                pastScrollRange={50}
                futureScrollRange={50}
                // 🌟 修正：起動時に一気に描画する月数を「1ヶ月（今月）」だけに絞る（爆速化の要！）
                initialNumToRender={1}
                windowSize={3}
                maxToRenderPerBatch={2}
                updateCellsBatchingPeriod={30}
                removeClippedSubviews={true} // 見えない月をメモリから消して軽くする
                renderHeader={(date) => (
                  <View
                    style={[
                      styles.monthHeaderContainer,
                      {
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingRight: 15,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.monthformat, { color: currentSolidColor }]}
                    >
                      {date.getFullYear()}年 {date.getMonth() + 1}月
                    </Text>
                    <TouchableOpacity onPress={handleOpenNewModal}>
                      <Ionicons
                        name="add-circle"
                        size={30}
                        color={currentSolidColor}
                      />
                    </TouchableOpacity>
                  </View>
                )}
                horizontal
                pagingEnabled
                markedDates={currentMarkedDates}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                theme={{
                  calendarBackground: "transparent",
                  todayTextColor: "#FFF",
                  todayBackgroundColor: currentSolidColor + "33",
                  selectedDayBackgroundColor: currentSolidColor,
                }}
              />
            )
          ) : (
            <>
              {activeMode === "money" && (
                <View
                  style={[
                    styles.toggleContainer,
                    { marginHorizontal: 15, marginTop: 10 },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      !isMoneySummaryMode && styles.toggleActive,
                    ]}
                    onPress={() => setIsMoneySummaryMode(false)}
                  >
                    <View style={styles.toggleItem}>
                      <Ionicons
                        name="list"
                        size={16}
                        color={!isMoneySummaryMode ? "#1C1C1E" : "#8E8E93"}
                      />
                      <Text style={styles.toggleText}>日別詳細</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      isMoneySummaryMode && styles.toggleActive,
                    ]}
                    onPress={() => setIsMoneySummaryMode(true)}
                  >
                    <View style={styles.toggleItem}>
                      <Ionicons
                        name="pie-chart"
                        size={15}
                        color={isMoneySummaryMode ? "#1C1C1E" : "#8E8E93"}
                      />
                      <Text style={styles.toggleText}>予算管理</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {(activeMode === "todo" ||
                (activeMode === "money" && !isMoneySummaryMode)) && (
                <View style={styles.weekCalendarWrapper}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingRight: 20,
                    }}
                  >
                    <Text style={styles.monthLabel}>
                      {parseInt(selectedDate.split("-")[1])}月
                    </Text>
                    <TouchableOpacity onPress={handleOpenNewModal}>
                      <Ionicons
                        name="add-circle"
                        size={30}
                        color={currentSolidColor}
                      />
                    </TouchableOpacity>
                  </View>
                  <CalendarProvider
                    date={selectedDate}
                    onDateChanged={setSelectedDate}
                  >
                    <WeekCalendar
                      firstDay={1}
                      markedDates={currentMarkedDates}
                      theme={{
                        calendarBackground: "transparent",
                        todayTextColor: currentSolidColor,
                        selectedDayBackgroundColor: currentSolidColor,
                      }}
                    />
                  </CalendarProvider>
                </View>
              )}
            </>
          )}

          {activeMode === "calendar" && layerSummary && (
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: currentBgColor,
                  borderColor: currentSolidColor + "40",
                  marginHorizontal: 15, // 横幅をリストに合わせる
                  marginTop: 10, // カレンダーとの隙間
                  marginBottom: 0, // 下のリストとの隙間はリスト側に任せる
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Ionicons
                  name="analytics"
                  size={16}
                  color={currentSolidColor}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: currentSolidColor,
                    marginLeft: 6,
                  }}
                >
                  {parseInt(selectedDate.split("-")[1])}月の「
                  {layerSummary.targetLayer}」サマリー
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                }}
              >
                <Text
                  style={{ fontSize: 13, color: "#1C1C1E", fontWeight: "600" }}
                >
                  関連予定:{" "}
                  <Text style={{ fontSize: 18, fontWeight: "900" }}>
                    {layerSummary.eventCount}
                  </Text>{" "}
                  件
                </Text>
                <Text
                  style={{ fontSize: 13, color: "#1C1C1E", fontWeight: "600" }}
                >
                  支出合計:{" "}
                  <Text style={{ fontSize: 18, fontWeight: "900" }}>
                    ¥{layerSummary.totalExpense.toLocaleString()}
                  </Text>
                </Text>
              </View>
            </View>
          )}

          <ScrollView
            style={styles.scheduleList}
            contentContainerStyle={{ paddingBottom: 120 }}
            removeClippedSubviews={false}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
            {(() => {
              if (activeMode === "money") {
                return (
                  <MoneyDashboard
                    selectedDate={selectedDate}
                    activeTags={activeTags}
                    setHasUnsavedChanges={setHasUnsavedChanges}
                    isSummaryMode={isMoneySummaryMode}
                  />
                );
              }

              if (activeMode === "todo") {
                const [y, m, d] = selectedDate.split("-");
                const totalDayTasks = dayTasks.length;
                const completedDayTasks = dayTasks.filter(
                  (t) => t.isDone,
                ).length;
                const progress =
                  totalDayTasks > 0 ? completedDayTasks / totalDayTasks : 0;

                return (
                  <View style={styles.todoRoot}>
                    <View style={styles.modernHeader}>
                      <View style={styles.headerLabelRow}>
                        <Text
                          style={[
                            styles.mainDateTitle,
                            { color: currentSolidColor },
                          ]}
                        >
                          {parseInt(m)}月{parseInt(d)}日 の進捗
                        </Text>
                        <Text style={styles.numericProgress}>
                          {completedDayTasks} / {totalDayTasks}
                        </Text>
                      </View>
                      {totalDayTasks > 0 && (
                        <View style={styles.thinProgressBg}>
                          <View
                            style={[
                              styles.thinProgressFill,
                              {
                                width: `${progress * 100}%`,
                                backgroundColor: currentSolidColor,
                              },
                            ]}
                          />
                        </View>
                      )}
                    </View>

                    {(() => {
                      const routineTasks = dayTasks.filter((t) => t.repeatType);
                      const oneOffTasks = dayTasks.filter((t) => !t.repeatType);

                      return (
                        <>
                          {routineTasks.length > 0 && (
                            <View style={{ marginBottom: 16 }}>
                              <Text style={styles.upcomingMiniTitle}>
                                ROUTINE / 習慣
                              </Text>
                              {routineTasks.map((t) => {
                                const streakCount = calculateStreak(
                                  t.completedDates,
                                );
                                return (
                                  <TodoItem
                                    key={t.id}
                                    item={t}
                                    itemDate={selectedDate}
                                    selectedDate={selectedDate}
                                    formatEventTime={stableFormatEventTime}
                                    openEditModal={stableOpenEditModal}
                                    toggleTodo={stableToggleTodo}
                                    toggleSubTodo={stableToggleSubTodo}
                                    setEditingSubTaskInfo={
                                      setEditingSubTaskInfo
                                    }
                                    setSubTaskModalVisible={
                                      setSubTaskModalVisible
                                    }
                                    streakCount={streakCount}
                                    onLongPress={stableLongPress}
                                  />
                                );
                              })}
                            </View>
                          )}

                          {oneOffTasks.length > 0 && (
                            <View style={{ marginBottom: 16 }}>
                              <Text style={styles.upcomingMiniTitle}>
                                TODO / 単発タスク
                              </Text>
                              {oneOffTasks.map((t) => (
                                <TodoItem
                                  key={t.id}
                                  item={t}
                                  itemDate={selectedDate}
                                  selectedDate={selectedDate}
                                  formatEventTime={stableFormatEventTime}
                                  openEditModal={stableOpenEditModal}
                                  toggleTodo={stableToggleTodo}
                                  toggleSubTodo={stableToggleSubTodo}
                                  setEditingSubTaskInfo={setEditingSubTaskInfo}
                                  setSubTaskModalVisible={
                                    setSubTaskModalVisible
                                  }
                                  streakCount={0}
                                  onLongPress={stableLongPress}
                                />
                              ))}
                            </View>
                          )}
                        </>
                      );
                    })()}

                    {upcomingTasks.length > 0 && (
                      <View style={styles.upcomingSection}>
                        <Text style={styles.upcomingMiniTitle}>
                          今後の予定（未完了）
                        </Text>
                        {upcomingTasks.map((t) => {
                          const streakCount = t.repeatType
                            ? calculateStreak(t.completedDates)
                            : 0;
                          return (
                            <TodoItem
                              key={t.id}
                              item={t}
                              itemDate={t.date}
                              selectedDate={selectedDate}
                              formatEventTime={stableFormatEventTime}
                              openEditModal={stableOpenEditModal}
                              toggleTodo={stableToggleTodo}
                              toggleSubTodo={stableToggleSubTodo}
                              setEditingSubTaskInfo={setEditingSubTaskInfo}
                              setSubTaskModalVisible={setSubTaskModalVisible}
                              streakCount={streakCount}
                              onLongPress={stableLongPress}
                            />
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <View style={styles.listPadding}>
                  <Text style={styles.dateTitle}>{selectedDate} の予定</Text>
                  {dayEvents.map((item) => (
                    <EventItem
                      key={item.id}
                      item={item}
                      activeTags={activeTags}
                      tagMaster={tagMaster}
                      layerMaster={layerMaster}
                      formatEventTime={formatEventTime}
                      openEditModal={openEditModal}
                      onLongPress={(item) => {
                        setQuickActionItem(item);
                        setQuickActionVisible(true);
                      }}
                    />
                  ))}
                </View>
              );
            })()}
          </ScrollView>
        </View>
      </View>
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.filterModalContent}>
              <View style={styles.filterModalHeader}>
                <View>
                  <Text style={styles.filterModalTitle}>表示カテゴリ</Text>
                  <Text style={styles.filterModalSubTitle}>
                    PRESET / INDIVIDUAL
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.enhancedSettingsBtn}
                  onPress={() => {
                    setFilterModalVisible(false);
                    setTimeout(() => setLayerModalVisible(true), 300);
                  }}
                >
                  <Ionicons name="settings-sharp" size={16} color="#1C1C1E" />
                  <Text style={styles.settingsBtnLabel}>CONFIG</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.gridScrollArea}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.modalSectionLabel}>PRESETS</Text>
                </View>

                <View style={styles.presetContainer}>
                  {Object.keys(presets).map((pName) => {
                    const isMatch =
                      JSON.stringify([...tempActiveTags].sort()) ===
                      JSON.stringify([...(presets[pName] || [])].sort());
                    return (
                      <TouchableOpacity
                        key={pName}
                        style={[
                          styles.presetBtn,
                          isMatch && {
                            backgroundColor: "#1C1C1E",
                            borderColor: "#1C1C1E",
                          },
                        ]}
                        onPress={() => setTempActiveTags(presets[pName])}
                        onLongPress={() => handleLongPressPreset(pName)}
                      >
                        <Text
                          style={[
                            styles.presetBtnText,
                            isMatch && { color: "#FFF" },
                          ]}
                        >
                          {pName.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {tempActiveTags.length > 0 && (
                    <TouchableOpacity
                      style={styles.addPresetBtn}
                      onPress={handleOpenPresetModal}
                    >
                      <Ionicons name="add" size={16} color="#AEAEB2" />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[styles.modalSectionLabel, { marginTop: 20 }]}>
                  REGISTRY
                </Text>
                <View style={styles.gridContainer}>
                  <TouchableOpacity
                    style={[
                      styles.gridCard,
                      tempActiveTags.length === 0
                        ? { backgroundColor: "#1C1C1E", borderColor: "#1C1C1E" }
                        : styles.gridCardGhost,
                    ]}
                    onPress={() => setTempActiveTags([])}
                  >
                    <Ionicons
                      name={
                        tempActiveTags.length === 0
                          ? "checkmark-circle"
                          : "apps-outline"
                      }
                      size={20}
                      color={tempActiveTags.length === 0 ? "#FFF" : "#1C1C1E"}
                    />
                    <Text
                      style={[
                        styles.gridCardText,
                        tempActiveTags.length === 0 && { color: "#FFF" },
                      ]}
                    >
                      すべて表示
                    </Text>
                  </TouchableOpacity>

                  {/* 🌟 追加：システムレイヤー（同期ONの時だけ出現！） */}
                  {isExternalSyncEnabled && (
                    <TouchableOpacity
                      style={[
                        styles.gridCard,
                        tempActiveTags.includes("外部予定")
                          ? {
                              backgroundColor: "#FF2D55",
                              borderColor: "#FF2D55",
                            }
                          : [
                              styles.gridCardGhost,
                              { borderColor: "#FF2D5540" },
                            ],
                      ]}
                      onPress={() => toggleTempTag("外部予定")}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Ionicons
                          name={
                            tempActiveTags.includes("外部予定")
                              ? "checkmark-circle"
                              : "ellipse-outline"
                          }
                          size={16}
                          color={
                            tempActiveTags.includes("外部予定")
                              ? "#FFF"
                              : "#FF2D55"
                          }
                        />
                        <Text
                          style={[
                            styles.gridCardText,
                            tempActiveTags.includes("外部予定") && {
                              color: "#FFF",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          外部予定
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {Object.keys(layerMaster).map((layer) => {
                    const isSelected = tempActiveTags.includes(layer);
                    const isShared = Object.keys(sharedRooms).includes(layer);

                    return (
                      <TouchableOpacity
                        key={layer}
                        style={[
                          styles.gridCard,
                          isSelected
                            ? {
                                backgroundColor: layerMaster[layer],
                                borderColor: layerMaster[layer],
                              }
                            : [
                                styles.gridCardGhost,
                                { borderColor: layerMaster[layer] + "40" },
                              ],
                        ]}
                        onPress={() => toggleTempTag(layer)}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Ionicons
                            name={
                              isSelected
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={16}
                            color={isSelected ? "#FFF" : layerMaster[layer]}
                          />
                          {/* 🌟 文字が長すぎてもカードが崩れないように numberOfLines を追加 */}
                          <Text
                            style={[
                              styles.gridCardText,
                              isSelected && { color: "#FFF" },
                            ]}
                            numberOfLines={1}
                          >
                            {layer}
                          </Text>
                          {isShared && (
                            <Ionicons
                              name="cloud-outline"
                              size={14}
                              color={isSelected ? "#FFF" : "#C7C7CC"}
                            />
                          )}
                        </View>

                        {/* 🌟 追加：共有レイヤーの場合のみ、下に小さくIDを表示 */}
                        {isShared && (
                          <Text
                            style={{
                              fontSize: 8,
                              color: isSelected ? "#FFF" : "#8E8E93",
                              marginTop: 4,
                              fontFamily:
                                Platform.OS === "ios" ? "Menlo" : "monospace",
                            }}
                            numberOfLines={1}
                          >
                            ID: {sharedRooms[layer]}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  {
                    // 🌟 修正：選んだレイヤーが1つだけの時、その色にボタンを染める！
                    backgroundColor:
                      tempActiveTags.length === 1
                        ? tempActiveTags[0] === "外部予定"
                          ? "#FF2D55"
                          : layerMaster[tempActiveTags[0]] || "#1C1C1E"
                        : "#1C1C1E", // 複数選択時や未選択時はキリッとした黒に戻す
                  },
                ]}
                onPress={applyFilters}
              >
                <Text style={styles.confirmBtnText}>表示を確定する</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
      <PresetSaveModal
        visible={presetModalVisible}
        presetName={tempPresetName}
        setPresetName={setTempPresetName}
        onClose={() => {
          setPresetModalVisible(false);
          setTempPresetName("");
        }}
        onSave={confirmSavePreset}
      />
      <Modal
        visible={editPresetModalVisible}
        transparent={true}
        animationType="fade"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.namingOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.namingContent}>
                  <Text style={styles.namingLabel}>EDIT_PRESET</Text>
                  <Text style={styles.namingTitle}>プリセット名の編集</Text>

                  <TextInput
                    style={styles.namingInput}
                    value={editingPresetName}
                    onChangeText={setEditingPresetName}
                    autoFocus={true}
                  />

                  <View
                    style={[
                      styles.namingActionRow,
                      { justifyContent: "space-between" },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.namingCancelBtn}
                      onPress={() => deletePreset(editingPresetOriginalName)}
                    >
                      <Text
                        style={[styles.namingCancelText, { color: "#FF3B30" }]}
                      >
                        削除
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        style={styles.namingCancelBtn}
                        onPress={() => setEditPresetModalVisible(false)}
                      >
                        <Text style={styles.namingCancelText}>キャンセル</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.namingConfirmBtn}
                        onPress={saveEditedPreset}
                      >
                        <Text style={styles.namingConfirmText}>保存</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
      <ScheduleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedDate={selectedDate}
        selectedItem={selectedItem}
        activeMode={activeMode}
        scheduleData={scheduleData}
        setScheduleData={setScheduleData}
        layerMaster={layerMaster}
        tagMaster={tagMaster}
        setTagMaster={setTagMaster}
        setHasUnsavedChanges={setHasUnsavedChanges}
      />
      <LayerManagementModal
        visible={layerModalVisible}
        onClose={() => setLayerModalVisible(false)}
        layerMaster={layerMaster}
        setLayerMaster={setLayerMaster}
        setHasUnsavedChanges={setHasUnsavedChanges}
      />
      <StatusBar style="auto" />
      <ConfigModal
        visible={configModalVisible}
        onClose={() => {
          setConfigModalVisible(false);
          AsyncStorage.getItem("externalCalendarSync").then((val) =>
            setIsExternalSyncEnabled(val === "true"),
          );
        }}
        lastSyncedAt={lastSyncedAt}
        onRestore={handleRestore}
        onBackup={handleManualBackup} // 🌟 追加
        sharedRooms={sharedRooms} // 🌟 追加
        onAddSharedRoom={handleAddSharedRoom} // 🌟 追加
        onDeleteAccount={handleDeleteAccount}
      />
      <SubTaskEditModal
        visible={subTaskModalVisible}
        onClose={() => setSubTaskModalVisible(false)}
        subTask={editingSubTaskInfo?.subTask || null}
        onSave={handleSubTaskSave}
        onDelete={handleSubTaskDelete}
        themeColor={currentSolidColor}
      />
      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        scheduleData={scheduleData}
        themeColor={currentSolidColor}
        layerMaster={layerMaster} // 🌟 これ
        tagMaster={tagMaster} // 🌟 これ
        onItemPress={(item, date) => {
          setSelectedDate(date);
          setSelectedItem(item);
          setModalVisible(true);
        }}
      />
      {/* 🌟 修正：Propsを追加 */}
      {quickActionItem && ( // 🌟 この行を追加（データがある時だけ表示）
        <QuickActionModal
          visible={quickActionVisible}
          onClose={() => setQuickActionVisible(false)}
          item={quickActionItem} // 🌟 nullにならないことが保証されるのでエラーが消える！
          themeColor={currentSolidColor}
          onDelete={handleQuickDelete}
          onEditDetail={(item) => {
            setSelectedItem(item);
            setModalVisible(true);
          }}
          onQuickSave={handleQuickSave}
          sharedRooms={sharedRooms}
          layerMaster={layerMaster}
          onMoveOrCopy={handleMoveOrCopy}
        />
      )}{" "}
      {/* 🌟 閉じカッコを追加 */}
      {/*広告用 */}
      <OnboardingModal
        visible={onboardingVisible}
        onComplete={handleCompleteOnboarding}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainContent: { flex: 1, backgroundColor: "transparent" },
  calendarArea: { flex: 1, width: "100%" },
  weekCalendarWrapper: { height: 130 },
  monthLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 20,
    marginTop: 10,
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 10 : 65,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F2F2F7",
  },
  headerTitleContainer: { alignItems: "flex-start" },
  headerPrefix: {
    fontSize: 10,
    fontWeight: "600",
    color: "#AEAEB2",
    letterSpacing: 2,
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  headerMainRow: { flexDirection: "row", alignItems: "center" },
  headerText: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  scheduleList: { flex: 1, padding: 15 },
  listPadding: { paddingBottom: 20 },
  dateTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#666",
  },
  monthHeaderContainer: { width: "100%", alignItems: "flex-start" },
  monthformat: {
    fontSize: 28,
    paddingLeft: 10,
    paddingBottom: 5,
    fontWeight: "bold",
  },

  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggleActive: {
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  toggleText: { color: "#8E8E93", fontWeight: "bold", fontSize: 13 },

  todoRoot: { paddingHorizontal: 5 },
  modernHeader: { marginBottom: 20, marginTop: 5 },
  headerLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  mainDateTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  numericProgress: { fontSize: 13, fontWeight: "600", color: "#8E8E93" },
  thinProgressBg: {
    height: 4,
    backgroundColor: "#E5E5EA",
    borderRadius: 2,
    overflow: "hidden",
  },
  thinProgressFill: { height: "100%", borderRadius: 2 },
  upcomingSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 15,
  },
  upcomingMiniTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#AEAEB2",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  todoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F2F2F7",
    minHeight: 56,
  },
  todoCardDone: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    opacity: 0.5,
  },
  stripeContainer: {
    flexDirection: "row",
    height: "60%",
    marginLeft: 8,
    gap: 2,
  },
  todoAccent: { width: 4, height: "100%", borderRadius: 2 },
  todoContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  todoMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  todoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
    flex: 1,
    marginRight: 8,
  },
  todoTitleDone: { color: "#8E8E93", textDecorationLine: "line-through" },
  miniTagBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  miniTagText: { fontSize: 8, fontWeight: "bold" },
  todoSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
    gap: 6,
  },
  todoTimeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  todoTimeText: { fontSize: 10, color: "#8E8E93", fontWeight: "500" },
  checkButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  deadlineBadgeUrgent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    shadowColor: "#FF3B30",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  deadlineBadgeTextUrgent: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  deadlineBadgeSafe: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5F9E7",
    borderWidth: 1,
    borderColor: "#34C759",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  deadlineBadgeTextSafe: {
    color: "#34C759",
    fontSize: 9,
    fontWeight: "700",
  },

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  itemTitle: { flex: 1, fontSize: 15, color: "#333", fontWeight: "bold" },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  tagText: { color: "#fff", fontSize: 9, fontWeight: "bold" },
  itemMain: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeTextSmall: {
    fontSize: 10,
    color: "#8E8E93",
    fontWeight: "bold",
    marginLeft: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterModalContent: {
    width: "90%",
    height: "75%",
    backgroundColor: "#FFF",
    borderRadius: 28,
    padding: 24,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  filterModalTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  filterModalSubTitle: {
    fontSize: 10,
    color: "#C7C7CC",
    textTransform: "uppercase",
  },
  gridScrollArea: { marginBottom: 20 },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  gridCard: {
    width: "48%",
    height: 70,
    paddingVertical: 16,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  gridCardGhost: { backgroundColor: "transparent", borderColor: "#F2F2F7" },
  gridCardText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  confirmBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  confirmBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  modalSectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#C7C7CC",
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  presetContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  presetBtnText: { fontSize: 10, fontWeight: "700", color: "#8E8E93" },
  addPresetBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C7C7CC",
    borderStyle: "dashed",
  },
  enhancedSettingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  settingsBtnLabel: {
    fontSize: 10,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  namingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  namingContent: {
    width: "80%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
  },
  namingLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#C7C7CC",
    letterSpacing: 1.5,
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  namingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 20,
  },
  namingInput: {
    backgroundColor: "#F2F2F7",
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 20,
  },
  namingActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  namingCancelBtn: { padding: 10 },
  namingCancelText: { fontSize: 12, fontWeight: "700", color: "#8E8E93" },
  namingConfirmBtn: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  namingConfirmText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  subTaskListContainer: {
    marginLeft: 20,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E5EA",
    marginTop: 6,
    gap: 6,
  },
  subTaskMiniCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8FA",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  subTaskMiniTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },

  pinInputWrapper: {
    marginTop: 10,
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  hiddenTextInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
    zIndex: 1,
  },
  pinDisplayContainer: { flexDirection: "row", gap: 15 },
  pinBox: {
    width: 55,
    height: 65,
    borderWidth: 1,
    borderRadius: 16,
    borderColor: "#C7C7CC",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  pinBoxFocused: {
    borderColor: "#1C1C1E",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  pinDot: { fontSize: 36, color: "#1C1C1E" },

  adContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
    paddingBottom: Platform.OS === "ios" ? 0 : 5, // iPhoneのホームバー対策
  },
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
});
