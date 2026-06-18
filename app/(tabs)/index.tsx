import "react-native-get-random-values";

import { resolveTags } from "../../utils/tagUtils";

import * as Linking from "expo-linking";

import * as Clipboard from "expo-clipboard";

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
import { AppState, InteractionManager } from "react-native";
import { auth, db } from "../../firebaseConfig";

import { useAppStore } from "../../store/useAppStore";

import OnboardingModal from "./components/OnboardingModal";

import PresetSaveModal from "./components/PresetSaveModal";

//広告関係
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import mobileAds, {
  BannerAd,
  BannerAdSize,
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
  View,
} from "react-native";

const adUnitId =
  Platform.select({
    ios: "ca-app-pub-1562451958384100/1845145269", // iOS用の広告ユニットID
    android: "ca-app-pub-3940256099942544~3347511713", // Android用の広告ユニットID
  }) || "";
// 開発中は安全なテスト広告、本番で本物が出るようにする魔法
const bannerId = __DEV__ ? TestIds.BANNER : adUnitId;

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
  const [debugMessage, setDebugMessage] = useState("");

  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  const handleShareRoom = async (roomId: string) => {
    // 🌟 修正1：部屋IDから、自分がつけているカテゴリ名を逆引きする
    const myLayerName =
      Object.keys(sharedRooms).find((key) => sharedRooms[key] === roomId) ||
      "共有カレンダー";

    // 🌟 修正2：URLの末尾に「&name=エンコードした名前」をこっそり忍ばせて発行する！
    // （encodeURIComponentを使うことで、日本語の文字化けを防ぎます）
    const url = `https://multi-calendar-app-1379f.web.app/join?room=${roomId}&name=${encodeURIComponent(myLayerName)}`;

    await Clipboard.setStringAsync(url);

    Alert.alert("リンクをコピーしました", url);
  };

  // 🌟 起動直後のロードのズレを100%防ぐ超安全版に強化
  const handleAddSharedRoom = async (
    layerName: string,
    roomId: string,
    color?: string,
  ) => {
    const storedRoomsStr = await AsyncStorage.getItem("sharedRoomsData");
    const currentRooms = storedRoomsStr ? JSON.parse(storedRoomsStr) : {};

    const newRooms = { ...currentRooms, [layerName]: roomId };
    setSharedRooms(newRooms);
    await AsyncStorage.setItem("sharedRoomsData", JSON.stringify(newRooms));

    const storedLayersStr = await AsyncStorage.getItem("layerMasterData");
    const currentLayers = storedLayersStr ? JSON.parse(storedLayersStr) : {};

    // 🌟 修正：「既に存在しているから無視」という条件を外し、指定された色を最優先で確実に適用する！
    const PRESET_COLORS = [
      "#FF3B30",
      "#FF9500",
      "#FFCC00",
      "#34C759",
      "#007AFF",
      "#5856D6",
      "#AF52DE",
    ];

    const targetColor =
      color ||
      currentLayers[layerName] || // 色指定がなければ既存の色を維持
      PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];

    const newLayerMaster = { ...currentLayers, [layerName]: targetColor };
    setLayerMaster(newLayerMaster);

    await AsyncStorage.setItem(
      "layerMasterData",
      JSON.stringify(newLayerMaster),
    );
    setCalendarResetKey((prev) => prev + 1);
  };

  // 🌟 追加：共有カレンダーの個別削除（接続解除）関数
  const handleDeleteSharedRoom = useCallback(async (layerName: string) => {
    setSharedRooms((prev) => {
      const next = { ...prev };
      delete next[layerName];
      AsyncStorage.setItem("sharedRoomsData", JSON.stringify(next));
      return next;
    });
  }, []);

  // 🌟 無限ループ防止版＆名前自動入力版：URLの読み取り処理
  useEffect(() => {
    // 🌟 追加：同じURLを何度も処理しないように記憶しておく「メモ帳」
    let lastProcessedUrl = "";

    const handleUrl = (url: string | null) => {
      if (!url) return;
      if (url === lastProcessedUrl) return; // 🌟 すでに処理済みのURLなら無視する！

      if (!url) return;
      const parsedUrl = Linking.parse(url);

      const isJoinLink = url.includes("room=");

      if (isJoinLink) {
        lastProcessedUrl = url; // 🌟 処理したURLをメモ帳に書き込む

        const roomId = parsedUrl.queryParams?.room
          ? String(parsedUrl.queryParams.room)
          : url.split("room=")[1]?.split("&")[0];

        if (!roomId) return;

        // 🌟 追加：URLの中に「作成者の名前（name=）」が入っていたら抽出する！
        let defaultName = `共有_${roomId.slice(0, 4)}`;
        const nameParam = parsedUrl.queryParams?.name
          ? String(parsedUrl.queryParams.name)
          : url.includes("name=")
            ? decodeURIComponent(url.split("name=")[1]?.split("&")[0] || "")
            : null;

        if (nameParam) {
          defaultName = nameParam;
        }

        setDeepLinkRoomId(roomId);
        setDeepLinkRoomName(defaultName); // 🌟 抽出した名前をセット！
        setDeepLinkRoomColor("#007AFF");
        setDeepLinkJoinVisible(true);
      }
    };

    Linking.getInitialURL().then(handleUrl);

    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []); // 🌟 修正：空っぽにすることで、無限ループを完全に断ち切ります！

  useEffect(() => {
    const initAds = async () => {
      try {
        // 1. iOSのトラッキング許可を求める
        const { status } = await requestTrackingPermissionsAsync();
        // 2. 広告SDKを初期化
        await mobileAds().initialize();
      } catch (e) {
        console.error("Ads initialization error:", e);
      }
    };
    initAds();
  }, []);

  // 🌟 モーダル関連のStateを一括管理！
  const {
    configModalVisible,
    setConfigModalVisible,
    layerModalVisible,
    setLayerModalVisible,
    onboardingVisible,
    setOnboardingVisible,
    searchModalVisible,
    setSearchModalVisible,
    filterModalVisible,
    setFilterModalVisible,
    modalVisible,
    setModalVisible,
    selectedItem,
    setSelectedItem,
    quickActionVisible,
    setQuickActionVisible,
    quickActionItem,
    setQuickActionItem,
    externalModalVisible,
    setExternalModalVisible,
    selectedExternalItem,
    setSelectedExternalItem,
    subTaskModalVisible,
    setSubTaskModalVisible,
    editingSubTaskInfo,
    setEditingSubTaskInfo,
    presetModalVisible,
    setPresetModalVisible,
    editPresetModalVisible,
    setEditPresetModalVisible,
  } = useAppModals();

  // 🌟 追加：カテゴリ(レイヤー)編集用のStateと関数
  const [editLayerModalVisible, setEditLayerModalVisible] = useState(false);
  const [editingLayerOriginalName, setEditingLayerOriginalName] = useState("");
  const [editingLayerName, setEditingLayerName] = useState("");
  const [editingLayerColor, setEditingLayerColor] = useState("");

  const handleLongPressLayer = (layer: string) => {
    // 共有カレンダーや外部予定は、ここからは編集させない
    const isShared = Object.keys(sharedRooms || {}).includes(layer);
    if (isShared) {
      Alert.alert(
        "お知らせ",
        "共有カレンダーの設定は「構成の管理」から行ってください。",
      );
      return;
    }
    if (layer === "外部予定") return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingLayerOriginalName(layer);
    setEditingLayerName(layer);
    setEditingLayerColor(layerMaster[layer] || "#007AFF");

    // フリーズ回避のため親モーダルを一時的に閉じる
    setFilterModalVisible(false);
    setTimeout(() => {
      setEditLayerModalVisible(true);
    }, 350);
  };

  const saveEditedLayer = async () => {
    const trimmed = editingLayerName.trim();
    if (!trimmed) return;

    const newLayerMaster = { ...layerMaster };

    if (trimmed !== editingLayerOriginalName) {
      if (newLayerMaster[trimmed]) {
        return Alert.alert("エラー", "既に同じ名前のカテゴリが存在します");
      }

      // 1. 新しい名前と色をセットし、古い名前を削除
      newLayerMaster[trimmed] = editingLayerColor;
      delete newLayerMaster[editingLayerOriginalName];

      // 2. カレンダーの全予定データのレイヤー名も書き換える
      setScheduleData((prevData: Record<string, ScheduleItem[]>) => {
        const nextData: Record<string, ScheduleItem[]> = {};
        Object.keys(prevData).forEach((date) => {
          nextData[date] = prevData[date].map((item) => {
            if (item.layer === editingLayerOriginalName) {
              const newTags = item.tags
                ? item.tags.map((t) =>
                    t === editingLayerOriginalName ? trimmed : t,
                  )
                : [trimmed];
              return { ...item, layer: trimmed, tags: newTags };
            }
            return item;
          });
        });
        AsyncStorage.setItem("scheduleData", JSON.stringify(nextData)).catch(
          console.error,
        );
        return nextData;
      });

      // 3. 紐づいている属性（サブカテゴリ）の親指定も書き換える
      const newTagMaster = { ...tagMaster };
      let hasTagChanges = false;
      Object.keys(newTagMaster).forEach((tag) => {
        if (newTagMaster[tag].layer === editingLayerOriginalName) {
          newTagMaster[tag].layer = trimmed;
          hasTagChanges = true;
        }
      });
      if (hasTagChanges) {
        setTagMaster(newTagMaster);
        AsyncStorage.setItem(
          "tagMasterData",
          JSON.stringify(newTagMaster),
        ).catch(console.error);
      }

      // 4. 今選択中のフィルター(表示)状態も書き換える
      if (activeTags.includes(editingLayerOriginalName)) {
        setActiveTags((prev) =>
          prev.map((t) => (t === editingLayerOriginalName ? trimmed : t)),
        );
      }
      if (tempActiveTags.includes(editingLayerOriginalName)) {
        setTempActiveTags((prev) =>
          prev.map((t) => (t === editingLayerOriginalName ? trimmed : t)),
        );
      }
    } else {
      // 名前が同じままなら、色だけ更新
      newLayerMaster[trimmed] = editingLayerColor;
    }

    setLayerMaster(newLayerMaster);
    await AsyncStorage.setItem(
      "layerMasterData",
      JSON.stringify(newLayerMaster),
    );
    setHasUnsavedChanges(true);
    setEditLayerModalVisible(false);

    // 🌟 保存完了後に元のフィルター画面に自動で戻る！
    setTimeout(() => setFilterModalVisible(true), 350);
  };

  const [presets, setPresets] = useState<{ [key: string]: string[] }>({});

  const [sharedRooms, setSharedRooms] = useState<{
    [layerName: string]: string;
  }>({});

  const [deepLinkRoomId, setDeepLinkRoomId] = useState("");
  const [deepLinkJoinVisible, setDeepLinkJoinVisible] = useState(false);
  const [deepLinkRoomName, setDeepLinkRoomName] = useState("");
  const [deepLinkRoomColor, setDeepLinkRoomColor] = useState("#007AFF");

  const {
    roomSchedules,
    roomWishes,
    roomTags,
    safeDebouncedSync,
    safeDebouncedSyncWish,
    safeDebouncedSyncTag,
  } = useCloudSync(sharedRooms);

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
  const [isHolidayEnabled, setIsHolidayEnabled] = useState(true);

  const { externalEvents } = useExternalCalendar(
    selectedDate,
    isExternalSyncEnabled,
  );

  const {
    layerMaster,
    setLayerMaster,
    tagMaster,
    setTagMaster,
    activeMode,
    setActiveMode,
  } = useAppStore();

  useEffect(() => {
    if (!roomTags || Object.keys(roomTags).length === 0) return;

    let hasChanges = false;
    const newTagMaster = { ...tagMaster };

    Object.values(roomTags).forEach((tags) => {
      Object.entries(tags).forEach(([tagName, tagData]) => {
        const currentTag = newTagMaster[tagName];
        // 自分のスマホに無い、または色が違うなら、クラウドの最新版で上書き！
        if (
          !currentTag ||
          currentTag.color !== tagData.color ||
          currentTag.layer !== tagData.layer
        ) {
          newTagMaster[tagName] = {
            layer: tagData.layer,
            color: tagData.color,
          };
          hasChanges = true;
        }
      });
    });

    if (hasChanges) {
      setTagMaster(newTagMaster); // 画面を更新
      AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster)); // スマホに保存
    }
  }, [roomTags, tagMaster, setTagMaster]); // クラウドの属性に変化があったら発動

  useEffect(() => {
    // まだアプリの準備ができていない時はスキップ
    if (Object.keys(layerMaster).length === 0) return;

    let hasNewTags = false;
    const nextTagMaster = { ...tagMaster };

    Object.keys(roomSchedules).forEach((roomId) => {
      const myLayerName =
        Object.keys(sharedRooms).find((key) => sharedRooms[key] === roomId) ||
        roomId;

      const datesData = roomSchedules[roomId] || {};
      Object.keys(datesData).forEach((date) => {
        datesData[date].forEach((item) => {
          const { parent = "", sub = "" } = resolveTags(item) || {};

          let subTag = "";
          if (sub !== parent && sub !== myLayerName) {
            subTag = sub;
          }

          // 🌟 修正：「祝日」や「休日」というワードは絶対に自動登録（学習）させない！
          if (
            subTag === "祝日" ||
            subTag === "休日" ||
            parent === "祝日" ||
            parent === "休日"
          ) {
            return;
          }

          // 自分の辞書（設定）にない未知の属性なら、自動で登録する
          if (subTag && !nextTagMaster[subTag]) {
            nextTagMaster[subTag] = {
              layer: myLayerName,
              color: item.color || layerMaster[myLayerName] || "#007AFF",
            };
            hasNewTags = true;
          }
        });
      });
    });

    if (hasNewTags) {
      setTagMaster(nextTagMaster);
      import("@react-native-async-storage/async-storage").then(
        ({ default: AsyncStorage }) => {
          AsyncStorage.setItem(
            "tagMasterData",
            JSON.stringify(nextTagMaster),
          ).catch(console.error);
        },
      );
    }
  }, [roomSchedules, sharedRooms, layerMaster, tagMaster, setTagMaster]);

  const { cancelItemNotification, scheduleItemNotification } =
    useNotificationManager();

  const handleCopyExternal = (item: ScheduleItem) => {
    // 外部予定特有のデータを剥がす
    const { externalEventId, color, ...rest } = item || {};

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
    // 👇 🌟 追加：起動時に祝日設定もストレージから読み込む
    AsyncStorage.getItem("isHolidayEnabled").then((val) => {
      if (val !== null) setIsHolidayEnabled(val === "true");
    });
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
    // 🌟 修正：削除後に元のフィルター画面に自動で戻してあげる
    setTimeout(() => setFilterModalVisible(true), 350);
  };

  const handleLongPressPreset = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingPresetOriginalName(name);
    setEditingPresetName(name);
    // 🌟 魔法の修正：多重モーダルによるフリーズを防ぐため、一度親モーダルを隠す！
    setFilterModalVisible(false);
    setTimeout(() => setEditPresetModalVisible(true), 350);
  };

  const saveEditedPreset = async () => {
    const trimmed = editingPresetName.trim();
    if (!trimmed || trimmed === editingPresetOriginalName) {
      setEditPresetModalVisible(false);
      setTimeout(() => setFilterModalVisible(true), 350); // 元に戻す
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
    // 🌟 保存完了後に元のフィルター画面に自動で戻る！
    setTimeout(() => setFilterModalVisible(true), 350);
  };

  const isSharedItem = (item: ScheduleItem) => {
    const { parent } = resolveTags(item);

    return Object.keys(sharedRooms).includes(parent);
  };

  // 🌟 共有カレンダーの予定を自動検知してFirestoreへ飛ばす最強の監視機構
  const prevScheduleDataRef = useRef<Record<string, ScheduleItem[]>>({});

  useEffect(() => {
    // アプリの起動準備が整うまではスキップ
    if (!isAppReady) return;

    Object.keys(scheduleData).forEach((date) => {
      const nextItems = scheduleData[date] || [];
      const prevItems = prevScheduleDataRef.current[date] || [];

      nextItems.forEach((nextItem) => {
        // 共有カレンダーのアイテムか判定
        if (isSharedItem(nextItem)) {
          const prevItem = prevItems.find((i) => i.id === nextItem.id);

          // 新規追加、または既存の予定から内容に変更があった場合のみ自動同期を実行
          if (
            !prevItem ||
            JSON.stringify(prevItem) !== JSON.stringify(nextItem)
          ) {
            safeDebouncedSync(nextItem, date);
          }
        }
      });
    });

    // 次回比較のために現在のデータを保存
    prevScheduleDataRef.current = scheduleData;
  }, [scheduleData, isAppReady, isSharedItem, safeDebouncedSync]);

  // 🌟 修正：長押し画面からの移動・コピーを完璧に反映させる
  const handleMoveOrCopy = async (
    item: ScheduleItem & { date?: string },
    targetLayer: string,
    isCopy: boolean,
  ) => {
    const { parent: oldParentLayer, sub: oldSubTag } = resolveTags(item);

    // 🌟 魔法の修正2：選ばれたのが「カレンダー（大枠）」か「カテゴリ（小タグ）」かを判定
    const isTargetMainLayer = Object.keys(layerMaster).includes(targetLayer);

    let parentLayer = oldParentLayer || "生活";
    let subTag = targetLayer;

    if (isTargetMainLayer) {
      // カレンダー自体を移動した場合は、親を更新して小タグは空にする
      parentLayer = targetLayer;
      subTag = "";
    } else if (tagMaster[targetLayer]) {
      // 登録済みの小タグが選ばれた場合
      parentLayer = tagMaster[targetLayer].layer;
      subTag = targetLayer;
    } else {
      // 食費などの「未登録カテゴリ」が選ばれた場合は、親カレンダーを維持する！
      parentLayer = oldParentLayer || "生活";
      subTag = targetLayer;
    }

    // 🌟 魔法の修正3：色を最新のものに染め直す（①小タグ専用色 → ②親レイヤー色 → ③元の色）
    const newColor =
      tagMaster[subTag]?.color || layerMaster[parentLayer] || item.color;

    const newItem: ScheduleItem = {
      ...item,
      id: isCopy ? Date.now().toString() : item.id,
      tag: subTag || parentLayer,
      layer: parentLayer,
      tags: [parentLayer, subTag || parentLayer],
      color: newColor,
      category: item.isExpense
        ? subTag || targetLayer || item.category
        : item.category,
    };

    const targetDate = item.date || selectedDate;

    try {
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
          batch.delete(doc(db, "rooms", oldRoomId, "schedules", item.id));
          hasCloudAction = true;
        }
      }

      // ② 新しい共有先に保存する（🌟 親レイヤーを使って正しい部屋に保存する！）
      if (Object.keys(sharedRooms).includes(parentLayer)) {
        const targetRoomId = sharedRooms[parentLayer];

        // 🌟 追加：移動・コピー時も undefined を完全に除去する！
        const cleanNewItem = JSON.parse(
          JSON.stringify({
            ...newItem,
            date: targetDate,
            updatedAt: new Date().toISOString(),
          }),
        );

        batch.set(
          doc(db, "rooms", targetRoomId, "schedules", newItem.id),
          cleanNewItem,
        );
        hasCloudAction = true;
      }

      if (hasCloudAction) {
        await batch.commit();
      }

      // 画面の更新処理（裏側で爆速で行う）
      setQuickActionVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      InteractionManager.runAfterInteractions(() => {
        setScheduleData((prevData: Record<string, ScheduleItem[]>) => {
          const nextData = { ...prevData };

          // 元の場所から消す（移動の場合のみ）
          if (!isCopy && !isSharedItem(item)) {
            Object.keys(nextData).forEach((d) => {
              nextData[d] = nextData[d].filter((i) => i.id !== item.id);
            });
          }

          // 🌟 修正：移動先が「共有カレンダー」の場合でも、クラウドからの到着を待たずに
          // 即座に画面に表示させるため、ローカルの State にも追加する！
          if (!nextData[targetDate]) nextData[targetDate] = [];
          nextData[targetDate] = [
            ...nextData[targetDate].filter((i) => i.id !== newItem.id),
            newItem,
          ];

          return nextData;
        });
        setHasUnsavedChanges(true);
      });
    } catch (e) {
      console.error("Move/Copy Error:", e);
      Alert.alert("エラー", "データの移動に失敗しました。");
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
                  "wishlistData",
                  "myMonthlyBudget",
                  "myPayday",
                  "layerBudgetsData",
                  "subTagBudgetsData",
                  "unallocatedSavingsData",
                  "lastAutoDepositCycle",
                  "hiddenExternalIds",
                  "isSavingsHidden",
                  "isNotificationEnabled",
                  "notificationTime",
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
        const [
          layers,
          pre,
          tags,
          onboarded,
          scheduleExists,
          extSync,
          sharedRoomsStr,
        ] = await Promise.all([
          AsyncStorage.getItem("layerMasterData"),
          AsyncStorage.getItem("filterPresets"),
          AsyncStorage.getItem("tagMasterData"),
          AsyncStorage.getItem("hasCompletedOnboarding"),
          AsyncStorage.getItem("myScheduleData"),
          AsyncStorage.getItem("externalCalendarSync"),
          AsyncStorage.getItem("sharedRoomsData"),
        ]);

        let initialLayers = layers ? JSON.parse(layers) : {};
        let initialSharedRooms = sharedRoomsStr
          ? JSON.parse(sharedRoomsStr)
          : {};

        // 🌟 魔法の自己修復：共有データにあるのにカテゴリから消えている「ゴースト」を見つけ出し、自動で完全復活させる！
        let needsLayerUpdate = false;
        Object.keys(initialSharedRooms).forEach((roomName) => {
          if (!initialLayers[roomName]) {
            initialLayers[roomName] = "#007AFF"; // とりあえず青色で復活させる
            needsLayerUpdate = true;
          }
        });

        if (needsLayerUpdate) {
          await AsyncStorage.setItem(
            "layerMasterData",
            JSON.stringify(initialLayers),
          );
        }

        if (!onboarded && !scheduleExists) {
          setOnboardingVisible(true);
        } else {
          if (!onboarded && scheduleExists) {
            await AsyncStorage.setItem("hasCompletedOnboarding", "true");
          }

          setLayerMaster(initialLayers);
          if (pre) setPresets(JSON.parse(pre));

          // 🌟 修正：「祝日」「休日」という文字がカレンダー（大枠）や属性（小タグ）に混ざっていたら、起動時に根こそぎ完全消滅させる
          let initialTags = tags ? JSON.parse(tags) : {};
          let tagsChanged = false;
          if (initialTags["祝日"] || initialTags["休日"]) {
            delete initialTags["祝日"];
            delete initialTags["休日"];
            tagsChanged = true;
          }
          // 念のため大枠（layerMaster）側からも完全に駆除
          if (initialLayers["祝日"] || initialLayers["休日"]) {
            delete initialLayers["祝日"];
            delete initialLayers["休日"];
            setLayerMaster({ ...initialLayers });
            await AsyncStorage.setItem(
              "layerMasterData",
              JSON.stringify(initialLayers),
            );
          }
          if (tagsChanged) {
            await AsyncStorage.setItem(
              "tagMasterData",
              JSON.stringify(initialTags),
            );
          }
          setTagMaster(initialTags);

          // 🌟 追加：共有ルームの記憶をStateにセット
          if (sharedRoomsStr) {
            setSharedRooms(JSON.parse(sharedRoomsStr));
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadData();
  }, [isExternalSyncEnabled]);
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

  // =========================================================================
  // 🌟 限界突破の最終兵器：ボタン押下後の「激重フリーズ」を消滅させる究極キャッシュ！
  // =========================================================================
  const prevScheduleData = useRef(scheduleData);
  const prevTagMaster = useRef(tagMaster);
  const prevLayerMaster = useRef(layerMaster);
  const prevActiveTags = useRef(activeTags);
  const cachedColoredData = useRef<{ [date: string]: ScheduleItem[] }>({});

  const coloredScheduleData = useMemo(() => {
    const isThemeChanged =
      tagMaster !== prevTagMaster.current ||
      layerMaster !== prevLayerMaster.current;
    const isFilterChanged = activeTags !== prevActiveTags.current;

    prevTagMaster.current = tagMaster;
    prevLayerMaster.current = layerMaster;
    prevActiveTags.current = activeTags;

    let hasAnyChange = false;
    const nextData: { [date: string]: ScheduleItem[] } = {};

    Object.keys(scheduleData).forEach((date) => {
      if (
        !isThemeChanged &&
        !isFilterChanged &&
        scheduleData[date] === prevScheduleData.current[date] &&
        cachedColoredData.current[date]
      ) {
        nextData[date] = cachedColoredData.current[date];
        return;
      }

      hasAnyChange = true;
      let dateChanged = false;

      // 👇 🌟 修正：.filter(item => !pendingDeletes.has(item.id)) を追加！
      const newItems = scheduleData[date]
        .filter((item) => !pendingDeletes.has(item.id))
        .map((item: ScheduleItem) => {
          if (
            item.tag === "祝日" ||
            item.category === "祝日" ||
            item.layer === "祝日" ||
            item.tag === "休日" ||
            item.category === "休日" ||
            item.layer === "休日"
          ) {
            return {
              ...item,
              color: "#FF3B30",
              tag: "休日",
              layer: "休日",
              tags: ["休日"],
            };
          }

          const { parent = "", sub = "" } = resolveTags(item) || {};

          const itemTag = sub;
          const parentTag = parent;

          const latestColor =
            tagMaster[sub]?.color || layerMaster[parent] || item.color;

          let displayColor = latestColor;
          let displayTags: string[] = []; // 🌟 stringの配列であることを厳密に定義！

          if (activeTags.length === 1 && activeTags[0] === parentTag) {
            displayColor =
              itemTag && tagMaster[itemTag]
                ? tagMaster[itemTag].color
                : latestColor;
            if (itemTag && itemTag !== parentTag) {
              displayTags = [parentTag, itemTag];
            } else {
              displayTags = [parentTag];
            }
          } else {
            displayColor = layerMaster[parentTag] || latestColor;
            displayTags = [parentTag];
          }

          const needsUpdate =
            item.color !== displayColor ||
            !item.tags ||
            JSON.stringify(item.tags) !== JSON.stringify(displayTags);

          if (needsUpdate) {
            dateChanged = true;
            // 🌟 TypeScriptが layer の存在を認めているため、エラー無く美しいオブジェクトを作れます
            const updatedItem: ScheduleItem = {
              ...item,
              color: displayColor,
              tag: itemTag,
              layer: parentTag,
              tags: displayTags,
            };
            return updatedItem;
          }
          return item;
        });

      if (dateChanged) {
        nextData[date] = newItems;
      } else {
        nextData[date] = scheduleData[date];
      }
    });

    if (
      Object.keys(cachedColoredData.current).length !==
      Object.keys(nextData).length
    ) {
      hasAnyChange = true;
    }

    prevScheduleData.current = scheduleData;

    if (hasAnyChange || isThemeChanged || isFilterChanged) {
      cachedColoredData.current = nextData;
      return nextData;
    }
    return cachedColoredData.current;
  }, [scheduleData, tagMaster, layerMaster, activeTags]);

  // 🌟 追加：最強の「自動翻訳システム」の完全修正版！
  // 描画システムが迷わないようにしつつ、表示するバッジをフィルターに合わせて賢く切り替える！
  const translatedRoomSchedules = useMemo(() => {
    const translated: { [roomId: string]: { [date: string]: ScheduleItem[] } } =
      {};

    Object.keys(roomSchedules).forEach((roomId) => {
      const myLayerName =
        Object.keys(sharedRooms).find((key) => sharedRooms[key] === roomId) ||
        roomId;

      translated[roomId] = {};
      const datesData = roomSchedules[roomId] || {};

      Object.keys(datesData).forEach((date) => {
        // 👇 🌟 修正： .filter(item => !pendingDeletes.has(item.id)) を追加！
        const dailyItems = (datesData[date] || []).filter(
          (item) => !pendingDeletes.has(item.id),
        );

        const newItems = dailyItems.map((item: ScheduleItem) => {
          let finalTag = myLayerName;
          let finalColor = layerMaster[myLayerName] || item.color;

          const { parent = "", sub = "" } = resolveTags(item) || {};

          // ✅ 必須追加
          const itemTag = sub;

          if (itemTag && tagMaster[itemTag]) {
            finalTag = itemTag;
            finalColor = tagMaster[itemTag].color;
          } else if (
            item.tag &&
            item.tag !== item.layer &&
            item.tag !== item.sharedLayer &&
            item.tag !== myLayerName
          ) {
            finalTag = item.tag;
            finalColor = tagMaster[item.tag]
              ? tagMaster[item.tag].color
              : item.color;
          }

          const isSingleLayerMode =
            activeTags.length === 1 && activeTags[0] === myLayerName;

          // ✅ ここが抜けるとエラーになる
          let displayTags: string[] = [];

          if (isSingleLayerMode) {
            displayTags =
              sub && sub !== parent
                ? [myLayerName, sub] // ✅ 修正ポイント
                : [myLayerName];
          } else {
            displayTags = [myLayerName];
          }

          const displayColor = isSingleLayerMode
            ? finalColor
            : layerMaster[myLayerName] || finalColor;

          return {
            ...item,
            layer: myLayerName,
            tag: itemTag || myLayerName,
            tags: displayTags,
            color: displayColor,
          } as ScheduleItem;
        });

        // 🌟 mapの外側で、作成した newItems を代入する
        translated[roomId][date] = newItems;
      });
    });

    return translated; // 🌟 最後はオブジェクトを返す
  }, [roomSchedules, sharedRooms, layerMaster, tagMaster, activeTags]);

  const displayData = useDisplayData(
    coloredScheduleData,
    externalEvents, // 🌟 外部予定（Appleカレンダー等）を復活！
    translatedRoomSchedules, // 🌟 ここに翻訳済みの綺麗な共有カレンダーデータを渡す！
    activeTags,
    tagMaster,
  );

  const { expandedScheduleData, currentMarkedDates, currentHoliday } =
    useCalendarData(
      displayData,
      activeMode,
      activeTags,
      layerMaster,
      tagMaster,
      selectedDate,
      hiddenExternalIds,
      isHolidayEnabled,
    );

  const { dayTasks, upcomingTasks, dayEvents } = useDailyItems(
    expandedScheduleData,
    displayData,
    selectedDate,
    activeTags,
    activeMode,
    tagMaster,
  );

  // 👇👇👇 ここから追加・修正（毎日の通知の自動更新ロジック） 👇👇👇
  const { isNotificationEnabled, notificationTime, scheduleDailyNotification } =
    useNotificationManager();

  useEffect(() => {
    // 🌟 修正：古い記憶（ステート）での判定をやめるため、ここでは弾かない
    // if (!isNotificationEnabled || !notificationTime) return;

    const updateNotification = async () => {
      // 🌟 ① 記憶のすれ違いを防ぐため、ストレージから「今この瞬間の最新設定」を直接引き抜く！
      const savedEnabledStr = await AsyncStorage.getItem(
        "isNotificationEnabled",
      );
      if (savedEnabledStr === "false") return; // OFFならここでストップ

      const savedTimeStr = await AsyncStorage.getItem("notificationTime");
      if (!savedTimeStr) return; // 時間が未設定ならストップ

      const latestTime = new Date(savedTimeStr);
      if (isNaN(latestTime.getTime())) return;

      const safeHours = latestTime.getHours();
      const safeMinutes = latestTime.getMinutes();

      const now = new Date();
      const targetDate = new Date();
      targetDate.setHours(safeHours, safeMinutes, 0, 0);

      // すでに今日の通知時間を過ぎていれば「明日」の予定数を計算する
      if (now > targetDate) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      // 日本時間のフォーマットで安全に YYYY-MM-DD を生成
      const y = targetDate.getFullYear();
      const m = String(targetDate.getMonth() + 1).padStart(2, "0");
      const d = String(targetDate.getDate()).padStart(2, "0");
      const targetDateStr = `${y}-${m}-${d}`;

      // 予定件数のカウント
      const targetDayItems = displayData[targetDateStr] || [];
      const eventCount = targetDayItems.filter((item) => item.isEvent).length;

      // 🌟 純粋な時間だけを持ったクリーンなDateを作成して渡す
      const safeNotificationTime = new Date();
      safeNotificationTime.setHours(safeHours, safeMinutes, 0, 0);

      await scheduleDailyNotification(safeNotificationTime, eventCount);
    };

    updateNotification();
  }, [displayData]); // 🌟 依存配列も displayData（予定の変動）だけに絞ることで暴走を防ぐ
  // 👆👆👆 ここまで追加・修正 👆👆👆

  // 🌟🌟🌟 限界突破：リスト側に繰り返し予定が出ないバグを強制的にバイパスする最強のリスト生成機能！ 🌟🌟🌟
  const finalDayEvents = useMemo(() => {
    // 1. 繰り返し予定も完璧に含まれている「expandedScheduleData」から今日の予定を直接ゲット！
    const todayItems = expandedScheduleData[selectedDate] || [];

    // 2. 「予定 (isEvent)」だけを抽出
    let events = todayItems.filter((item) => item.isEvent);

    // 3. フィルター機能（カテゴリ絞り込み）がONなら適用する
    if (activeTags.length > 0) {
      events = events.filter((item) => {
        if (
          item.tag === "祝日" ||
          item.category === "祝日" ||
          item.layer === "祝日" ||
          item.tag === "休日" ||
          item.category === "休日" ||
          item.layer === "休日"
        )
          return true;

        const { parent } = resolveTags(item) || {};
        return (
          activeTags.includes(parent) || activeTags.includes(item.layer || "")
        );
      });
    }

    // 4. 予定を時間順に綺麗に並べ替える（終日は一番上）
    events.sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      if (a.startTime && b.startTime)
        return a.startTime.localeCompare(b.startTime);
      return 0;
    });

    // 5. 祝日があれば一番上に追加する
    if (currentHoliday) {
      const exists = events.some((i) => i.id === currentHoliday.id);
      if (!exists) {
        // 🌟 修正：祝日が「未分類」などのデフォルト扱いにならないよう、強制的に「休日」という独立した属性を付与する！
        events = [
          {
            ...currentHoliday,
            category: "休日",
            layer: "休日",
            tag: "休日",
            tags: ["休日"],
          },
          ...events,
        ];
      }
    }

    return events;
  }, [expandedScheduleData, selectedDate, activeTags, currentHoliday]);

  // 🌟🌟🌟 ToDoリスト側に繰り返し予定が出ないバグを強制バイパスするリスト生成機能！ 🌟🌟🌟
  const finalDayTasks = useMemo(() => {
    // 1. 繰り返し予定も完璧に含まれているデータから直接ゲット！
    const todayItems = expandedScheduleData[selectedDate] || [];
    let tasks = todayItems.filter((item) => item.isTodo);

    // 🌟 修正：繰り返しタスクの場合、親タスクと【サブタスク】両方のチェック状態を「今日」のものに上書きする！
    tasks = tasks.map((task) => {
      if (task.repeatType) {
        return {
          ...task,
          isDone: task.completedDates?.includes(selectedDate) || false,
          subTasks: task.subTasks?.map((sub: any) => ({
            ...sub,
            // サブタスクも専用の完了日リスト(completedDates)を見てチェックを入れる
            isDone: sub.completedDates?.includes(selectedDate) || false,
          })),
        };
      }
      return task;
    });

    // 2. フィルターがONなら適用
    if (activeTags.length > 0) {
      tasks = tasks.filter((item) => {
        const { parent } = resolveTags(item) || {};
      });
    }

    // 3. 並べ替え（未完了を上、完了済みを下、時間順）
    tasks.sort((a, b) => {
      if (a.isDone && !b.isDone) return 1;
      if (!a.isDone && b.isDone) return -1;
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      if (a.startTime && b.startTime)
        return a.startTime.localeCompare(b.startTime);
      return 0;
    });

    return tasks;
  }, [expandedScheduleData, selectedDate, activeTags]);

  const finalUpcomingTasks = useMemo(() => {
    let upcoming: ScheduleItem[] = [];
    const [y, m, d] = selectedDate.split("-").map(Number);
    const currentDate = new Date(y, m - 1, d);

    // 今日から7日後までのデータを取得
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + i);
      const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;

      const items = expandedScheduleData[nextDateStr] || [];
      // 🌟 修正：ToDoかつ未完了で、さらに「繰り返し予定ではない（単発のタスク）」だけを抽出！
      const tasks = items.filter(
        (item) => item.isTodo && !item.isDone && !item.repeatType,
      );

      // 🌟 リストが過去の予定と勘違いして弾かないように、所属日を書き換えてコピー
      const processedTasks = tasks.map((t) => ({ ...t, date: nextDateStr }));
      upcoming.push(...processedTasks);
    }

    if (activeTags.length > 0) {
      upcoming = upcoming.filter((item) => {
        const { parent } = resolveTags(item) || {};
        return (
          activeTags.includes(parent) || activeTags.includes(item.layer || "")
        );
      });
    }

    // 同じ予定（繰り返しの同一ID）は、一番近い日の1件だけにする
    const uniqueUpcomingMap = new Map();
    upcoming.forEach((item) => {
      if (!uniqueUpcomingMap.has(item.id)) {
        uniqueUpcomingMap.set(item.id, item);
      }
    });

    const uniqueUpcoming = Array.from(
      uniqueUpcomingMap.values(),
    ) as ScheduleItem[];

    // 日付順、時間順に並べ替え
    uniqueUpcoming.sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      if (a.startTime && b.startTime)
        return a.startTime.localeCompare(b.startTime);
      return 0;
    });

    return uniqueUpcoming.slice(0, 10);
  }, [expandedScheduleData, selectedDate, activeTags]);

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
    // 🌟 修正：「休日」でも開かないようにガードする
    if (
      item.tag === "祝日" ||
      item.category === "祝日" ||
      item.tag === "休日" ||
      item.category === "休日"
    ) {
      return;
    }

    if (item.id && String(item.id).startsWith("ext_")) {
      setSelectedExternalItem(item);
      setExternalModalVisible(true);
    } else {
      // 🌟 修正：開こうとしている「対象の日付」を確保する
      const targetDate = item.date || selectedDate;
      let originalItem = { ...item };

      // 🌟 安全装置：scheduleDataの奥底から「本物の元データ」を探し出す
      for (const d of Object.keys(scheduleData)) {
        const found = scheduleData[d].find((i) => i.id === item.id);
        if (found) {
          // 参照を切るためにディープコピー
          originalItem = JSON.parse(JSON.stringify(found));
          break;
        }
      }

      // 🌟 究極の修正：繰り返し予定の場合は、生データではなく「対象日(targetDate)」のチェック状態を復元してから画面に渡す！
      if (originalItem.repeatType) {
        originalItem.isDone =
          originalItem.completedDates?.includes(targetDate) || false;
        if (originalItem.subTasks) {
          originalItem.subTasks = originalItem.subTasks.map((sub: any) => ({
            ...sub,
            isDone: sub.completedDates?.includes(targetDate) || false,
          }));
        }
      }

      // 内部データを対象日に固定して渡す
      originalItem.date = targetDate;
      setSelectedItem(originalItem);
      setModalVisible(true);
    }
  };

  const toggleTodo = (date: string, id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let targetItemToSync: ScheduleItem | null = null;
    let originalDate = date;

    // 🌟 配列の罠を防ぐための完全なディープコピー更新！
    setScheduleData((prevData) => {
      const nextData: Record<string, ScheduleItem[]> = {};
      Object.keys(prevData).forEach((key) => {
        nextData[key] = [...prevData[key]]; // 配列を新しくする
      });

      // 1. まず指定された日付の中を探す
      if (nextData[date] && nextData[date].some((i) => i.id === id)) {
        nextData[date] = nextData[date].map((item) => {
          if (item.id === id) {
            const updatedItem = { ...item };
            if (updatedItem.repeatType) {
              const completedDates = updatedItem.completedDates || [];
              if (completedDates.includes(date)) {
                updatedItem.completedDates = completedDates.filter(
                  (d) => d !== date,
                );
              } else {
                updatedItem.completedDates = [...completedDates, date];
              }
            } else {
              updatedItem.isDone = !updatedItem.isDone;
            }
            targetItemToSync = updatedItem;
            return updatedItem;
          }
          return item;
        });
      } else {
        // 2. 万が一見つからなかった場合のみ、全体を検索する
        for (const d of Object.keys(nextData)) {
          if (nextData[d].some((i) => i.id === id)) {
            nextData[d] = nextData[d].map((item) => {
              if (item.id === id) {
                const updatedItem = { ...item };
                if (updatedItem.repeatType) {
                  const completedDates = updatedItem.completedDates || [];
                  if (completedDates.includes(date)) {
                    updatedItem.completedDates = completedDates.filter(
                      (dateStr) => dateStr !== date,
                    );
                  } else {
                    updatedItem.completedDates = [...completedDates, date];
                  }
                } else {
                  updatedItem.isDone = !updatedItem.isDone;
                }
                targetItemToSync = updatedItem;
                originalDate = d;
                return updatedItem;
              }
              return item;
            });
            break;
          }
        }
      }
      return nextData;
    });

    // 🌟 同期処理は State の外側で行う
    setTimeout(() => {
      if (targetItemToSync) {
        safeDebouncedSync(targetItemToSync, originalDate);
      }
      setHasUnsavedChanges(true);
    }, 0);
  };

  const toggleSubTodo = async (
    date: string,
    parentId: string,
    subTaskId: number,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let targetItemToSync: ScheduleItem | null = null;
    let targetDateForSync = date;

    // 🌟 修正：古い記憶（クロージャ）に惑わされないよう、関数型の更新（prevData）で確実に最新データを操作する！
    setScheduleData((prevData) => {
      const nextData: Record<string, ScheduleItem[]> = {};
      Object.keys(prevData).forEach((key) => {
        nextData[key] = [...prevData[key]]; // 🌟 配列自体を新しく作り直すことで、Reactに100%変更を検知させる
      });

      let targetDate = date;
      let found = false;

      if (
        nextData[targetDate] &&
        nextData[targetDate].some((i) => i.id === parentId)
      ) {
        found = true;
      } else {
        for (const d of Object.keys(nextData)) {
          if (nextData[d].some((i) => i.id === parentId)) {
            targetDate = d;
            found = true;
            break;
          }
        }
      }
      if (!found) return prevData;

      nextData[targetDate] = nextData[targetDate].map((item) => {
        if (item.id === parentId && item.subTasks) {
          const updatedSubTasks = item.subTasks.map((sub: any) => {
            if (sub.id === subTaskId) {
              // 🌟 繰り返しなら専用の配列(completedDates)で管理、単発なら通常の(isDone)で管理
              let nextStatus;
              let updatedCompletedDates = sub.completedDates || [];

              if (item.repeatType) {
                const isCurrentlyDone = updatedCompletedDates.includes(date);
                nextStatus = !isCurrentlyDone;
                if (nextStatus) {
                  updatedCompletedDates = [...updatedCompletedDates, date]; // 完了日に今日を追加
                } else {
                  updatedCompletedDates = updatedCompletedDates.filter(
                    (d: string) => d !== date,
                  ); // 外す
                }
              } else {
                nextStatus = !sub.isDone;
              }

              if (nextStatus && sub.notificationId) {
                cancelItemNotification(sub.notificationId);
              }
              return {
                ...sub,
                isDone: nextStatus,
                completedDates: updatedCompletedDates,
                notificationId: nextStatus ? undefined : sub.notificationId,
                reminderOption: nextStatus ? "none" : sub.reminderOption,
              };
            }
            return sub;
          });

          // 1. お金の記録以外を完了判定の対象にする
          const pureTodos = updatedSubTasks.filter(
            (sub: any) => !sub.isExpense && !sub.isIncome,
          );

          // 2. 全て完了しているか計算（純粋なタスクがない場合は元の状態を維持）
          const isAllSubTasksDone =
            pureTodos.length > 0
              ? pureTodos.every((sub: any) => {
                  if (item.repeatType)
                    return sub.completedDates?.includes(date);
                  return sub.isDone;
                })
              : item.isDone || false;

          // 🌟 3. 習慣(ルーチン)予定の場合の特別処理
          let updatedCompletedDates = item.completedDates || [];
          if (item.repeatType) {
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

          const updatedParentItem = {
            ...item,
            subTasks: updatedSubTasks,
            isDone: isAllSubTasksDone,
            completedDates: updatedCompletedDates,
          };

          // 同期用にデータを確保しておく
          targetItemToSync = updatedParentItem;
          targetDateForSync = targetDate;

          return updatedParentItem;
        }
        return item;
      });

      return nextData;
    });

    // 🌟 同期処理は画面の描画が終わった後に裏側でコッソリ行う
    setTimeout(() => {
      if (targetItemToSync) {
        safeDebouncedSync(targetItemToSync, targetDateForSync);
      }
      setHasUnsavedChanges(true);
    }, 0);
  };

  const layerSummary = useMemo(() => {
    if (activeTags.length !== 1) return null;

    const targetLayer = activeTags[0];
    const [y, m] = selectedDate.split("-");
    const targetMonthPrefix = `${y}-${m}-`;

    let eventCount = 0;
    let totalExpense = 0;
    let totalIncome = 0; // 🌟 収入用の変数を追加！

    Object.keys(displayData).forEach((date) => {
      if (date.startsWith(targetMonthPrefix)) {
        displayData[date].forEach((item) => {
          const { parent } = resolveTags(item);
          const matchLayer = parent === targetLayer;

          if (matchLayer) {
            if (item.isEvent || item.isTodo) eventCount++;

            // 🌟 親タスクの支出・収入を集計
            if (item.isExpense && item.amount)
              totalExpense += Number(item.amount);
            if (item.isIncome && item.amount)
              totalIncome += Number(item.amount);

            // 🌟 子タスクの支出・収入を集計
            if (item.subTasks) {
              item.subTasks.forEach((sub) => {
                if (sub.isExpense && sub.amount)
                  totalExpense += Number(sub.amount);
                if (sub.isIncome && sub.amount)
                  totalIncome += Number(sub.amount);
              });
            }
          }
        });
      }
    });

    return { targetLayer, eventCount, totalExpense, totalIncome };
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
      let bodyPrefix = "時間になりました";

      if (updatedSub.reminderOption === "1hour") {
        triggerDate.setHours(triggerDate.getHours() - 1);
        bodyPrefix = "1時間前";
      } else if (updatedSub.reminderOption === "1day") {
        triggerDate.setDate(triggerDate.getDate() - 1);
        bodyPrefix = "明日";
      }

      if (triggerDate > new Date()) {
        const subTime = new Date(updatedSub.endTime);
        const subTimeString = `${subTime.getHours().toString().padStart(2, "0")}:${subTime.getMinutes().toString().padStart(2, "0")}〜`;

        const id = await scheduleItemNotification(
          `⏰ ${parentTitle}：${updatedSub.title}`, // 🌟 1行目（親タスク名：子タスク名 に統一！）
          `${bodyPrefix} ${subTimeString}`, // 🌟 2行目
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
    // 🌟 繰り返し予定の場合
    if (item.repeatType) {
      Alert.alert(
        "繰り返しの削除",
        `「${item.title}」をどのように削除しますか？`,
        [
          {
            text: "この予定のみ",
            onPress: () => executeQuickDelete(item, "single"),
          },
          {
            text: "これ以降すべて",
            onPress: () => executeQuickDelete(item, "following"),
          },
          {
            text: "すべての繰り返し",
            onPress: () => executeQuickDelete(item, "all"),
            style: "destructive",
          },
          { text: "キャンセル", style: "cancel" },
        ],
      );
    } else {
      // 🌟 通常の予定の場合
      Alert.alert("削除の確認", `「${item.title}」を削除しますか？`, [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => executeQuickDelete(item, "normal"),
        },
      ]);
    }
  };

  // 🌟 実際の削除処理を行う新しい関数（これも index.tsx 内に追加してください）
  const executeQuickDelete = async (
    item: ScheduleItem & { date?: string },
    mode: "normal" | "all" | "single" | "following",
  ) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const targetDate = item.date || selectedDate;

    setPendingDeletes((prev) => new Set(prev).add(item.id));

    try {
      // 1. 外部カレンダー連携があれば削除
      if (item.externalEventId) {
        try {
          const Calendar = await import("expo-calendar");
          await Calendar.deleteEventAsync(item.externalEventId);
        } catch (e) {}
      }

      const wasShared = isSharedItem(item);
      const isFullDelete =
        mode === "all" ||
        mode === "normal" ||
        (mode === "following" && item.startDate === targetDate);

      // 2. 共有・通知のクリーンアップ（全削除系の場合）
      if (isFullDelete) {
        if (item.notificationIds) {
          for (const id of item.notificationIds)
            await cancelItemNotification(id);
        }
        if (wasShared) {
          const { parent } = resolveTags(item);

          const sharedLayerName = Object.keys(sharedRooms).includes(parent)
            ? parent
            : null;
          if (sharedLayerName) {
            const roomId = sharedRooms[sharedLayerName];
            const { deleteDoc, doc } = await import("firebase/firestore");
            await deleteDoc(doc(db, "rooms", roomId, "schedules", item.id));
          }
        }
      } else if (mode === "following" && wasShared) {
        // 🌟 共有予定の「これ以降すべて」：終了日を前日に書き換える
        const targetDateObj = new Date(targetDate);
        targetDateObj.setDate(targetDateObj.getDate() - 1);
        const newEndDate = `${targetDateObj.getFullYear()}-${("0" + (targetDateObj.getMonth() + 1)).slice(-2)}-${("0" + targetDateObj.getDate()).slice(-2)}`;

        const itemTags = item.tags || (item.tag ? [item.tag] : []);
        const sharedLayerName = itemTags.find((tag) =>
          Object.keys(sharedRooms).includes(tag),
        );
        if (sharedLayerName) {
          const roomId = sharedRooms[sharedLayerName];
          const { updateDoc, doc } = await import("firebase/firestore");
          await updateDoc(doc(db, "rooms", roomId, "schedules", item.id), {
            repeatEndDate: newEndDate,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 3. ローカルのデータ更新（画面への即時反映）
      setScheduleData((prevData: Record<string, ScheduleItem[]>) => {
        const nextData: Record<string, ScheduleItem[]> = {};
        Object.keys(prevData).forEach((key) => {
          nextData[key] = [...prevData[key]];
        });

        if (mode === "single") {
          // 今回のみ：例外日に追加
          Object.keys(nextData).forEach((d) => {
            if (nextData[d].some((i) => i.id === item.id)) {
              nextData[d] = nextData[d].map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      exceptionDates: [...(i.exceptionDates || []), targetDate],
                    }
                  : i,
              );
            }
          });
        } else if (mode === "following") {
          // これ以降すべて：終了日を書き換え
          const targetDateObj = new Date(targetDate);
          targetDateObj.setDate(targetDateObj.getDate() - 1);
          const newEndDate = `${targetDateObj.getFullYear()}-${("0" + (targetDateObj.getMonth() + 1)).slice(-2)}-${("0" + targetDateObj.getDate()).slice(-2)}`;

          Object.keys(nextData).forEach((d) => {
            if (nextData[d].some((i) => i.id === item.id)) {
              nextData[d] = nextData[d].map(
                (i) =>
                  i.id === item.id ? { ...i, repeatEndDate: newEndDate } : i, // 🌟 repeatEndDate に修正！
              );
            }
          });
        } else {
          // すべて削除
          Object.keys(nextData).forEach((d) => {
            nextData[d] = nextData[d].filter((i) => i.id !== item.id);
          });
        }
        return nextData;
      });

      setHasUnsavedChanges(true);
      setQuickActionVisible(false);
      setCalendarResetKey((prev) => prev + 1); // カレンダーの強制再描画
    } catch (error) {
      console.error("Quick Delete Error:", error);
      Alert.alert("エラー", "削除に失敗しました。");
    } finally {
      // 👇 🌟 追加：処理が終わったら「削除中リスト」から外す
      setPendingDeletes((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
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

        Alert.alert("復元完了", "クラウドデータを正常に復元しました！");
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
    // 🌟 修正：「休日」でも開かないようにガードする
    if (
      item.tag === "祝日" ||
      item.category === "祝日" ||
      item.tag === "休日" ||
      item.category === "休日"
    ) {
      return;
    }
    if (item.id && String(item.id).startsWith("ext_")) {
      setSelectedExternalItem(item);
      setExternalModalVisible(true);
    } else {
      // 🌟 修正：開こうとしている「対象の日付」を確保する
      const targetDate = item.date || selectedDate;
      let originalItem = { ...item };

      for (const d of Object.keys(scheduleData)) {
        const found = scheduleData[d].find((i) => i.id === item.id);
        if (found) {
          originalItem = JSON.parse(JSON.stringify(found));
          break;
        }
      }

      // 🌟 究極の修正：繰り返し予定の場合は、対象日(targetDate)のチェック状態を復元する！
      if (originalItem.repeatType) {
        originalItem.isDone =
          originalItem.completedDates?.includes(targetDate) || false;
        if (originalItem.subTasks) {
          originalItem.subTasks = originalItem.subTasks.map((sub: any) => ({
            ...sub,
            isDone: sub.completedDates?.includes(targetDate) || false,
          }));
        }
      }

      originalItem.date = targetDate;
      setQuickActionItem(originalItem);
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
      {debugMessage !== "" && (
        <View style={{ padding: 10, backgroundColor: "#000" }}>
          <Text style={{ color: "#0f0", fontSize: 12 }}>{debugMessage}</Text>
        </View>
      )}

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
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
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
                dayTasks={finalDayTasks} // 🌟 変更：バイパスした最強リストを渡す！
                upcomingTasks={finalUpcomingTasks} // 🌟 変更：バイパスした最強リストを渡す！
                selectedDate={selectedDate}
                currentSolidColor={currentSolidColor}
                activeTags={activeTags}
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
                dayEvents={finalDayEvents} // 🌟 変更：祝日がマージされた配列を渡す！
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
                displayData={displayData}
                sharedRooms={sharedRooms}
                roomWishes={roomWishes} // 🌟 これを追加！
                safeDebouncedSyncWish={safeDebouncedSyncWish} // 🌟 これを追加！
                safeDebouncedSync={safeDebouncedSync}
                safeDebouncedSyncTag={safeDebouncedSyncTag}
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

                  <TouchableOpacity
                    style={styles.addPresetBtn}
                    onPress={handleOpenPresetModal}
                  >
                    <Ionicons name="add" size={16} color="#AEAEB2" />
                  </TouchableOpacity>
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

                  {/* 🌟 修正：フィルター画面でも、カテゴリ一覧と共有接続一覧を合体させてゴーストをあぶり出す！ */}
                  {Array.from(
                    new Set([
                      ...Object.keys(layerMaster),
                      ...Object.keys(sharedRooms || {}),
                    ]),
                  ).map((layer) => {
                    const isSelected = tempActiveTags.includes(layer);
                    const isShared = Object.keys(sharedRooms || {}).includes(
                      layer,
                    );
                    // 色データがないゴースト用の保険（標準の青色）
                    const displayColor = layerMaster[layer] || "#007AFF";

                    return (
                      <TouchableOpacity
                        key={layer}
                        style={[
                          styles.gridCard,
                          isSelected
                            ? {
                                backgroundColor: displayColor,
                                borderColor: displayColor,
                              }
                            : [
                                styles.gridCardGhost,
                                { borderColor: displayColor + "40" },
                              ],
                        ]}
                        onPress={() => toggleTempTag(layer)}
                        onLongPress={() => handleLongPressLayer(layer)}
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
                            color={isSelected ? "#FFF" : displayColor}
                          />
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

                        {/* 共有レイヤーの場合のみ、下に小さくIDを表示 */}
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
                        onPress={() => {
                          setEditPresetModalVisible(false);
                          // 🌟 追加：キャンセルした時も元のフィルター画面に戻してあげる！
                          setTimeout(() => setFilterModalVisible(true), 350);
                        }}
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

      {/* ==============================================
          🌟 追加：カテゴリ（レイヤー）編集用のモーダル
      ============================================== */}
      <Modal
        visible={editLayerModalVisible}
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
                  <Text style={styles.namingLabel}>EDIT_CATEGORY</Text>
                  <Text style={styles.namingTitle}>カテゴリの編集</Text>

                  <TextInput
                    style={styles.namingInput}
                    value={editingLayerName}
                    onChangeText={setEditingLayerName}
                    autoFocus={true}
                  />

                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "bold",
                      color: "#8E8E93",
                      marginBottom: 10,
                    }}
                  >
                    カラーを変更
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 20, maxHeight: 40 }}
                  >
                    {[
                      "#FF3B30",
                      "#FF9500",
                      "#FFCC00",
                      "#34C759",
                      "#007AFF",
                      "#5856D6",
                      "#AF52DE",
                      "#FF2D55",
                      "#1C1C1E",
                    ].map((color) => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setEditingLayerColor(color)}
                        style={[
                          {
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            backgroundColor: color,
                            marginRight: 10,
                          },
                          editingLayerColor === color && {
                            borderWidth: 3,
                            borderColor: "#1C1C1E",
                            transform: [{ scale: 1.1 }],
                          },
                        ]}
                      />
                    ))}
                  </ScrollView>

                  <View
                    style={[
                      styles.namingActionRow,
                      { justifyContent: "space-between" },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.namingCancelBtn}
                      onPress={() => {
                        setEditLayerModalVisible(false);
                        // キャンセルした時もフィルター画面に戻してあげる
                        setTimeout(() => setFilterModalVisible(true), 350);
                      }}
                    >
                      <Text style={styles.namingCancelText}>キャンセル</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.namingConfirmBtn,
                        {
                          backgroundColor:
                            editingLayerColor || currentSolidColor,
                        },
                      ]}
                      onPress={saveEditedLayer}
                    >
                      <Text style={styles.namingConfirmText}>保存</Text>
                    </TouchableOpacity>
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
          sharedRooms={sharedRooms}
          onForceRender={() => setCalendarResetKey((prev) => prev + 1)}
          safeDebouncedSync={safeDebouncedSync}
          setDebugMessage={setDebugMessage}
          safeDebouncedSyncTag={safeDebouncedSyncTag}
        />
      )}
      <LayerManagementModal
        visible={layerModalVisible}
        onClose={() => setLayerModalVisible(false)}
        layerMaster={layerMaster}
        setLayerMaster={setLayerMaster}
        setHasUnsavedChanges={setHasUnsavedChanges}
        sharedRooms={sharedRooms} // ✅ 追加
        onDeleteSharedRoom={handleDeleteSharedRoom}
        scheduleData={scheduleData} // 🌟 これを追加！
        setScheduleData={setScheduleData} // 🌟 これを追加！
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
        isHolidayEnabled={isHolidayEnabled}
        onHolidayToggle={(val) => {
          setIsHolidayEnabled(val);
          AsyncStorage.setItem("isHolidayEnabled", val ? "true" : "false");
          setCalendarResetKey((prev) => prev + 1); // 切り替えた瞬間にカレンダーを即再描画！
        }}
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
            layer: "外部予定",
            tags: ["外部予定"], // 🌟 これを追加することで DailyExpense 側に確実に反映される！
            color: "#FF2D55",
          });

          setScheduleData(newData);
          setCalendarResetKey((prev) => prev + 1);
          setHasUnsavedChanges(true);
          setExternalModalVisible(false);
          Alert.alert("保存完了", "支出情報を予定に紐付けました。");
        }}
      />

      <View style={styles.adContainer}>
        <BannerAd
          unitId={bannerId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: false, // 🌟 falseにして最適化広告にする
          }}
        />
      </View>

      {deepLinkJoinVisible && (
        <Modal visible={deepLinkJoinVisible} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.5)",
                padding: 20,
              }}
            >
              <View
                style={{
                  backgroundColor: "#FFF",
                  borderRadius: 24,
                  padding: 24,
                  shadowColor: "#000",
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  borderTopWidth: 8,
                  borderTopColor: deepLinkRoomColor,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    marginBottom: 20,
                    color: "#1C1C1E",
                  }}
                >
                  共有カレンダーに参加
                </Text>

                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "bold",
                    color: "#8E8E93",
                    marginBottom: 8,
                  }}
                >
                  表示名（カテゴリ名）
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#F2F2F7",
                    padding: 15,
                    borderRadius: 12,
                    fontSize: 16,
                    marginBottom: 20,
                    color: "#1C1C1E",
                    fontWeight: "bold",
                  }}
                  value={deepLinkRoomName}
                  onChangeText={setDeepLinkRoomName}
                  autoFocus
                />

                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "bold",
                    color: "#8E8E93",
                    marginBottom: 8,
                  }}
                >
                  カラーを選択
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 30, maxHeight: 40 }}
                >
                  {[
                    "#FF3B30",
                    "#FF9500",
                    "#FFCC00",
                    "#34C759",
                    "#007AFF",
                    "#5856D6",
                    "#AF52DE",
                    "#FF2D55",
                    "#1C1C1E",
                  ].map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        {
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: color,
                          marginRight: 12,
                        },
                        deepLinkRoomColor === color && {
                          borderWidth: 3,
                          borderColor: "#1C1C1E",
                          transform: [{ scale: 1.1 }],
                        },
                      ]}
                      onPress={() => setDeepLinkRoomColor(color)}
                    />
                  ))}
                </ScrollView>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      padding: 16,
                      alignItems: "center",
                      backgroundColor: "#F2F2F7",
                      borderRadius: 14,
                    }}
                    onPress={() => setDeepLinkJoinVisible(false)}
                  >
                    <Text
                      style={{
                        color: "#8E8E93",
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      キャンセル
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      padding: 16,
                      alignItems: "center",
                      backgroundColor: deepLinkRoomColor,
                      borderRadius: 14,
                    }}
                    onPress={() => {
                      const finalName =
                        deepLinkRoomName.trim() ||
                        `共有_${deepLinkRoomId.slice(0, 4)}`;
                      handleAddSharedRoom(
                        finalName,
                        deepLinkRoomId,
                        deepLinkRoomColor,
                      );
                      setDeepLinkJoinVisible(false);
                      Alert.alert(
                        "参加完了",
                        `「${finalName}」を追加しました！`,
                      );
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFF",
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      参加する
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
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
