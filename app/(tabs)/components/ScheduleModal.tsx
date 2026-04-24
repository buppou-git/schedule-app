import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";

// 🌟 通知の脳みそをインポート
import { useNotificationManager } from "../../../hooks/useNotificationManager";
import { ScheduleItem, SubTask } from "../types";
import { PRESET_COLORS } from "../utils/helpers";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
  selectedItem: ScheduleItem | null;
  activeMode: string;
  scheduleData: any;
  setScheduleData: (data: any) => void;
  layerMaster?: { [key: string]: string };
  tagMaster?: { [key: string]: { layer: string; color: string } };
  setTagMaster: (data: any) => void;
  setHasUnsavedChanges: (val: boolean) => void;
}

const formatTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const ModernDatePicker = ({
  value,
  mode,
  onChange,
  themeColor,
  icon,
}: {
  value: Date;
  mode: "date" | "time";
  onChange: (d: Date) => void;
  themeColor: string;
  icon?: string;
}) => {
  const [show, setShow] = useState(false);

  const formattedValue =
    mode === "date"
      ? `${value.getFullYear()}/${("0" + (value.getMonth() + 1)).slice(-2)}/${("0" + value.getDate()).slice(-2)}`
      : `${("0" + value.getHours()).slice(-2)}:${("0" + value.getMinutes()).slice(-2)}`;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.modernDateBtn,
          {
            borderColor: themeColor + "40",
            backgroundColor: themeColor + "0A",
          },
        ]}
        onPress={() => setShow(true)}
      >
        {icon && (
          <Ionicons
            name={icon as any}
            size={16}
            color={themeColor}
            style={{ marginRight: 6 }}
          />
        )}
        <Text style={{ fontSize: 14, fontWeight: "700", color: themeColor }}>
          {formattedValue}
        </Text>
      </TouchableOpacity>

      {show && Platform.OS === "android" && (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          onChange={(e, d) => {
            setShow(false);
            if (e.type === "set" && d) onChange(d);
          }}
        />
      )}

      {show && Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="fade">
          <TouchableOpacity
            style={styles.iosPickerOverlay}
            activeOpacity={1}
            onPress={() => setShow(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.iosPickerContent}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity
                    onPress={() => setShow(false)}
                    style={{ padding: 8 }}
                  >
                    <Text
                      style={{
                        color: themeColor,
                        fontSize: 16,
                        fontWeight: "bold",
                      }}
                    >
                      完了
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <DateTimePicker
                    value={value}
                    mode={mode}
                    display="spinner"
                    onChange={(e, d) => {
                      if (d) onChange(d);
                    }}
                    textColor="#000"
                    style={{ height: 210, width: 320 }}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
};

export default function ScheduleModal({
  visible,
  onClose,
  selectedDate,
  selectedItem,
  activeMode,
  scheduleData,
  setScheduleData,
  layerMaster = {},
  tagMaster = {},
  setTagMaster,
  setHasUnsavedChanges,
}: ScheduleModalProps) {
  const [inputText, setInputText] = useState("");
  const [inputAmount, setInputAmount] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagColor, setTagColor] = useState("#007AFF");
  const [selectedCategory, setSelectedCategory] = useState("食費");

  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const [repeatType, setRepeatType] = useState<
    "none" | "daily" | "weekly" | "monthly" | "custom"
  >("none");
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatInterval, setRepeatInterval] = useState(1);

  const [isAllDay, setIsAllDay] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);

  // 🌟 追加：属性の色を選択するStateとカラーパレット
  const [newTagColor, setNewTagColor] = useState("");
  const [isEvent, setIsEvent] = useState(true);
  const [isTodo, setIsTodo] = useState(false);
  const [isExpense, setIsExpense] = useState(false);
  const [showSubTasks, setShowSubTasks] = useState(false);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [quickMainTags, setQuickMainTags] = useState<{
    [key: string]: string[];
  }>({
    ALL_LAYERS: ["食費", "交通", "日用品", "交際費", "趣味", "その他"],
  });
  const [readingMaster, setReadingMaster] = useState<{
    [title: string]: string;
  }>({});

  const [editQuickTagModal, setEditQuickTagModal] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [tempQuickTagText, setTempQuickTagText] = useState("");
  const [editingLayerForQuick, setEditingLayerForQuick] = useState("ALL_LAYERS");

  // 🌟 追加：属性編集用State
  const [editSubTagModalVisible, setEditSubTagModalVisible] = useState(false);
  const [editingSubTagOriginalName, setEditingSubTagOriginalName] = useState("");
  const [editingSubTagName, setEditingSubTagName] = useState("");
  const [editingSubTagColor, setEditingSubTagColor] = useState("");

  const handleLongPressQuickTag = (index: number, currentText: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingLayerForQuick(selectedLayer);
    setEditingTagIndex(index);
    setTempQuickTagText(currentText);
    setEditQuickTagModal(true);
  };

  const saveQuickTag = async () => {
    if (editingTagIndex === null || !tempQuickTagText.trim()) return;
    const newTags = { ...quickMainTags };
    if (!newTags[editingLayerForQuick]) {
      newTags[editingLayerForQuick] = [...(quickMainTags["ALL_LAYERS"] || ["食費", "交通", "日用品", "交際費", "趣味", "その他"])];
    }
    newTags[editingLayerForQuick][editingTagIndex] = tempQuickTagText.trim();
    setQuickMainTags(newTags);
    await AsyncStorage.setItem("quickMainTagsData", JSON.stringify(newTags));
    if (selectedCategory === quickMainTags[editingLayerForQuick]?.[editingTagIndex]) {
      setSelectedCategory(tempQuickTagText.trim());
    }
    setEditQuickTagModal(false);
  };

  const handleLongPressSubTag = (tagName: string, color: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingSubTagOriginalName(tagName);
    setEditingSubTagName(tagName);
    setEditingSubTagColor(color);
    setEditSubTagModalVisible(true);
  };

  const saveEditedSubTag = async () => {
    const trimmed = editingSubTagName.trim();
    if (!trimmed) return;
    const newTagMaster = { ...tagMaster };
    if (trimmed !== editingSubTagOriginalName) {
      if (newTagMaster[trimmed]) return Alert.alert("エラー", "既に存在します");
      const oldLayer = newTagMaster[editingSubTagOriginalName].layer;
      delete newTagMaster[editingSubTagOriginalName];
      newTagMaster[trimmed] = { layer: oldLayer, color: editingSubTagColor };
      if (tagInput === editingSubTagOriginalName) setTagInput(trimmed);
    } else {
      newTagMaster[trimmed].color = editingSubTagColor;
    }
    setTagMaster(newTagMaster);
    await AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
    setEditSubTagModalVisible(false);
  };

  const deleteSubTag = async () => {
    Alert.alert("確認", `属性「${editingSubTagOriginalName}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除", style: "destructive", onPress: async () => {
          const newTagMaster = { ...tagMaster };
          delete newTagMaster[editingSubTagOriginalName];
          setTagMaster(newTagMaster);
          await AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
          if (tagInput === editingSubTagOriginalName) setTagInput("");
          setEditSubTagModalVisible(false);
        }
      }
    ]);
  };

  const [selectedReminders, setSelectedReminders] = useState<string[]>([]);
  const [customReminderTimes, setCustomReminderTimes] = useState<Date[]>([]);
  const { scheduleItemNotification, cancelItemNotification } =
    useNotificationManager();

  const uiThemeColor = layerMaster[selectedLayer] || "#007AFF";

  useEffect(() => {
    if (!visible) setIsReady(false);
  }, [visible]);

  useEffect(() => {
    const load = async () => {
      const [q, r] = await Promise.all([
        AsyncStorage.getItem("quickMainTagsData"),
        AsyncStorage.getItem("readingMasterData"),
      ]);
      if (q) setQuickMainTags(JSON.parse(q));
      if (r) setReadingMaster(JSON.parse(r));
    };
    if (visible) load();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      const layers = Object.keys(layerMaster);
      const def = layers.length > 0 ? layers[0] : "生活";

      if (selectedItem) {
        setInputText(selectedItem.title || "");
        setInputAmount(
          selectedItem.amount > 0 ? selectedItem.amount.toString() : "",
        );
        setIsEvent(selectedItem.isEvent ?? true);
        setIsTodo(selectedItem.isTodo ?? false);
        setIsExpense(selectedItem.isExpense ?? false);
        setTagInput(selectedItem.tag || "");
        setTagColor(selectedItem.color || "#007AFF");
        setSelectedLayer(tagMaster?.[selectedItem.tag || ""]?.layer || def);
        setSelectedCategory(selectedItem.category || "食費");
        setIsAllDay(selectedItem.isAllDay ?? true);
        setStartDate(new Date(selectedItem.startDate || selectedDate));
        setEndDate(new Date(selectedItem.endDate || selectedDate));

        if (selectedItem.startTime) {
          const [h, m] = selectedItem.startTime.split(":").map(Number);
          const d = new Date();
          d.setHours(h, m, 0, 0);
          setStartTime(d);
        }
        if (selectedItem.endTime) {
          const [h, m] = selectedItem.endTime.split(":").map(Number);
          const d = new Date();
          d.setHours(h, m, 0, 0);
          setEndTime(d);
        }

        const hasOldNotification =
          selectedItem.notificationIds &&
          selectedItem.notificationIds.length > 0;
        setSelectedReminders(
          selectedItem.reminderOptions || (hasOldNotification ? ["exact"] : []),
        );

        if (selectedItem.customReminderTimes) {
          setCustomReminderTimes(
            selectedItem.customReminderTimes.map((tStr) => new Date(tStr)),
          );
        } else {
          setCustomReminderTimes([]);
        }
        setRepeatType(selectedItem.repeatType || "none");
        setRepeatDays(selectedItem.repeatDays || []);
        setRepeatInterval(selectedItem.repeatInterval || 1);
        setNewTagColor(""); // 🌟 リセット

        const snapshot = JSON.stringify({
          title: selectedItem.title || "",
          amount: selectedItem.amount || 0,
          isEvent: selectedItem.isEvent ?? true,
          isTodo: selectedItem.isTodo ?? false,
          isExpense: selectedItem.isExpense ?? false,
          tag: selectedItem.tag || "",
          category: selectedItem.category || "食費",
          isAllDay: selectedItem.isAllDay ?? true,
          startDate: selectedItem.startDate || selectedDate,
          endDate: selectedItem.endDate || selectedDate,
          startTime: selectedItem.startTime || "",
          endTime: selectedItem.endTime || "",
          repeatType: selectedItem.repeatType || "none",
          repeatDays: selectedItem.repeatDays || [],
          repeatInterval: selectedItem.repeatInterval || 1,
          reminderOptions:
            selectedItem.reminderOptions ||
            (hasOldNotification ? ["exact"] : []),
          subTasksData:
            selectedItem.subTasks
              ?.map(
                (t: any) => `${t.title}_${t.isDone}_${t.amount}_${t.isExpense}`,
              )
              .join(",") || "",
        });
        setInitialSnapshot(snapshot);
      } else {
        setInputText("");
        setTagInput("");
        setTagColor(layerMaster[def] || "#007AFF");
        setInputAmount("");
        setIsEvent(activeMode === "calendar");
        setIsTodo(activeMode === "todo");
        setIsExpense(activeMode === "money");
        setSelectedLayer(def);
        setSelectedCategory("食費");
        setIsAllDay(true);
        setStartDate(new Date(selectedDate));
        setEndDate(new Date(selectedDate));
        const now = new Date();
        setStartTime(now);
        setEndTime(new Date(now.getTime() + 60 * 60 * 1000));
        setSelectedReminders([]);
        setCustomReminderTimes([]);
        setRepeatType("none");
        setNewTagColor(""); // 🌟 リセット
      }
      setSubTasks([]);
      setIsCreatingNewTag(false);
      setShowSubTasks(false);
    }
  }, [visible, selectedItem, activeMode, layerMaster, selectedDate, tagMaster]);

  const toHiragana = (str: string) =>
    str
      .replace(/[\u30a1-\u30f6]/g, (m) =>
        String.fromCharCode(m.charCodeAt(0) - 0x60),
      )
      .toLowerCase();

  const titleHistory = useMemo(() => {
    if (!isReady) return [];
    const titles = new Set<string>();
    for (const d in scheduleData) {
      scheduleData[d].forEach((i: any) => i.title && titles.add(i.title));
    }
    return Array.from(titles);
  }, [scheduleData, isReady]);

  const suggestions = useMemo(() => {
    const s = inputText.trim();
    if (!s) return [];
    const r = toHiragana(s);
    return titleHistory
      .filter(
        (t) => (readingMaster[t] || toHiragana(t)).startsWith(r) && t !== s,
      )
      .slice(0, 5);
  }, [inputText, titleHistory, readingMaster]);

  const currentQuickTags = useMemo(
    () =>
      quickMainTags[selectedLayer] ||
      quickMainTags["ALL_LAYERS"] || [
        "食費",
        "交通",
        "日用品",
        "交際費",
        "趣味",
        "その他",
      ],
    [selectedLayer, quickMainTags],
  );

  const handleSavePress = () => {
    if (!inputText) return Alert.alert("エラー", "タイトルを入力してください");

    if (selectedItem) {
      const currentSnapshot = JSON.stringify({
        title: inputText,
        amount: parseInt(inputAmount) || 0,
        isEvent: isEvent,
        isTodo: isTodo,
        isExpense: isExpense,
        tag: tagInput.trim(),
        category: selectedCategory,
        isAllDay: isAllDay,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        startTime: isAllDay ? "" : formatTime(startTime),
        endTime: isAllDay ? "" : formatTime(endTime),
        repeatType: repeatType,
        repeatDays: repeatDays,
        repeatInterval: repeatInterval,
        reminderOptions: selectedReminders,
        subTasksData: subTasks.map((t) => `${t.title}_${t.isDone}`).join(","),
      });

      if (initialSnapshot === currentSnapshot) {
        onClose();
        return;
      }
    }

    if (selectedItem && selectedItem.repeatType) {
      Alert.alert(
        "繰り返しの編集",
        "この予定の変更をどのように適用しますか？",
        [
          { text: "今回のみ", onPress: () => executeSave("single") },
          { text: "今後すべて", onPress: () => executeSave("all") },
          { text: "キャンセル", style: "cancel" },
        ],
      );
    } else {
      executeSave("normal");
    }
  };

  const executeSave = async (mode: "normal" | "all" | "single") => {
    if (!inputText) return Alert.alert("エラー", "タイトルを入力してください");
    const r = {
      ...readingMaster,
      [inputText.trim()]: toHiragana(inputText.trim()),
    };
    setReadingMaster(r);
    AsyncStorage.setItem("readingMasterData", JSON.stringify(r));

    const finalTag = tagInput.trim() || selectedLayer;

    // 🌟 修正ポイント：すでに存在する属性なら元の色を保持。新規なら指定された色を使う。
    let finalColor = uiThemeColor;
    if (tagInput.trim()) {
      const existingTag = tagMaster[tagInput.trim()];
      if (existingTag) {
        finalColor = existingTag.color;
      } else {
        finalColor = newTagColor || uiThemeColor;
        const m = {
          ...tagMaster,
          [tagInput.trim()]: { layer: selectedLayer, color: finalColor },
        };
        setTagMaster(m);
        AsyncStorage.setItem("tagMasterData", JSON.stringify(m));
      }
    }

    let finalNotificationIds: string[] = [];
    if (
      selectedItem?.notificationIds &&
      selectedItem.notificationIds.length > 0
    ) {
      for (const oldId of selectedItem.notificationIds) {
        await cancelItemNotification(oldId);
      }
    }

    if (selectedReminders.length > 0) {
      for (const option of selectedReminders) {
        if (option === "custom") continue;
        let triggerDate = new Date(startDate);
        if (isAllDay) {
          if (option === "morning") triggerDate.setHours(7, 0, 0, 0);
          else if (option === "dayBefore") {
            triggerDate.setDate(triggerDate.getDate() - 1);
            triggerDate.setHours(21, 0, 0, 0);
          } else if (option === "2daysBefore") {
            triggerDate.setDate(triggerDate.getDate() - 2);
            triggerDate.setHours(21, 0, 0, 0);
          }
        } else {
          triggerDate.setHours(
            startTime.getHours(),
            startTime.getMinutes(),
            0,
            0,
          );
          if (option === "10min")
            triggerDate.setMinutes(triggerDate.getMinutes() - 10);
          else if (option === "30min")
            triggerDate.setMinutes(triggerDate.getMinutes() - 30);
          else if (option === "1hour")
            triggerDate.setHours(triggerDate.getHours() - 1);
          else if (option === "morning") triggerDate.setHours(7, 0, 0, 0);
          else if (option === "dayBefore") {
            triggerDate.setDate(triggerDate.getDate() - 1);
            triggerDate.setHours(21, 0, 0, 0);
          }
        }

        if (triggerDate > new Date()) {
          const id = await scheduleItemNotification(inputText, triggerDate);
          if (id) finalNotificationIds.push(id);
        }
      }

      if (selectedReminders.includes("custom")) {
        for (const customTime of customReminderTimes) {
          if (customTime > new Date()) {
            const id = await scheduleItemNotification(inputText, customTime);
            if (id) finalNotificationIds.push(id);
          }
        }
      }
    }

    const updatedSubTasks = await Promise.all(
      subTasks.map(async (task) => {
        if (task.notificationId) {
          await cancelItemNotification(task.notificationId);
        }
        let newNotifId = undefined;
        if (
          task.hasDateTime &&
          task.endTime &&
          task.reminderOption &&
          task.reminderOption !== "none"
        ) {
          let triggerDate = new Date(task.endTime);
          if (task.reminderOption === "1hour")
            triggerDate.setHours(triggerDate.getHours() - 1);
          else if (task.reminderOption === "1day")
            triggerDate.setDate(triggerDate.getDate() - 1);
          if (triggerDate > new Date()) {
            const id = await scheduleItemNotification(
              `子タスク: ${task.title}`,
              triggerDate,
            );
            if (id) newNotifId = id;
          }
        }
        return { ...task, notificationId: newNotifId };
      }),
    );

    const newData = { ...scheduleData };
    const sStr = startDate.toISOString().split("T")[0];
    const itemData = {
      title: inputText,
      tag: finalTag,
      tags: [finalTag],
      amount: parseInt(inputAmount) || 0,
      isEvent,
      isTodo,
      isExpense,
      color: finalColor,
      category: isExpense ? selectedCategory : undefined,
      repeatType: repeatType !== "none" ? repeatType : undefined,
      repeatDays: repeatType === "custom" ? repeatDays : undefined,
      repeatInterval: repeatType === "custom" ? repeatInterval : undefined,
      isAllDay,
      startDate: sStr,
      endDate: endDate.toISOString().split("T")[0],
      startTime: isAllDay ? undefined : formatTime(startTime),
      endTime: isAllDay ? undefined : formatTime(endTime),
      notificationIds: finalNotificationIds,
      reminderOptions: selectedReminders,
      customReminderTimes: customReminderTimes.map((d) => d.toISOString()),
      subTasks: updatedSubTasks,
    };

    if (selectedItem) {
      if (mode === "single") {
        Object.keys(newData).forEach((d) => {
          newData[d] = newData[d].map((i: any) => {
            if (i.id === selectedItem.id) {
              return {
                ...i,
                exceptionDates: [...(i.exceptionDates || []), selectedDate],
              };
            }
            return i;
          });
        });
        const newItem = {
          ...selectedItem,
          ...itemData,
          id: Date.now().toString(),
          repeatType: undefined,
          linkedMasterId: selectedItem.id,
        };
        if (!newData[sStr]) newData[sStr] = [];
        newData[sStr].push(newItem);
      } else {
        Object.keys(newData).forEach((d) => {
          newData[d] = newData[d].filter((i: any) => i.id !== selectedItem.id);
        });
        if (!newData[sStr]) newData[sStr] = [];
        newData[sStr].push({ ...selectedItem, ...itemData });
      }
    } else {
      if (!newData[sStr]) newData[sStr] = [];
      newData[sStr].push({
        id: Date.now().toString(),
        isDone: false,
        ...itemData,
      });
    }

    onClose();
    setTimeout(() => {
      setScheduleData(newData);
      setHasUnsavedChanges(true);
    }, 300);
  };

  const handleDeletePress = () => {
    if (selectedItem && selectedItem.repeatType) {
      Alert.alert("繰り返しの削除", "この予定をどのように削除しますか？", [
        { text: "今回のみ", onPress: () => executeDelete("single") },
        { text: "今後すべて", onPress: () => executeDelete("all") },
        { text: "キャンセル", style: "cancel" },
      ]);
    } else {
      executeDelete("normal");
    }
  };

  const executeDelete = async (mode: "normal" | "all" | "single") => {
    if (!selectedItem) return;
    const newData = { ...scheduleData };

    if (mode === "single") {
      Object.keys(newData).forEach((d) => {
        newData[d] = newData[d].map((i: any) => {
          if (i.id === selectedItem.id) {
            return {
              ...i,
              exceptionDates: [...(i.exceptionDates || []), selectedDate],
            };
          }
          return i;
        });
      });
    } else {
      if (selectedItem.notificationIds) {
        for (const id of selectedItem.notificationIds)
          await cancelItemNotification(id);
      }
      if (selectedItem.subTasks) {
        for (const task of selectedItem.subTasks) {
          if (task.notificationId)
            await cancelItemNotification(task.notificationId);
        }
      }
      Object.keys(newData).forEach((d) => {
        newData[d] = newData[d].filter((i: any) => i.id !== selectedItem.id);
      });
    }
    onClose();
    setTimeout(() => {
      setScheduleData(newData);
      setHasUnsavedChanges(true);
    }, 300);
  };

  const timeAndTagSection = useMemo(() => {
    if (!isReady) return <View style={{ minHeight: 200 }} />;
    return (
      <View>
        <View style={styles.timeSection}>
          <View style={styles.timePreviewRow}>
            <Ionicons name="time" size={14} color={uiThemeColor} />
            <Text style={[styles.timePreviewText, { color: uiThemeColor }]}>
              {isAllDay
                ? "終日"
                : `${formatTime(startTime)} 〜 ${formatTime(endTime)}`}
            </Text>
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>終日</Text>
            <Switch
              value={isAllDay}
              onValueChange={setIsAllDay}
              trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
              ios_backgroundColor="#E5E5EA"
            />
          </View>
          <View style={styles.timePickerContainer}>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>開始</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <ModernDatePicker
                  value={startDate}
                  mode="date"
                  onChange={setStartDate}
                  themeColor={uiThemeColor}
                  icon="calendar-outline"
                />
                {!isAllDay && (
                  <ModernDatePicker
                    value={startTime}
                    mode="time"
                    onChange={setStartTime}
                    themeColor={uiThemeColor}
                    icon="time-outline"
                  />
                )}
              </View>
            </View>
            <View style={[styles.timeRow, { marginTop: 16 }]}>
              <Text style={styles.timeLabel}>終了</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <ModernDatePicker
                  value={endDate}
                  mode="date"
                  onChange={setEndDate}
                  themeColor={uiThemeColor}
                  icon="calendar-outline"
                />
                {!isAllDay && (
                  <ModernDatePicker
                    value={endTime}
                    mode="time"
                    onChange={setEndTime}
                    themeColor={uiThemeColor}
                    icon="time-outline"
                  />
                )}
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.label}>繰り返し</Text>
        <View style={styles.layerContainer}>
          {[
            { label: "なし", value: "none" },
            { label: "毎日", value: "daily" },
            { label: "毎週", value: "weekly" },
            { label: "毎月", value: "monthly" },
            { label: "カスタム", value: "custom" },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.layerChip,
                repeatType === opt.value && { backgroundColor: uiThemeColor },
              ]}
              onPress={() => setRepeatType(opt.value as any)}
            >
              <Text
                style={[
                  styles.layerChipText,
                  repeatType === opt.value && { color: "#fff" },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {repeatType === "custom" && (
          <View style={styles.customRepeatArea}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={styles.miniLabel}>曜日の選択</Text>
              <TouchableOpacity onPress={() => setRepeatDays([1, 2, 3, 4, 5])}>
                <Text
                  style={{
                    fontSize: 11,
                    color: uiThemeColor,
                    fontWeight: "bold",
                  }}
                >
                  平日のみ選択
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.daySelectorRow}>
              {["日", "月", "火", "水", "木", "金", "土"].map((day, idx) => {
                const isSelected = repeatDays.includes(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayCircle,
                      isSelected && {
                        backgroundColor: uiThemeColor,
                        borderColor: uiThemeColor,
                      },
                    ]}
                    onPress={() => {
                      setRepeatDays((prev) =>
                        prev.includes(idx)
                          ? prev.filter((d) => d !== idx)
                          : [...prev, idx],
                      );
                    }}
                  >
                    <Text
                      style={[styles.dayText, isSelected && { color: "#FFF" }]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.intervalRow}>
              <Text style={styles.miniLabel}>繰り返しの間隔:</Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <TextInput
                  style={styles.intervalInput}
                  keyboardType="numeric"
                  value={repeatInterval.toString()}
                  onChangeText={(t) => setRepeatInterval(parseInt(t) || 1)}
                />
                <Text
                  style={{ fontSize: 14, fontWeight: "bold", color: "#1C1C1E" }}
                >
                  週間ごと
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.label}>カレンダーの種類</Text>
        <View style={styles.layerContainer}>
          {Object.keys(layerMaster).map((l) => (
            <TouchableOpacity
              key={l}
              style={[
                styles.layerChip,
                selectedLayer === l && { backgroundColor: layerMaster[l] },
              ]}
              onPress={() => setSelectedLayer(l)}
            >
              <Text
                style={[
                  styles.layerChipText,
                  selectedLayer === l && { color: "#fff" },
                ]}
              >
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 🌟 属性とカラーパレットのセクション */}
        <View style={styles.tagSection}>
          <Text style={styles.label}>属性（任意）</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center" }}
          >
            <TouchableOpacity
              onPress={() => {
                const nextState = !isCreatingNewTag;
                setIsCreatingNewTag(nextState);
                if (!nextState) {
                  setTagInput("");
                  setNewTagColor("");
                }
              }}
              style={[
                styles.addTagCircle,
                isCreatingNewTag && { backgroundColor: uiThemeColor },
              ]}
            >
              <Ionicons
                name={isCreatingNewTag ? "close" : "add"}
                size={22}
                color={isCreatingNewTag ? "#fff" : uiThemeColor}
              />
            </TouchableOpacity>

            {isCreatingNewTag && (
              <TextInput
                style={[
                  styles.newTagInput,
                  {
                    borderColor: newTagColor || uiThemeColor,
                    color: newTagColor || uiThemeColor,
                  },
                ]}
                placeholder="新しい属性..."
                placeholderTextColor={(newTagColor || uiThemeColor) + "70"}
                value={tagInput}
                onChangeText={setTagInput}
                autoFocus
              />
            )}

            {Object.keys(tagMaster)
              .filter((t) => tagMaster[t].layer === selectedLayer)
              .map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => {
                    setTagInput(t);
                    setIsCreatingNewTag(false);
                    setNewTagColor(""); // 既存のを選ぶ時はカラーをリセット
                  }}
                  onLongPress={() => handleLongPressSubTag(t, tagMaster[t].color)} // 🌟 追加：長押しで編集
                  style={[
                    styles.tagChip,
                    tagInput === t && {
                      backgroundColor: tagMaster[t].color,
                      borderColor: tagMaster[t].color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      tagInput === t && { color: "#fff" },
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>

          {/* 🌟 色選択パレット（新規作成時のみ表示） */}
          {isCreatingNewTag && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>カラーを選択（任意）</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ paddingBottom: 5 }}
              >
                {PRESET_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      {
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: color,
                        marginRight: 10,
                      },
                      newTagColor === color && {
                        borderWidth: 3,
                        borderColor: "#1C1C1E",
                      },
                    ]}
                    onPress={() => setNewTagColor(color)}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  }, [
    isReady,
    isAllDay,
    startDate,
    endDate,
    startTime,
    endTime,
    uiThemeColor,
    layerMaster,
    selectedLayer,
    tagMaster,
    tagInput,
    isCreatingNewTag,
    newTagColor,
    repeatType,
    repeatDays,
    repeatInterval,
  ]);

  const subTaskSection = useMemo(() => {
    if (!isReady) return null;
    return (
      <View>
        <TouchableOpacity
          style={[styles.subTaskToggleBtn, { borderColor: uiThemeColor }]}
          onPress={() => setShowSubTasks(!showSubTasks)}
        >
          <Ionicons
            name={showSubTasks ? "chevron-up" : "list-outline"}
            size={18}
            color={uiThemeColor}
          />
          <Text
            style={{ color: uiThemeColor, fontWeight: "bold", marginLeft: 8 }}
          >
            {showSubTasks ? "サブタスク入力を閉じる" : "サブタスクを追加..."}
          </Text>
        </TouchableOpacity>

        {showSubTasks && (
          <View style={styles.expandingInput}>
            {subTasks.map((task, idx) => (
              <View
                key={task.id}
                style={[styles.subTaskCard, { borderLeftColor: uiThemeColor }]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <TextInput
                      style={[
                        styles.subTaskInput,
                        task.isDone && {
                          textDecorationLine: "line-through",
                          color: "#8E8E93",
                        },
                      ]}
                      placeholder="やる事..."
                      placeholderTextColor="#BBB"
                      value={task.title}
                      editable={!task.isDone}
                      onChangeText={(t) => {
                        const n = [...subTasks];
                        n[idx].title = t;
                        setSubTasks(n);
                      }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setSubTasks(subTasks.filter((t) => t.id !== task.id))
                    }
                  >
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>

                {!task.hasDateTime ? (
                  <TouchableOpacity
                    style={[
                      styles.microChip,
                      { alignSelf: "flex-start", marginTop: 8 },
                    ]}
                    onPress={() => {
                      const n = [...subTasks];
                      n[idx].hasDateTime = true;
                      n[idx].reminderOption = "1day";
                      if (!n[idx].date) n[idx].date = new Date(selectedDate);
                      if (!n[idx].endTime) {
                        const future = new Date();
                        future.setHours(future.getHours() + 1);
                        n[idx].endTime = future;
                      }
                      setSubTasks(n);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#8E8E93",
                        fontWeight: "bold",
                      }}
                    >
                      + ⏱️ 日時を追加
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 12,

                        marginBottom: 4,
                        gap: 8,
                      }}
                    >
                      <ModernDatePicker
                        value={task.date}
                        mode="date"
                        onChange={(d) => {
                          const n = [...subTasks];
                          n[idx].date = d;
                          setSubTasks(n);
                        }}
                        themeColor={uiThemeColor}
                        icon="calendar-outline"
                      />
                      <ModernDatePicker
                        value={task.endTime || new Date()}
                        mode="time"
                        onChange={(d) => {
                          const n = [...subTasks];
                          n[idx].endTime = d;
                          setSubTasks(n);
                        }}
                        themeColor={uiThemeColor}
                        icon="time-outline"
                      />
                      <TouchableOpacity
                        style={{ marginLeft: 6 }}
                        onPress={() => {
                          const n = [...subTasks];
                          n[idx].hasDateTime = false;
                          setSubTasks(n);
                        }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#C7C7CC"
                        />
                      </TouchableOpacity>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        marginTop: 8,
                        gap: 6,
                      }}
                    >
                      {[
                        { label: "なし", v: "none" },
                        { label: "当日", v: "exact" },
                        { label: "1時間前", v: "1hour" },
                        { label: "1日前", v: "1day" },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.v}
                          style={[
                            styles.miniReminderChip,
                            task.reminderOption === opt.v && {
                              backgroundColor: uiThemeColor,
                              borderColor: uiThemeColor,
                            },
                          ]}
                          onPress={() => {
                            const n = [...subTasks];
                            n[idx].reminderOption = opt.v;
                            setSubTasks(n);
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "bold",
                              color:
                                task.reminderOption === opt.v
                                  ? "#FFF"
                                  : "#8E8E93",
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: "#E5E5EA",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name="wallet-outline"
                      size={16}
                      color={task.isExpense ? uiThemeColor : "#8E8E93"}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        color: task.isExpense ? uiThemeColor : "#8E8E93",
                        fontWeight: "bold",
                        marginLeft: 6,
                      }}
                    >
                      支出
                    </Text>
                    <Switch
                      value={task.isExpense}
                      onValueChange={(v) => {
                        const n = [...subTasks];
                        n[idx].isExpense = v;
                        setSubTasks(n);
                      }}
                      trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
                      ios_backgroundColor="#E5E5EA"
                      style={{
                        transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }],
                        marginLeft: 4,
                      }}
                    />
                  </View>
                  {task.isExpense && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#F2F2F7",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "bold",
                          color: uiThemeColor,
                          marginRight: 4,
                        }}
                      >
                        ¥
                      </Text>
                      <TextInput
                        style={{
                          fontSize: 14,
                          fontWeight: "bold",
                          minWidth: 60,
                          textAlign: "right",
                          color: "#1C1C1E",
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        value={task.amount ? task.amount.toString() : ""}
                        onChangeText={(t) => {
                          const n = [...subTasks];
                          n[idx].amount = parseInt(t) || 0;
                          setSubTasks(n);
                        }}
                      />
                    </View>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addSubTaskBtn}
              onPress={() => {
                setIsTodo(true);
                setSubTasks([
                  ...subTasks,
                  {
                    id: Date.now(),
                    title: "",
                    date: new Date(selectedDate),
                    hasDateTime: false,
                    amount: 0,
                    isExpense: false,
                    isDone: false,
                    category: selectedCategory,
                  },
                ]);
              }}
            >
              <Ionicons name="add-circle" size={22} color={uiThemeColor} />
              <Text
                style={{
                  color: uiThemeColor,
                  fontWeight: "bold",
                  marginLeft: 8,
                }}
              >
                子タスクを追加
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [
    isReady,
    showSubTasks,
    subTasks,
    uiThemeColor,
    selectedCategory,
    selectedDate,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onShow={() => setIsReady(true)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback>
          <View
            style={[
              styles.modalContent,
              { borderTopWidth: 8, borderTopColor: uiThemeColor },
            ]}
          >
            {!isReady ? (
              <View style={{ flex: 1, justifyContent: "center" }}>
                <ActivityIndicator size="large" color={uiThemeColor} />
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <View style={styles.headerRow}>
                  <Text style={[styles.modalTitle, { color: uiThemeColor }]}>
                    {selectedItem ? "予定を編集" : "新規作成"}
                  </Text>
                  <Text style={styles.dateBadge}>{selectedDate}</Text>
                </View>
                <TextInput
                  style={styles.mainInput}
                  placeholder="予定のタイトル"
                  placeholderTextColor="#AEAEB2"
                  value={inputText}
                  onChangeText={setInputText}
                />

                {suggestions.length > 0 && (
                  <View style={styles.suggestionWrapper}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {suggestions.map((s, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.suggestionBadge}
                          onPress={() => setInputText(s)}
                        >
                          <Text style={styles.suggestionText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {timeAndTagSection}

                <View
                  style={[
                    styles.optionSection,
                    { borderLeftColor: uiThemeColor },
                  ]}
                >
                  <View style={{ marginBottom: 20 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <Ionicons
                        name="notifications"
                        size={18}
                        color={uiThemeColor}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.switchLabel,
                          {
                            color: uiThemeColor,
                            fontWeight: "800",
                            letterSpacing: 0.5,
                          },
                        ]}
                      >
                        通知リマインダー
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                        paddingBottom: 8,
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.layerChip,
                          {
                            borderWidth: 1,
                            borderColor: "#E5E5EA",
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            backgroundColor: "#FFF",
                          },
                          selectedReminders.length === 0 && {
                            backgroundColor: uiThemeColor,
                            borderColor: uiThemeColor,
                          },
                        ]}
                        onPress={() => {
                          setSelectedReminders([]);
                          setCustomReminderTimes([]);
                        }}
                      >
                        <Text
                          style={[
                            styles.layerChipText,
                            selectedReminders.length === 0 && {
                              color: "#fff",
                              fontWeight: "bold",
                            },
                          ]}
                        >
                          なし
                        </Text>
                      </TouchableOpacity>

                      {(isAllDay
                        ? [
                          { label: "当日の朝", value: "morning" },
                          { label: "前日", value: "dayBefore" },
                          { label: "2日前", value: "2daysBefore" },
                          { label: "カスタム", value: "custom" },
                        ]
                        : [
                          { label: "ちょうど", value: "exact" },
                          { label: "10分前", value: "10min" },
                          { label: "30分前", value: "30min" },
                          { label: "1時間前", value: "1hour" },
                          { label: "当日の朝", value: "morning" },
                          { label: "カスタム", value: "custom" },
                        ]
                      ).map((opt) => {
                        const isSelected = selectedReminders.includes(
                          opt.value,
                        );
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.layerChip,
                              {
                                borderWidth: 1,
                                borderColor: "#E5E5EA",
                                borderRadius: 20,
                                paddingHorizontal: 16,
                                backgroundColor: isSelected
                                  ? uiThemeColor
                                  : "#FFF",
                                shadowColor: isSelected ? uiThemeColor : "#000",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: isSelected ? 0.4 : 0.05,
                                shadowRadius: 3,
                                elevation: 2,
                              },
                            ]}
                            onPress={() =>
                              setSelectedReminders((prev) => {
                                if (prev.includes(opt.value)) {
                                  return prev.filter((v) => v !== opt.value);
                                } else {
                                  if (
                                    opt.value === "custom" &&
                                    customReminderTimes.length === 0
                                  ) {
                                    setCustomReminderTimes([new Date()]);
                                  }
                                  return [...prev, opt.value];
                                }
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.layerChipText,
                                isSelected && {
                                  color: "#fff",
                                  fontWeight: "bold",
                                },
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {selectedReminders.includes("custom") && (
                      <View
                        style={{
                          marginTop: 12,
                          padding: 12,
                          backgroundColor: uiThemeColor + "12",
                          borderRadius: 15,
                          borderLeftWidth: 3,
                          borderLeftColor: uiThemeColor,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "bold",
                            color: uiThemeColor,
                            marginBottom: 10,
                          }}
                        >
                          通知する日時を設定:
                        </Text>
                        {customReminderTimes.map((time, idx) => (
                          <View
                            key={idx}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 10,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <ModernDatePicker
                                value={time}
                                mode="date"
                                onChange={(d) => {
                                  const n = [...customReminderTimes];
                                  n[idx] = d;
                                  setCustomReminderTimes(n);
                                }}
                                themeColor={uiThemeColor}
                                icon="calendar-outline"
                              />
                              <ModernDatePicker
                                value={time}
                                mode="time"
                                onChange={(d) => {
                                  const n = [...customReminderTimes];
                                  n[idx] = d;
                                  setCustomReminderTimes(n);
                                }}
                                themeColor={uiThemeColor}
                                icon="time-outline"
                              />
                            </View>
                            <TouchableOpacity
                              onPress={() =>
                                setCustomReminderTimes(
                                  customReminderTimes.filter(
                                    (_, i) => i !== idx,
                                  ),
                                )
                              }
                            >
                              <Ionicons
                                name="remove-circle"
                                size={24}
                                color="#FF3B30"
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                        <TouchableOpacity
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 5,
                            alignSelf: "flex-start",
                          }}
                          onPress={() =>
                            setCustomReminderTimes([
                              ...customReminderTimes,
                              new Date(),
                            ])
                          }
                        >
                          <Ionicons
                            name="add-circle"
                            size={20}
                            color={uiThemeColor}
                          />
                          <Text
                            style={{
                              color: uiThemeColor,
                              fontWeight: "bold",
                              marginLeft: 5,
                            }}
                          >
                            さらに時間を追加
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>予定として表示</Text>
                    <Switch
                      value={isEvent}
                      onValueChange={setIsEvent}
                      trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
                      ios_backgroundColor="#E5E5EA"
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>ToDoリストに表示</Text>
                    <Switch
                      value={isTodo}
                      onValueChange={setIsTodo}
                      trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
                      ios_backgroundColor="#E5E5EA"
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>支出を記録</Text>
                    <Switch
                      value={isExpense}
                      onValueChange={setIsExpense}
                      trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
                      ios_backgroundColor="#E5E5EA"
                    />
                  </View>

                  {isExpense && (
                    <View>
                      <TextInput
                        style={styles.input}
                        placeholder="金額 (¥)"
                        placeholderTextColor="#AEAEB2"
                        keyboardType="numeric"
                        value={inputAmount}
                        onChangeText={setInputAmount}
                      />
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 10,
                        }}
                      >
                        {currentQuickTags.map((cat, idx) => (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.layerChip,
                              selectedCategory === cat && {
                                backgroundColor: uiThemeColor,
                              },
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                          >
                            <Text
                              style={[
                                styles.layerChipText,
                                selectedCategory === cat && { color: "#fff" },
                              ]}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                  {subTaskSection}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                    <Text style={{ color: "#999" }}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSavePress}
                    style={[styles.saveBtn, { backgroundColor: uiThemeColor }]}
                  >
                    <Text style={styles.saveBtnText}>保存して閉じる</Text>
                  </TouchableOpacity>
                </View>

                {selectedItem && (
                  <TouchableOpacity
                    onPress={handleDeletePress}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    <Text style={styles.deleteBtnText}>この予定を削除する</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>

      {editSubTagModalVisible && (
        <Modal visible={editSubTagModalVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditSubTagModalVisible(false)}>
            <View style={[styles.modalContent, { height: "auto", borderTopWidth: 8, borderTopColor: editingSubTagColor || uiThemeColor }]}>
              <Text style={[styles.modalTitle, { marginBottom: 15 }]}>属性の編集</Text>

              <Text style={styles.label}>属性名</Text>
              <TextInput style={styles.input} value={editingSubTagName} onChangeText={setEditingSubTagName} autoFocus />

              <Text style={[styles.label, { marginTop: 15 }]}>カラー</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, paddingBottom: 5 }}>
                {PRESET_COLORS.map((color) => (
                  <TouchableOpacity key={color} style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, marginRight: 10 }, editingSubTagColor === color && { borderWidth: 3, borderColor: "#1C1C1E" }]} onPress={() => setEditingSubTagColor(color)} />
                ))}
              </ScrollView>

              <View style={[styles.actionButtons, { justifyContent: "space-between", marginTop: 0 }]}>
                <TouchableOpacity onPress={deleteSubTag} style={styles.cancelBtn}><Text style={{ color: "#FF3B30", fontWeight: "bold" }}>削除</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: editingSubTagColor || uiThemeColor }]} onPress={saveEditedSubTag}><Text style={styles.saveBtnText}>保存</Text></TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 🌟 追加：カテゴリ（プリセット）の名称編集モーダル */}
      {editQuickTagModal && (
        <Modal visible={editQuickTagModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditQuickTagModal(false)}>
            <View style={[styles.modalContent, { height: "auto", borderTopWidth: 8, borderTopColor: uiThemeColor }]}>
              <Text style={[styles.modalTitle, { marginBottom: 15 }]}>カテゴリ名の編集</Text>
              <Text style={styles.label}>新しい名称を入力</Text>
              <TextInput style={styles.input} value={tempQuickTagText} onChangeText={setTempQuickTagText} autoFocus />
              <View style={[styles.actionButtons, { justifyContent: "center", marginTop: 20 }]}>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: uiThemeColor, width: "100%", alignItems: "center" }]} onPress={saveQuickTag}>
                  <Text style={styles.saveBtnText}>保存する</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "94%",
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 25,
    height: "75%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  dateBadge: {
    backgroundColor: "#E5E5EA",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
  },
  mainInput: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1C1C1E",
  },
  timeSection: {
    backgroundColor: "#F8F8FA",
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
  },
  timePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    gap: 5,
  },
  timePreviewText: { fontSize: 13, fontWeight: "bold" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  switchLabel: { fontSize: 14, color: "#1C1C1E", fontWeight: "600" },
  timePickerContainer: {
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    paddingTop: 10,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeLabel: { fontSize: 12, color: "#1C1C1E", fontWeight: "600" },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  layerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 15,
  },
  layerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
  },
  layerChipText: { fontSize: 12, color: "#666", fontWeight: "bold" },
  tagSection: { marginBottom: 15 },
  addTagCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  // 🌟 追加：新しい属性入力枠のスタイル
  newTagInput: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    minWidth: 120,
    backgroundColor: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },

  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
    marginRight: 8,
  },
  tagText: { fontSize: 12, fontWeight: "600" },
  optionSection: {
    backgroundColor: "#F8F8FA",
    padding: 12,
    borderRadius: 15,
    borderLeftWidth: 4,
    marginBottom: 15,
  },
  input: {
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EEE",
    marginTop: 10,
    color: "#1C1C1E",
    fontWeight: "bold",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 15,
  },
  cancelBtn: { padding: 10 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  saveBtnText: { color: "#fff", fontWeight: "bold" },
  deleteBtn: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  deleteBtnText: { color: "#FF3B30", fontSize: 13, fontWeight: "bold" },
  suggestionWrapper: { marginBottom: 10, height: 32 },
  suggestionBadge: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  suggestionText: { fontSize: 12, color: "#333" },
  subTaskToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    marginTop: 10,
  },
  expandingInput: { marginTop: 15 },
  subTaskCard: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
  },
  addSubTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    marginTop: 5,
  },
  subTaskInput: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    color: "#333",
    paddingVertical: 5,
  },
  microChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
  },
  modernDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  iosPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  iosPickerContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F5",
  },
  miniReminderChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  customRepeatArea: {
    backgroundColor: "#F8F8FA",
    padding: 16,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#AEAEB2",
    textTransform: "uppercase",
  },
  daySelectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 20,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  dayText: { fontSize: 12, fontWeight: "bold", color: "#8E8E93" },
  intervalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    paddingTop: 15,
  },
  intervalInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    width: 50,
    textAlign: "center",
    paddingVertical: 4,
    fontSize: 16,
    fontWeight: "bold",
    color: "#1C1C1E",
  },
});
