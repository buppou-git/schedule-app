import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";

//データベース関係
import { signInAnonymously } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { AppState } from "react-native";
import { auth, db } from "./firebaseConfig";

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

interface ScheduleItem {
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

import ConfigModal from "./components/ConfigModal";
import LayerManagementModal from "./components/LayerManagementModal";
import MoneyDashboard from "./components/MoneyDashboard";
import ScheduleModal from "./components/ScheduleModal";
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
  const [scheduleData, setScheduleData] = useState<{
    [key: string]: ScheduleItem[];
  }>({});
  const [layerMaster, setLayerMaster] = useState<{ [key: string]: string }>({});
  const [tagMaster, setTagMaster] = useState<{
    [key: string]: { layer: string; color: string };
  }>({});
  const [presets, setPresets] = useState<{ [key: string]: string[] }>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [activeMode, setActiveMode] = useState("calendar");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [layerModalVisible, setLayerModalVisible] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [tempPresetName, setTempPresetName] = useState("");
  const [tempActiveTags, setTempActiveTags] = useState<string[]>([]);

  const calendarKey = useMemo(() => activeMode, [activeMode]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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
            setLastSyncedAt(new Date().toLocaleString("ja-JP"));
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
        const [data, layers, pre, tags] = await Promise.all([
          AsyncStorage.getItem("myScheduleData"),
          AsyncStorage.getItem("layerMasterData"),
          AsyncStorage.getItem("filterPresets"),
          AsyncStorage.getItem("tagMasterData"),
        ]);
        if (data) setScheduleData(JSON.parse(data));
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
        if (Object.keys(scheduleData).length > 0) {
          await AsyncStorage.setItem(
            "myScheduleData",
            JSON.stringify(scheduleData),
          );
        }
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
  }, [scheduleData, layerMaster, tagMaster, presets, activeTags]);

  const markedDatesBase = useMemo(() => {
    const marked: any = {};
    const activeTagsSet = new Set(activeTags);
    const isAllLayers = activeTags.length === 0;

    Object.keys(scheduleData).forEach((date) => {
      const dayDots = new Set<string>();
      scheduleData[date].forEach((item) => {
        const matchesMode =
          (activeMode === "calendar" && item.isEvent) ||
          (activeMode === "todo" && item.isTodo) ||
          (activeMode === "money" && item.isExpense);
        if (!matchesMode) return;
        const itemTags =
          item.tags && item.tags.length > 0
            ? item.tags
            : item.tag
              ? [item.tag]
              : [];
        itemTags.forEach((tag) => {
          const info = tagMaster[tag] || {
            layer: tag,
            color: layerMaster[tag] || "#999"
          };
          const isAllLayers = activeTags.length === 0;
          if (!isAllLayers && !activeTagsSet.has(info.layer)) return;

          dayDots.add(info.color);
        });
      });
      if (dayDots.size > 0)
        marked[date] = {
          dots: Array.from(dayDots).map((color) => ({ color })),
        };
    });
    return marked;
  }, [scheduleData, activeTags, activeMode, layerMaster, tagMaster]);

  const currentMarkedDates = useMemo(
    () => ({
      ...markedDatesBase,
      [selectedDate]: {
        ...markedDatesBase[selectedDate],
        selected: true,
        selectedColor:
          activeTags.length === 1
            ? layerMaster[activeTags[0]] || "#1C1C1E"
            : "#1C1C1E",
      },
    }),
    [markedDatesBase, selectedDate, activeTags, layerMaster],
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
    setScheduleData((prev) => {
      const newData = { ...prev };
      
      const currentStatus = newData[date]?.find(i => i.id === id)?.isDone;
      const nextStatus = !currentStatus;

      Object.keys(newData).forEach(d => {
          newData[d] = newData[d].map(i => i.id === id ? { ...i, isDone: nextStatus } : i);
      });
      return newData;
    });
    setHasUnsavedChanges(true);
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

        if (cloudData.lastSyncedAt) {
          setLastSyncedAt(
            new Date(cloudData.lastSyncedAt).toLocaleString("ja-JP"),
          );
        }

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

  // 🌟 詳細な期間表示のためのヘルパー関数
  const formatEventTime = (item: ScheduleItem) => {
    if (!item.startDate || !item.endDate) {
      // 過去データ用のフォールバック
      if (item.isAllDay) return "終日";
      if (item.startTime) return `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ""}`;
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
    const items = scheduleData[selectedDate] || [];
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
    // 🌟 重複排除用のSet
    const dayTaskIds = new Set(dTasks.map(t => t.id));
    const addedUpcomingIds = new Set<string>();

    if (activeMode === "todo") {
      const sortedDates = Object.keys(scheduleData).sort();
      sortedDates.forEach((date) => {
        if (date > selectedDate) {
          scheduleData[date].forEach((task) => {
            // 🌟 修正：すでにdayTasksにあるか、upcomingに追加済みのIDはスキップ！
            if (task.isTodo && !task.isDone && !dayTaskIds.has(task.id) && !addedUpcomingIds.has(task.id)) {
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

  const renderTodoItem = (item: any, itemDate: string) => {
    const itemTags =
      item.tags && item.tags.length > 0
        ? item.tags
        : item.tag
          ? [item.tag]
          : [];
    const displayColors = itemTags.map((tag: string) => {
      const color = tagMaster[tag]?.color || layerMaster[tag] || "#999";
      return color;
    });
    const uniqueColors = Array.from(new Set(displayColors));
    
    const isPeriodTask = item.endDate && item.startDate !== item.endDate;
    let daysLeft = null;
    let isFinalDay = false;
    
    if (isPeriodTask && item.endDate) {
      const targetD = new Date(selectedDate); // 🌟 今表示している日を基準に計算
      const endD = new Date(item.endDate);
      const diffTime = endD.getTime() - targetD.getTime();
      daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isFinalDay = daysLeft === 0;
    }

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.todoCard, item.isDone && styles.todoCardDone]}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        <View style={styles.stripeContainer}>
          {uniqueColors.map((color: any, idx: number) => (
            <View
              key={idx}
              style={[styles.todoAccent, { backgroundColor: color }]}
            />
          ))}
        </View>
        <View style={styles.todoContent}>
          <View style={styles.todoMainRow}>
            <Text
              style={[styles.todoTitle, item.isDone && styles.todoTitleDone]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4 }}
            >
              {itemTags.map((tag: string, idx: number) => (
                <View
                  key={idx}
                  style={[
                    styles.miniTagBadge,
                    {
                      backgroundColor: displayColors[idx] + "15",
                      borderColor: displayColors[idx],
                    },
                  ]}
                >
                  <Text
                    style={[styles.miniTagText, { color: displayColors[idx] }]}
                  >
                    {tag}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.todoSubRow}>
            {isFinalDay && !item.isDone ? (
              <View style={styles.deadlineBadgeUrgent}>
                <Ionicons name="flame" size={10} color="#FFF" style={{ marginRight: 2 }}/>
                <Text style={styles.deadlineBadgeTextUrgent}>TODAY: 最終日!</Text>
              </View>
            ) : daysLeft !== null && daysLeft > 0 && !item.isDone ? (
              <View style={styles.deadlineBadgeSafe}>
                <Ionicons name="leaf-outline" size={10} color="#34C759" style={{ marginRight: 2 }}/>
                <Text style={styles.deadlineBadgeTextSafe}>残り {daysLeft} 日</Text>
              </View>
            ) : null}
            
            <View style={styles.todoTimeRow}>
              <Ionicons name="time-outline" size={10} color="#8E8E93" />
              <Text style={styles.todoTimeText}>
                {formatEventTime(item)} 
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.checkButton}
          onPress={() => toggleTodo(itemDate, item.id)}
        >
          <Ionicons
            name={item.isDone ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={item.isDone ? "#34C759" : "#C7C7CC"}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

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
          {activeMode === "money" ? (
            <View style={styles.weekCalendarWrapper}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 }}>
                <Text style={styles.monthLabel}>
                  {parseInt(selectedDate.split("-")[1])}月
                </Text>
                {/* 🌟 ＋ボタンをここに移動！ */}
                <TouchableOpacity onPress={handleOpenNewModal}>
                  <Ionicons name="add-circle" size={30} color={currentSolidColor} />
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
          ) : (
            <CalendarList
              key={calendarKey}
              markingType={"multi-dot"}
              renderHeader={(date) => (
                <View style={[styles.monthHeaderContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 15 }]}>
                  <Text style={[styles.monthformat, { color: currentSolidColor }]}>
                    {date.getMonth() + 1}月
                  </Text>
                  {/* 🌟 ＋ボタンをここに移動！ */}
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
          )}

          <ScrollView
            style={styles.scheduleList}
            contentContainerStyle={{ paddingBottom: 120 }}
            removeClippedSubviews={true}
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

                    {dayTasks.map((t) => renderTodoItem(t, selectedDate))}

                    {upcomingTasks.length > 0 && (
                      <View style={styles.upcomingSection}>
                        <Text style={styles.upcomingMiniTitle}>
                          今後の予定（未完了）
                        </Text>
                        {upcomingTasks.map((t) => renderTodoItem(t, t.date))}
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <View style={styles.listPadding}>
                  <Text style={styles.dateTitle}>{selectedDate} の予定</Text>
                  {dayEvents.map((item) => {
                    const itemTags =
                      item.tags && item.tags.length > 0
                        ? item.tags
                        : item.tag
                          ? [item.tag]
                          : [];
                    const displayColors = itemTags.map((tag: any) => {
                      const info = tagMaster[tag] || {
                        layer: tag,
                        color: layerMaster[tag] || "#999",
                      };

                      return activeTags.length === 0
                        ? layerMaster[info.layer] || "#999"
                        : info.color;
                    });
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.listItem}
                        onPress={() => openEditModal(item)}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 4,
                            marginRight: 8,
                            flexWrap: "wrap",
                            width: "25%",
                          }}
                        >
                          {itemTags.map((tag: any, idx: any) => (
                            <View
                              key={idx}
                              style={[
                                styles.tagBadge,
                                { backgroundColor: displayColors[idx] },
                              ]}
                            >
                              <Text style={styles.tagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={styles.itemMain}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          {/* 🌟 カレンダー上でも詳細な時間を表示！ */}
                          <Text style={styles.timeTextSmall}>
                            {formatEventTime(item)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
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
  todoSubRow: { flexDirection: "row", alignItems: "center", marginTop: 4, flexWrap: 'wrap', gap: 6 },
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
});