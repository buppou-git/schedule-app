import "react-native-get-random-values";

import { useAppModals } from "../../hooks/useAppModals"; // パスは適宜合わせてください
import { styles } from "./index.styles";

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


import { useAppLock } from "../../hooks/useAppLock";
import { useCloudSync } from "../../hooks/useCloudSync";
import { useDailyItems, useDisplayData } from "../../hooks/useDataProcessors";
import { useScheduleManager } from "../../hooks/useScheduleManager";
import AppLockScreen from "./components/AppLockScreen";

import { ScheduleItem, SubTask } from "../../types";

import { useCalendarData } from "../../hooks/useCalendarData";
import { useNotificationManager } from "../../hooks/useNotificationManager";

import { signInAnonymously } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { AppState } from "react-native";
import { auth, db } from "../../firebaseConfig";


import { useAppStore } from "../../store/useAppStore";

import OnboardingModal from "./components/OnboardingModal";

import PresetSaveModal from "./components/PresetSaveModal";

//広告関係
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import {
  BannerAd,
  BannerAdSize,
  MobileAds,
  TestIds,
} from "react-native-google-mobile-ads";

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";

import CryptoJS from "crypto-js";
import * as SecureStore from "expo-secure-store";

import {
  CalendarList,
  CalendarProvider,
  WeekCalendar,
} from "react-native-calendars";

import ConfigModal from "./components/ConfigModal/ConfigModal";
import { EventDashboard } from "./components/EventDashboard";
import ExternalEventModal from "./components/ExternalEventModal";
import LayerManagementModal from "./components/LayerManagementModal";
import MoneyDashboard from "./components/MoneyDashboard";
import QuickActionModal from "./components/QuickActionModal";
import ScheduleModal from "./components/ScheduleModal/ScheduleModal";
import SearchModal from "./components/SearchModal"; // 🌟 これを追加
import SubTaskEditModal from "./components/SubTaskEditModal";
import TabBar from "./components/TabBar";
import { TodoDashboard } from "./components/TodoDashboard";

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

