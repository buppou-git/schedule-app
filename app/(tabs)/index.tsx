import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScheduleItem,
  useScheduleManager,
} from "../../hooks/useScheduleManager";

import { useCalendarData } from "../../hooks/useCalendarData";
import { useNotificationManager } from "../../hooks/useNotificationManager";

//データベース関係
import { signInAnonymously } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { AppState } from "react-native";
import { auth, db } from "./firebaseConfig";

//Todo
import EventItem from "./components/EventItem";
import TodoItem from "./components/TodoItem";

import {
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

import {
  CalendarList,
  CalendarProvider,
  WeekCalendar,
} from "react-native-calendars";

import ConfigModal from "./components/ConfigModal";
import LayerManagementModal from "./components/LayerManagementModal";
import MoneyDashboard from "./components/MoneyDashboard";
import ScheduleModal from "./components/ScheduleModal";
import SubTaskEditModal from "./components/SubTaskEditModal";
import TabBar from "./components/TabBar";

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

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const { scheduleData, setScheduleData, lastSyncedAt } = useScheduleManager();

  // 🌟 修正：scheduleItemNotification を追加！
  const { cancelItemNotification, scheduleItemNotification } = useNotificationManager();

  // 🌟 追加：サブタスク編集モーダル用のState
  const [subTaskModalVisible, setSubTaskModalVisible] = useState(false);
  const [editingSubTaskInfo, setEditingSubTaskInfo] = useState<any>(null);

  const [layerMaster, setLayerMaster] = useState<{ [key: string]: string }>({});
  const [tagMaster, setTagMaster] = useState<{
    [key: string]: { layer: string; color: string };
  }>({});
  const [presets, setPresets] = useState<{ [key: string]: string[] }>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [activeMode, setActiveMode] = useState("calendar");
  // 🌟 追加：家計簿画面の「日別詳細 / 予算管理」のモードを親(index)で管理する
  const [isMoneySummaryMode, setIsMoneySummaryMode] = useState(false);

  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [layerModalVisible, setLayerModalVisible] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [tempPresetName, setTempPresetName] = useState("");
  const [tempActiveTags, setTempActiveTags] = useState<string[]>([]);

  const calendarKey = useMemo(() => activeMode, [activeMode]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [configModalVisible, setConfigModalVisible] = useState(false);

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
        return next.length === Object.keys(layerMaster).length ? [] : next;
      });
    },
    [layerMaster],
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
    }, 400);
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
  };

  useEffect(() => {
    signInAnonymously(auth).catch((err: any) =>
      console.error("Auth Error:", err),
    );

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "background") {
          const user = auth.currentUser;
          if (!user) return;

          try {
            console.log("Auto-save: クラウドへの保存を開始...");
            const dataToSave = JSON.parse(
              JSON.stringify({
                scheduleData,
                layerMaster,
                tagMaster,
                presets,
                activeTags,
                lastSyncedAt: new Date().toISOString(),
              }),
            );

            await setDoc(doc(db, "users", user.uid), dataToSave);
            console.log("Auto-save: 完了！🚀");
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
        // 🌟 scheduleData の読み込みは新しいファイルに任せるので、ここからは削除！
        const [layers, pre, tags] = await Promise.all([
          AsyncStorage.getItem("layerMasterData"),
          AsyncStorage.getItem("filterPresets"),
          AsyncStorage.getItem("tagMasterData"),
        ]);
        if (layers) setLayerMaster(JSON.parse(layers));
        else
          setLayerMaster({
            ライブ: "#34C759",
            大学: "#007AFF",
            生活: "#FF9500",
          });
        if (pre) setPresets(JSON.parse(pre));
        if (tags) setTagMaster(JSON.parse(tags));
      } catch (error) {
        console.error(error);
      }
    };
    loadData();
  }, []);

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
    // 🌟 ポイント：依存配列から scheduleData を外してスッキリさせています
  }, [layerMaster, tagMaster, presets, activeTags]);

  const { expandedScheduleData, currentMarkedDates } = useCalendarData(
    scheduleData,
    activeMode,
    activeTags,
    layerMaster,
    tagMaster,
    selectedDate
  );
  
  const currentSolidColor = useMemo(
    () => (activeTags.length === 1 ? layerMaster[activeTags[0]] : "#1C1C1E"),
    [activeTags, layerMaster],
  );
  const currentBgColor = useMemo(
    () =>
      activeTags.length === 1
        ? getPastelColor(layerMaster[activeTags[0]])
        : "#F8F9FA",
    [activeTags, layerMaster],
  );

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

    // 対象のアイテム（元データ）を全探索
    let targetItem: ScheduleItem | null = null;
    let originalDate = "";

    for (const d of Object.keys(newData)) {
      const found = newData[d].find(i => i.id === id);
      if (found) {
        targetItem = found;
        originalDate = d;
        break;
      }
    }

    if (!targetItem) return;

    if (targetItem.repeatType) {
      // 🌟 繰り返し予定の場合：配列を更新
      const completedDates = targetItem.completedDates || [];
      if (completedDates.includes(date)) {
        targetItem.completedDates = completedDates.filter(d => d !== date);
      } else {
        targetItem.completedDates = [...completedDates, date];
      }
    } else {
      // 通常の予定：単一のフラグを更新
      targetItem.isDone = !targetItem.isDone;
    }

    setScheduleData(newData);
    setHasUnsavedChanges(true);
  };


  const toggleSubTodo = async (date: string, parentId: string, subTaskId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newData = { ...scheduleData };

    let targetDate = date;
    let found = false;

    // 仮想データも考慮して実体を探す
    if (newData[targetDate] && newData[targetDate].some(i => i.id === parentId)) {
      found = true;
    } else {
      for (const d of Object.keys(newData)) {
        if (newData[d].some(i => i.id === parentId)) {
          targetDate = d;
          found = true;
          break;
        }
      }
    }
    if (!found) return;

    // 対象の親タスクとそのサブタスクを見つけて更新
    newData[targetDate] = newData[targetDate].map(item => {
      if (item.id === parentId && item.subTasks) {
        const updatedSubTasks = item.subTasks.map(sub => {
          if (sub.id === subTaskId) {
            const nextStatus = !sub.isDone;
            // 💡 おもてなし：完了にした時、もし通知が予約されていたら自動キャンセル
            if (nextStatus && sub.notificationId) {
              cancelItemNotification(sub.notificationId);
            }
            return {
              ...sub,
              isDone: nextStatus,
              notificationId: nextStatus ? undefined : sub.notificationId,
              reminderOption: nextStatus ? "none" : sub.reminderOption
            };
          }
          return sub;
        });
        // 🌟 追加：サブタスクが1つ以上あり、かつ「すべて完了」しているか判定
        const isAllSubTasksDone =
          updatedSubTasks.length > 0 &&
          updatedSubTasks.every((sub: any) => sub.isDone);

        // 🌟 修正：親タスクの isDone も連動して上書きする
        return {
          ...item,
          subTasks: updatedSubTasks,
          isDone: isAllSubTasksDone,
        };
      }
      return item;
    });

    setScheduleData(newData);
    setHasUnsavedChanges(true);
  };

  const handleSubTaskSave = async (updatedSub: any) => {
    if (!editingSubTaskInfo) return;
    const { parentId, parentTitle, date } = editingSubTaskInfo;
    const newData = { ...scheduleData };

    let targetDate = date;
    let found = false;
    if (newData[targetDate] && newData[targetDate].some(i => i.id === parentId)) {
      found = true;
    } else {
      for (const d of Object.keys(newData)) {
        if (newData[d].some(i => i.id === parentId)) {
          targetDate = d;
          found = true;
          break;
        }
      }
    }
    if (!found) return;

    // 💡 通知の再予約（古いものを消して、新しい時間でセット）
    if (updatedSub.notificationId) {
      await cancelItemNotification(updatedSub.notificationId);
      updatedSub.notificationId = undefined;
    }
    if (updatedSub.hasDateTime && updatedSub.endTime && updatedSub.reminderOption !== "none" && !updatedSub.isDone) {
      let triggerDate = new Date(updatedSub.endTime);
      if (updatedSub.reminderOption === "1hour") triggerDate.setHours(triggerDate.getHours() - 1);
      else if (updatedSub.reminderOption === "1day") triggerDate.setDate(triggerDate.getDate() - 1);

      if (triggerDate > new Date()) {
        const id = await scheduleItemNotification(`🔔【${parentTitle}】${updatedSub.title}`, triggerDate);
        if (id) updatedSub.notificationId = id;
      }
    }

    newData[targetDate] = newData[targetDate].map(item => {
      if (item.id === parentId && item.subTasks) {
        return {
          ...item,
          subTasks: item.subTasks.map(sub => sub.id === updatedSub.id ? updatedSub : sub)
        };
      }
      return item;
    });

    setScheduleData(newData);
    setHasUnsavedChanges(true);
    setSubTaskModalVisible(false);
  };


  const handleSubTaskDelete = async (subTaskId: number) => {
    if (!editingSubTaskInfo) return;
    const { parentId, date } = editingSubTaskInfo;
    const newData = { ...scheduleData };

    // 対象の日付を探す
    let targetDate = date;
    if (!(newData[targetDate] && newData[targetDate].some(i => i.id === parentId))) {
      for (const d of Object.keys(newData)) {
        if (newData[d].some(i => i.id === parentId)) {
          targetDate = d; break;
        }
      }
    }

    newData[targetDate] = newData[targetDate].map(item => {
      if (item.id === parentId && item.subTasks) {
        // 🚨 削除するサブタスクの通知もキャンセル
        const targetSub = item.subTasks.find(s => s.id === subTaskId);
        if (targetSub?.notificationId) cancelItemNotification(targetSub.notificationId);

        return {
          ...item,
          subTasks: item.subTasks.filter(sub => sub.id !== subTaskId)
        };
      }
      return item;
    });

    setScheduleData(newData);
    setHasUnsavedChanges(true);
    setSubTaskModalVisible(false);
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

        await Promise.all([
          AsyncStorage.setItem(
            "myScheduleData",
            JSON.stringify(cloudData.scheduleData || {}),
          ),
          AsyncStorage.setItem(
            "layerMasterData",
            JSON.stringify(cloudData.layerMaster || {}),
          ),
          AsyncStorage.setItem(
            "tagMasterData",
            JSON.stringify(cloudData.tagMaster || {}),
          ),
          AsyncStorage.setItem(
            "filterPresets",
            JSON.stringify(cloudData.presets || {}),
          ),
          AsyncStorage.setItem(
            "activeTags",
            JSON.stringify(cloudData.activeTags || []),
          ),
        ]);

        setScheduleData(cloudData.scheduleData || {});
        setLayerMaster(cloudData.layerMaster || {});
        setTagMaster(cloudData.tagMaster || {});
        setPresets(cloudData.presets || {});
        setActiveTags(cloudData.activeTags || []);

        Alert.alert(
          "復元完了",
          "クラウドから最新データを正常に読み込みました！🚀",
        );
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

    const dTasks: any[] = [];
    const dEvents: any[] = [];

    items.forEach((item) => {
      const itemTags =
        item.tags && item.tags.length > 0
          ? item.tags
          : item.tag
            ? [item.tag]
            : [];
      const matchLayer =
        isAllLayers ||
        itemTags.some((tag) => {
          const parentLayer = tagMaster[tag]?.layer || tag;
          return activeTagsSet.has(parentLayer);
        });
      if (matchLayer) {
        if (item.isTodo) dTasks.push(item);
        if (item.isEvent) dEvents.push(item);
      }
    });

    const uTasks: any[] = [];
    const dayTaskIds = new Set(dTasks.map((t) => t.id));
    const addedUpcomingIds = new Set<string>();

    if (activeMode === "todo") {
      const sortedDates = Object.keys(expandedScheduleData).sort();
      sortedDates.forEach((date) => {
        if (date > selectedDate) {
          scheduleData[date].forEach((task) => {
            if (
              task.isTodo &&
              !task.isDone &&
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

    return { dayTasks: dTasks, upcomingTasks: uTasks, dayEvents: dEvents };
  }, [scheduleData, selectedDate, activeTags, activeMode, tagMaster]);



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

      <TabBar
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        themeColor={currentSolidColor}
      />

      <View style={styles.mainContent}>
        <View style={styles.calendarArea}>
          {/* 🌟 修正版：カレンダーモードは月表示、それ以外は週表示 */}
          {activeMode === "calendar" ? (
            <CalendarList
              current={selectedDate}
              key={calendarKey}
              markingType={"multi-dot"}
              pastScrollRange={6}
              futureScrollRange={6}
              initialNumToRender={1}
              windowSize={3}
              renderHeader={(date) => (
                <View style={[styles.monthHeaderContainer, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 15 }]}>
                  <Text style={[styles.monthformat, { color: currentSolidColor }]}>{date.getMonth() + 1}月</Text>
                  <TouchableOpacity onPress={handleOpenNewModal}>
                    <Ionicons name="add-circle" size={30} color={currentSolidColor} />
                  </TouchableOpacity>
                </View>
              )}
              horizontal
              pagingEnabled
              markedDates={currentMarkedDates}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              theme={{
                calendarBackground: "transparent",
                todayTextColor: currentSolidColor,
                selectedDayBackgroundColor: currentSolidColor,
              }}
            />
          ) : (
            <>
              {/* 家計簿モードの時だけタブを表示 */}
              {activeMode === "money" && (
                <View style={[styles.toggleContainer, { marginHorizontal: 15, marginTop: 10 }]}>
                  <TouchableOpacity style={[styles.toggleBtn, !isMoneySummaryMode && styles.toggleActive]} onPress={() => setIsMoneySummaryMode(false)}>
                    <View style={styles.toggleItem}>
                      <Ionicons name="list" size={16} color={!isMoneySummaryMode ? "#1C1C1E" : "#8E8E93"} />
                      <Text style={styles.toggleText}>日別詳細</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toggleBtn, isMoneySummaryMode && styles.toggleActive]} onPress={() => setIsMoneySummaryMode(true)}>
                    <View style={styles.toggleItem}>
                      <Ionicons name="pie-chart" size={15} color={isMoneySummaryMode ? "#1C1C1E" : "#8E8E93"} />
                      <Text style={styles.toggleText}>予算管理</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* ToDoまたは家計簿詳細の時に「週カレンダー」を表示 */}
              {(activeMode === "todo" || (activeMode === "money" && !isMoneySummaryMode)) && (
                <View style={styles.weekCalendarWrapper}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 20 }}>
                    <Text style={styles.monthLabel}>{parseInt(selectedDate.split("-")[1])}月</Text>
                    <TouchableOpacity onPress={handleOpenNewModal}>
                      <Ionicons name="add-circle" size={30} color={currentSolidColor} />
                    </TouchableOpacity>
                  </View>
                  <CalendarProvider date={selectedDate} onDateChanged={setSelectedDate}>
                    <WeekCalendar
                      firstDay={1}
                      markedDates={currentMarkedDates}
                      theme={{ calendarBackground: "transparent", todayTextColor: currentSolidColor, selectedDayBackgroundColor: currentSolidColor }}
                    />
                  </CalendarProvider>
                </View>
              )}
            </>
          )}
          {/* ここまでを差し替え。直後に <ScrollView style={styles.scheduleList} が続くようにします */}

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
                    scheduleData={scheduleData}
                    setScheduleData={setScheduleData}
                    selectedDate={selectedDate}
                    tagMaster={tagMaster}
                    activeTags={activeTags}
                    layerMaster={layerMaster}
                    setTagMaster={setTagMaster}
                    setHasUnsavedChanges={setHasUnsavedChanges}
                    isSummaryMode={isMoneySummaryMode} // 🌟 子コンポーネントに状態を渡す
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

                    {dayTasks.map((t) => (
                      <TodoItem
                        key={t.id}
                        item={t}
                        itemDate={selectedDate}
                        selectedDate={selectedDate}
                        tagMaster={tagMaster}
                        layerMaster={layerMaster}
                        formatEventTime={formatEventTime}
                        openEditModal={openEditModal}
                        toggleTodo={toggleTodo}
                        toggleSubTodo={toggleSubTodo}
                        setEditingSubTaskInfo={setEditingSubTaskInfo}
                        setSubTaskModalVisible={setSubTaskModalVisible}
                      />
                    ))}

                    {upcomingTasks.length > 0 && (
                      <View style={styles.upcomingSection}>
                        <Text style={styles.upcomingMiniTitle}>今後の予定（未完了）</Text>
                        {upcomingTasks.map((t) => (
                          <TodoItem
                            key={t.id}
                            item={t}
                            itemDate={t.date}
                            selectedDate={selectedDate}
                            tagMaster={tagMaster}
                            layerMaster={layerMaster}
                            formatEventTime={formatEventTime}
                            openEditModal={openEditModal}
                            toggleTodo={toggleTodo}
                            toggleSubTodo={toggleSubTodo}
                            setEditingSubTaskInfo={setEditingSubTaskInfo}
                            setSubTaskModalVisible={setSubTaskModalVisible}
                          />
                        ))}
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
                    setTimeout(() => setLayerModalVisible(true), 400);
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
                      JSON.stringify(tempActiveTags.sort()) ===
                      JSON.stringify(presets[pName].sort());
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
                        onLongPress={() => {
                          Alert.alert(
                            "削除",
                            `プリセット「${pName}」を削除しますか？`,
                            [
                              { text: "キャンセル", style: "cancel" },
                              {
                                text: "削除",
                                style: "destructive",
                                onPress: () => deletePreset(pName),
                              },
                            ],
                          );
                        }}
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
                  {Object.keys(layerMaster).map((layer) => {
                    const isSelected = tempActiveTags.includes(layer);
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
                        <Ionicons
                          name={
                            isSelected ? "checkmark-circle" : "ellipse-outline"
                          }
                          size={18}
                          color={isSelected ? "#FFF" : layerMaster[layer]}
                        />
                        <Text
                          style={[
                            styles.gridCardText,
                            isSelected && { color: "#FFF" },
                          ]}
                        >
                          {layer}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: currentSolidColor },
                ]}
                onPress={applyFilters}
              >
                <Text style={styles.confirmBtnText}>表示を確定する</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={presetModalVisible}
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
                  <Text style={styles.namingLabel}>SAVE_PRESET</Text>
                  <Text style={styles.namingTitle}>プリセット名の入力</Text>

                  <TextInput
                    style={styles.namingInput}
                    placeholder="PRESET_NAME..."
                    placeholderTextColor="#AEAEB2"
                    autoFocus={true}
                    value={tempPresetName}
                    onChangeText={setTempPresetName}
                  />

                  <View style={styles.namingActionRow}>
                    <TouchableOpacity
                      style={styles.namingCancelBtn}
                      onPress={() => {
                        setPresetModalVisible(false);
                        setTempPresetName("");
                        Keyboard.dismiss();
                      }}
                    >
                      <Text style={styles.namingCancelText}>CANCEL</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.namingConfirmBtn}
                      onPress={() => {
                        confirmSavePreset();
                        Keyboard.dismiss();
                      }}
                    >
                      <Text style={styles.namingConfirmText}>SAVE</Text>
                    </TouchableOpacity>
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
        onClose={() => setConfigModalVisible(false)}
        lastSyncedAt={lastSyncedAt}
        onRestore={handleRestore}
      />
      <SubTaskEditModal
        visible={subTaskModalVisible}
        onClose={() => setSubTaskModalVisible(false)}
        subTask={editingSubTaskInfo?.subTask || null}
        onSave={handleSubTaskSave}
        onDelete={handleSubTaskDelete}
        themeColor={currentSolidColor}
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
    paddingTop: 65,
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

  // 🌟 追加：モード切り替えタブのスタイル
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
    maxHeight: "80%",
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
    marginLeft: 20, // ここでインデント（字下げ）を作ります！
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E5EA", // 枝分かれの線
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
});