function IndexContent() {
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

  // 🌟 モーダル関連のStateを一括管理！
  const {
    configModalVisible, setConfigModalVisible,
    layerModalVisible, setLayerModalVisible,
    onboardingVisible, setOnboardingVisible,
    searchModalVisible, setSearchModalVisible,
    filterModalVisible, setFilterModalVisible,
    modalVisible, setModalVisible,
    selectedItem, setSelectedItem,
    quickActionVisible, setQuickActionVisible,
    quickActionItem, setQuickActionItem,
    externalModalVisible, setExternalModalVisible,
    selectedExternalItem, setSelectedExternalItem,
    subTaskModalVisible, setSubTaskModalVisible,
    editingSubTaskInfo, setEditingSubTaskInfo,
    presetModalVisible, setPresetModalVisible,
    editPresetModalVisible, setEditPresetModalVisible,
  } = useAppModals();

  const [presets, setPresets] = useState<{ [key: string]: string[] }>({});

  const [sharedRooms, setSharedRooms] = useState<{
    [layerName: string]: string;
  }>({});

  const { roomSchedules, safeDebouncedSync } = useCloudSync(sharedRooms);

  const {
    isAppLocked,
    pinForUnlock,
    setPinForUnlock,
    handleAuthenticate,
    authenticatePin,
  } = useAppLock();

  const [sharedScheduleData, setSharedScheduleData] = useState<{
    [key: string]: ScheduleItem[];
  }>({});

  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const { scheduleData, setScheduleData, lastSyncedAt } = useScheduleManager();

  const [isExternalSyncEnabled, setIsExternalSyncEnabled] = useState(false);

  const { externalEvents } = useExternalCalendar(selectedDate, isExternalSyncEnabled);

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



  const handleCopyExternal = (item: ScheduleItem) => {
    // 外部予定特有のデータを剥がす
    const { externalEventId, color, ...rest } = item;

    const newItem: ScheduleItem = {
      ...(rest as ScheduleItem), // 🌟 rest を ScheduleItem として扱う
      id: `copy-${Date.now()}`,
      isEvent: true, // アプリ内の予定として扱う
    };

    setExternalModalVisible(false);
    setSelectedItem(newItem);
    setModalVisible(true);
  };

  const handleHideExternal = (item: ScheduleItem) => {
    Alert.alert("非表示", "この外部予定をアプリから非表示にしますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "非表示にする",
        style: "destructive",
        onPress: async () => {
          // 🌟 ここに async を追加！
          setExternalModalVisible(false);

          // 🌟 1. 用意してあった非表示リスト(State)にこの予定のIDを追加する
          const newHiddenIds = [...hiddenExternalIds, item.id];
          setHiddenExternalIds(newHiddenIds);

          // 🌟 2. 次回アプリを開いた時も消えたままになるようにローカルストレージに保存！
          await AsyncStorage.setItem(
            "hiddenExternalIds",
            JSON.stringify(newHiddenIds),
          );

          // ※ 外部予定は scheduleData にはないので、scheduleDataをいじる処理は削除してOKです！
        },
      },
    ]);
  };

  const [isMoneySummaryMode, setIsMoneySummaryMode] = useState(false);

  const [activeTags, setActiveTags] = useState<string[]>([]);



  const [isAppReady, setIsAppReady] = useState(false);

  // サマリーの開閉状態を記憶するフラグ
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

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


  const [tempPresetName, setTempPresetName] = useState("");
  const [tempActiveTags, setTempActiveTags] = useState<string[]>([]);


  const [editingPresetOriginalName, setEditingPresetOriginalName] =
    useState("");
  const [editingPresetName, setEditingPresetName] = useState("");

  const [calendarResetKey, setCalendarResetKey] = useState(0);
  const calendarKey = useMemo(
    () => `${activeMode}-${calendarResetKey}`,
    [activeMode, calendarResetKey],
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);


  const openFilterModal = useCallback(() => {
    setTempActiveTags(activeTags);
    setFilterModalVisible(true);
  }, [activeTags]);

  const toggleTempTag = useCallback(
    (layer: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTempActiveTags((prev) => {
        return prev.includes(layer)
          ? prev.filter((t) => t !== layer)
          : [...prev, layer];
      });
    },
    [], // 🌟 依存配列も空になってパフォーマンスUP！
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

  // 🌟 追加：非表示にした外部予定のIDを管理するState
  const [hiddenExternalIds, setHiddenExternalIds] = useState<string[]>([]);

  // 🌟 追加：アプリ起動時に非表示リストを読み込む
  useEffect(() => {
    AsyncStorage.getItem("hiddenExternalIds").then((data) => {
      if (data) setHiddenExternalIds(JSON.parse(data));
    });
  }, []);

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

  // 🌟 追加：起動した直後かどうかを判定するフラグ
  const isFirstRenderForSync = useRef(true);

  useEffect(() => {
    // 🌟 追加：アプリ起動直後（まだデータが空の時）は、保存処理を強制キャンセル！
    if (isFirstRenderForSync.current) {
      isFirstRenderForSync.current = false;
      return;
    }

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

  // 🌟 修正：最強の軽量化版！無駄な再計算をゼロにする
  const coloredScheduleData = useMemo(() => {
    let hasAnyChange = false;
    const nextData: { [date: string]: ScheduleItem[] } = {};

    Object.keys(scheduleData).forEach((date) => {
      let dateChanged = false;
      const newItems = scheduleData[date].map((item) => {
        const itemTag = item.tag || (item.tags && item.tags[0]);
        // 常に最新の色を取得
        const latestColor = itemTag && tagMaster[itemTag] ? tagMaster[itemTag].color : item.color;

        // 🌟 ここが爆速化の鍵！「色が本当に変わった時」だけ新しいデータを作る
        if (item.color !== latestColor) {
          dateChanged = true;
          return { ...item, color: latestColor };
        }
        return item; // 変わっていなければ、元のデータをそのまま使い回す！
      });

      if (dateChanged) {
        nextData[date] = newItems;
        hasAnyChange = true;
      } else {
        nextData[date] = scheduleData[date]; // 変わっていなければ、元の配列を使い回す！
      }
    });

    // 🌟 1つも色の変更がなければ、大元の scheduleData をそのまま返す（これで再描画ラグがゼロになります）
    return hasAnyChange ? nextData : scheduleData;
  }, [scheduleData, tagMaster]);

  const displayData = useDisplayData(
    coloredScheduleData,
    externalEvents,
    roomSchedules,
    activeTags,
    tagMaster,
  );


  const { expandedScheduleData, currentMarkedDates } = useCalendarData(
    displayData,
    activeMode,
    activeTags,
    layerMaster,
    tagMaster,
    selectedDate,
    hiddenExternalIds,
  );

  const { dayTasks, upcomingTasks, dayEvents } = useDailyItems(
    expandedScheduleData,
    displayData,
    selectedDate,
    activeTags,
    activeMode,
    tagMaster,
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
    if (item.tag === "祝日" || item.category === "祝日") {
      return;
    }

    // 🌟 最強の判定
    if (item.id && String(item.id).startsWith("ext_")) {
      setSelectedExternalItem(item);
      setExternalModalVisible(true);
    } else {
      // 普通の予定なら今までの編集モーダルを開く
      setSelectedItem(item);
      setModalVisible(true);
    }
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
    safeDebouncedSync(targetItem, originalDate);

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
        safeDebouncedSync(updatedParentItem, targetDate);

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
      safeDebouncedSync(updatedItem, targetDate);
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

  const stableToggleTodo = useStableCallback(toggleTodo);
  const stableToggleSubTodo = useStableCallback(toggleSubTodo);
  const stableOpenEditModal = useStableCallback(openEditModal);
  const stableFormatEventTime = useStableCallback(formatEventTime);
  const stableLongPress = useStableCallback((item: ScheduleItem) => {
    if (item.tag === "祝日" || item.category === "祝日") {
      return;
    }

    // 🌟 最強の判定
    if (item.id && String(item.id).startsWith("ext_")) {
      setSelectedExternalItem(item);
      setExternalModalVisible(true);
    } else {
      // アプリ内で作成した予定は、今まで通り編集モーダルを開く
      setQuickActionItem(item);
      setQuickActionVisible(true);
    }
  });

  if (isAppLocked) {
    return (
      <AppLockScreen
        currentSolidColor={currentSolidColor}
        pinForUnlock={pinForUnlock}
        setPinForUnlock={setPinForUnlock}
        authenticatePin={authenticatePin}
        handleAuthenticate={handleAuthenticate}
      />
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
                renderHeader={(date) => {
                  // 🌟 修正：時差でズレないように、ファイル上部で定義されている getTodayString を使う！
                  const todayStr = getTodayString();

                  return (
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
                        style={[
                          styles.monthformat,
                          { color: currentSolidColor },
                        ]}
                      >
                        {date.getMonth() + 1}
                      </Text>

                      {/* 右側のボタン群 */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        {/* 🌟 追加：「今日に戻る」アイコンボタン */}
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedDate(todayStr); // 今日の日付をセット
                            setCalendarResetKey((prev) => prev + 1); // 🌟 追加：カレンダーを強制リフレッシュして定位置に戻す！
                          }}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: currentSolidColor + "10", // テーマカラーの超薄い背景(10%)
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: currentSolidColor + "30", // テーマカラーの薄いボーダー(30%)
                            shadowColor: "#000", // かすかに影をつけて立体感を出す
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          <Ionicons
                            name="return-down-back-outline" // シンプルなカレンダーアイコン
                            size={20}
                            color={currentSolidColor}
                          />
                        </TouchableOpacity>

                        {/* 既存の追加ボタン */}
                        <TouchableOpacity onPress={handleOpenNewModal}>
                          <Ionicons
                            name="add-circle"
                            size={32} // アイコンボタンと並べるため、少し大きく調整（28->32）
                            color={currentSolidColor}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
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
                      {/* 🌟 変更：「今日に戻る」ボタンと「＋」ボタンを横並びにする */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <TouchableOpacity
                          onPress={() => setSelectedDate(getTodayString())}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: currentSolidColor + "10", // 月間カレンダーと同じ美しい透け感
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: currentSolidColor + "30",
                            shadowColor: "#000",
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          <Ionicons
                            name="return-down-back-outline" // 同じアイコンを使用
                            size={18}
                            color={currentSolidColor}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleOpenNewModal}>
                          <Ionicons
                            name="add-circle"
                            size={30}
                            color={currentSolidColor}
                          />
                        </TouchableOpacity>
                      </View>
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
                          todayTextColor: "#FFF",
                          todayBackgroundColor: currentSolidColor + "33",
                          selectedDayBackgroundColor: currentSolidColor,
                        }}
                      />
                    </CalendarProvider>
                  </View>
                )}
            </>
          )}

          {activeMode === "calendar" && layerSummary && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsSummaryExpanded(!isSummaryExpanded);
              }}
              style={[
                styles.summaryCard,
                {
                  backgroundColor: currentBgColor,
                  borderColor: currentSolidColor + "40",
                  marginHorizontal: 15,
                  marginTop: 10,
                },
              ]}
            >
              {/* 🌟 ヘッダー部分（常に表示される） */}
              <View style={styles.summaryHeader}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <Ionicons
                    name="analytics"
                    size={16}
                    color={currentSolidColor}
                  />
                  <Text
                    style={[
                      styles.summaryHeaderText,
                      { color: currentSolidColor },
                    ]}
                  >
                    {parseInt(selectedDate.split("-")[1])}月のサマリー
                  </Text>
                </View>

                {/* 🌟 閉じてる時は合計額だけ右端にチラ見せ */}
                {!isSummaryExpanded && (
                  <Text
                    style={[
                      styles.summaryTotalMini,
                      { color: currentSolidColor },
                    ]}
                  >
                    ¥{layerSummary.totalExpense.toLocaleString()}
                  </Text>
                )}

                <Ionicons
                  name={isSummaryExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={currentSolidColor}
                />
              </View>

              {/* 🌟 詳細部分（開いた時だけ表示される） */}
              {isSummaryExpanded && (
                <View style={styles.summaryDetailContainer}>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>対象レイヤー</Text>
                      <Text style={styles.summaryValue}>
                        {layerSummary.targetLayer}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>関連予定</Text>
                      <Text style={styles.summaryValue}>
                        {layerSummary.eventCount}
                        <Text style={styles.unit}>件</Text>
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>支出合計</Text>
                      <Text style={[styles.summaryValue, { color: "#FF3B30" }]}>
                        ¥{layerSummary.totalExpense.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* 🌟 構造改革：ToDoモード（独立してFlatListの恩恵を受ける！） */}
          {activeMode === "todo" && (
            <View style={{ flex: 1 }}>
              <TodoDashboard
                dayTasks={dayTasks}
                upcomingTasks={upcomingTasks}
                selectedDate={selectedDate}
                currentSolidColor={currentSolidColor}
                formatEventTime={stableFormatEventTime}
                openEditModal={stableOpenEditModal}
                toggleTodo={stableToggleTodo}
                toggleSubTodo={stableToggleSubTodo}
                setEditingSubTaskInfo={setEditingSubTaskInfo}
                setSubTaskModalVisible={setSubTaskModalVisible}
                onLongPress={stableLongPress}
                calculateStreak={calculateStreak}
              />
            </View>
          )}

          {/* 🌟 構造改革：カレンダーモード（これも独立させてFlatListの恩恵を受ける！） */}
          {activeMode === "calendar" && (
            <View style={{ flex: 1 }}>
              <EventDashboard
                dayEvents={dayEvents}
                selectedDate={selectedDate}
                currentSolidColor={currentSolidColor}
                activeTags={activeTags}
                tagMaster={tagMaster}
                layerMaster={layerMaster}
                formatEventTime={stableFormatEventTime}
                openEditModal={stableOpenEditModal}
                onLongPress={stableLongPress}
              />
            </View>
          )}

          {/* 🌟 家計簿モードのみ ScrollView を残す */}
          {activeMode === "money" && (
            <ScrollView
              style={styles.scheduleList}
              contentContainerStyle={{ paddingBottom: 120 }}
              removeClippedSubviews={false}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
            >
              <MoneyDashboard
                selectedDate={selectedDate}
                activeTags={activeTags}
                setHasUnsavedChanges={setHasUnsavedChanges}
                isSummaryMode={isMoneySummaryMode}
              />
            </ScrollView>
          )}
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
      {modalVisible && (
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
      )}
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
        onClose={() => setConfigModalVisible(false)}
        onExternalSyncChange={(val) => {
          setIsExternalSyncEnabled(val);
          // 🌟 追加：ON/OFFが切り替わった瞬間に、カレンダーを強制的に再起動して予定を出現させる！
          setCalendarResetKey((prev) => prev + 1);
        }}
        lastSyncedAt={lastSyncedAt}
        onRestore={handleRestore}
        onBackup={handleManualBackup}
        sharedRooms={sharedRooms}
        onAddSharedRoom={handleAddSharedRoom}
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
        scheduleData={expandedScheduleData}
        themeColor={currentSolidColor}
        layerMaster={layerMaster}
        tagMaster={tagMaster}
        onItemPress={(item, date) => {
          setSelectedDate(date);
          openEditModal(item);
        }}
      />
      {quickActionItem && (
        <QuickActionModal
          visible={quickActionVisible}
          onClose={() => setQuickActionVisible(false)}
          item={quickActionItem}
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
      )}
      <OnboardingModal
        visible={onboardingVisible}
        onComplete={handleCompleteOnboarding}
      />
      <ExternalEventModal
        visible={externalModalVisible}
        onClose={() => setExternalModalVisible(false)}
        item={selectedExternalItem}
        onCopy={handleCopyExternal}
        onHide={handleHideExternal}
        onSaveExpense={(item, amount, category) => {
          const newData = { ...scheduleData };
          const dateKey = selectedDate;
          if (!newData[dateKey]) newData[dateKey] = [];

          // 既存の上書きデータがあれば削除して新しく追加
          const rawId = item.id.replace("ext_", "");
          newData[dateKey] = newData[dateKey].filter(
            (i) => i.externalEventId !== rawId && i.id !== item.id,
          );

          newData[dateKey].push({
            ...item,
            id: `ext_ovr_${Date.now()}`,
            externalEventId: rawId,
            amount: Number(amount),
            category,
            isExpense: Number(amount) > 0,
            isEvent: true, // 🌟 必須：「予定」として認識させる
            tags: ["外部予定"], // 🌟 これを追加することで DailyExpense 側に確実に反映される！
            color: "#FF2D55",
          });

          setScheduleData(newData);
          setHasUnsavedChanges(true);
          setExternalModalVisible(false);
          Alert.alert("保存完了", "支出情報を予定に紐付けました。");
        }}
      />
      <View style={styles.adContainer}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>
    </SafeAreaView>
  );
}



import { ErrorBoundary } from "./components/ErrorBoundary";

// 🌟 これが「外側からバリアを張った」新しいメイン画面！
export default function Index() {
  return (
    <ErrorBoundary>
      <IndexContent />
    </ErrorBoundary>
  );
}