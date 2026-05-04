import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";

// 🌟 通知の脳みそをインポート
import { useNotificationManager } from "../../../hooks/useNotificationManager";
import { ScheduleItem, SubTask } from "../../../types";
import { PRESET_COLORS } from "../../../utils/helpers";

import { exportToStandardCalendar } from "../../../hooks/useCalendarExport";

import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../../../firebaseConfig";

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
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
  scheduleData: { [date: string]: ScheduleItem[] };
  setScheduleData: (data: { [date: string]: ScheduleItem[] }) => void;
  layerMaster?: { [key: string]: string };
  tagMaster?: { [key: string]: { layer: string; color: string } };
  setTagMaster?: (data: {
    [key: string]: { layer: string; color: string };
  }) => void;
  onForceRender?: () => void;
  isExternalSyncEnabled?: boolean;
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
            name={icon as React.ComponentProps<typeof Ionicons>["name"]}
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
  const [editingLayerForQuick, setEditingLayerForQuick] =
    useState("ALL_LAYERS");

  // 🌟 追加：属性編集用State
  const [editSubTagModalVisible, setEditSubTagModalVisible] = useState(false);
  const [editingSubTagOriginalName, setEditingSubTagOriginalName] =
    useState("");
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
      newTags[editingLayerForQuick] = [
        ...(quickMainTags["ALL_LAYERS"] || [
          "食費",
          "交通",
          "日用品",
          "交際費",
          "趣味",
          "その他",
        ]),
      ];
    }
    newTags[editingLayerForQuick][editingTagIndex] = tempQuickTagText.trim();
    setQuickMainTags(newTags);
    await AsyncStorage.setItem("quickMainTagsData", JSON.stringify(newTags));
    if (
      selectedCategory ===
      quickMainTags[editingLayerForQuick]?.[editingTagIndex]
    ) {
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
    setTagMaster?.(newTagMaster);
    await AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
    setEditSubTagModalVisible(false);
  };

  const deleteSubTag = async () => {
    Alert.alert(
      "確認",
      `属性「${editingSubTagOriginalName}」を削除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            const newTagMaster = { ...tagMaster };
            delete newTagMaster[editingSubTagOriginalName];
            setTagMaster?.(newTagMaster);
            await AsyncStorage.setItem(
              "tagMasterData",
              JSON.stringify(newTagMaster),
            );
            if (tagInput === editingSubTagOriginalName) setTagInput("");
            setEditSubTagModalVisible(false);
          },
        },
      ],
    );
  };

  const [selectedReminders, setSelectedReminders] = useState<string[]>([]);
  const [customReminderTimes, setCustomReminderTimes] = useState<Date[]>([]);
  const { scheduleItemNotification, cancelItemNotification } =
    useNotificationManager();

  const uiThemeColor = layerMaster[selectedLayer] || "#007AFF";

  // 🌟 追加：簡易モードの判定フラグ
  const [isSimpleMode, setIsSimpleMode] = useState(true);

  // 🌟 追加：開いた時に、親画面のモードに合わせて初期化する
  useEffect(() => {
    if (visible) {
      if (selectedItem) {
        // 既存の予定を編集する時は詳細画面からスタート
        setIsSimpleMode(false);
      } else {
        // 新規作成時は簡易画面からスタート
        setIsSimpleMode(true);
        // カレンダー・ToDo・家計簿のどの画面から開いたかに合わせてタブを自動選択
        if (activeMode === "todo") {
          setIsTodo(true); setIsEvent(false); setIsExpense(false);
        } else if (activeMode === "money") {
          setIsExpense(true); setIsTodo(false); setIsEvent(false);
        } else {
          setIsEvent(true); setIsTodo(false); setIsExpense(false);
        }
      }
    }
  }, [visible, selectedItem, activeMode]);

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

  // 🌟 1. 画面の初期化が完了したかを記憶するフラグ
  const isInitialized = useRef(false);

  useEffect(() => {
    // 画面が閉じている時はリセット
    if (!visible) {
      setIsReady(false);
      isInitialized.current = false;
      return;
    }

    if (isInitialized.current) return;

    // 🌟 2. 画面がスライドしてくるアニメーションを優先するため、
    // 　　  中身の重い処理（準備）を「10ミリ秒」だけ遅らせて実行する
    const timer = setTimeout(() => {
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

        const savedLayer =
          tagMaster?.[selectedItem.tag || ""]?.layer ||
          (layerMaster[selectedItem.tag || ""] ? selectedItem.tag : def);
        setSelectedLayer(savedLayer || def);

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
        setNewTagColor("");

        const savedSubTasks = selectedItem.subTasks || [];
        setSubTasks(savedSubTasks);
        setShowSubTasks(savedSubTasks.length > 0);

        const snapshot = JSON.stringify({
          title: selectedItem.title || "",
          amount: parseInt(selectedItem.amount?.toString() || "0"),
          isTodo: selectedItem.isTodo ?? false,
          subTasksData: savedSubTasks
            .map((t: SubTask) => `${t.title}_${t.isDone}`)
            .join(","),
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
        setNewTagColor("");

        setSubTasks([]);
        setShowSubTasks(false);
      }
      setIsCreatingNewTag(false);

      isInitialized.current = true;
      setIsReady(true); // 🌟 ここで「準備完了」の合図を出す
    }, 10); // 👈 10ms後に実行する

    // 🌟 タイマーの後始末
    return () => clearTimeout(timer);
  }, [visible, selectedItem, activeMode, layerMaster, selectedDate, tagMaster]);

  const toHiragana = (str: string) =>
    str
      .replace(/[\u30a1-\u30f6]/g, (m) =>
        String.fromCharCode(m.charCodeAt(0) - 0x60),
      )
      .toLowerCase();

  const titleHistory = useMemo(() => {
    // 🌟 1. 画面の準備ができていない時は計算を完全にスキップする
    if (!isReady || !visible) return [];

    const titles = new Set<string>();

    // 🌟 2. すべての過去の予定ではなく、直近「150件」のデータだけを調べる
    const allItems = Object.values(scheduleData).flat() as ScheduleItem[];
    const recentItems = allItems.slice(-150);

    recentItems.forEach((i) => {
      if (i.title) titles.add(i.title);
    });

    return Array.from(titles);
  }, [scheduleData, isReady, visible]); // 👈 依存配列も忘れずに

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
        setTagMaster?.(m);
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

    // 🌟 自動完了の判定ロジック（お金の記録を除外）
    const pureTodos = updatedSubTasks.filter(
      (t) => !t.isExpense && !t.isIncome,
    );
    const allDone = pureTodos.length > 0 && pureTodos.every((t) => t.isDone);

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
      isDone: allDone ? true : selectedItem ? selectedItem.isDone : false, // 🌟 完了状態をここで確定
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

    const isShared = selectedLayer === "共有" || finalTag === "共有";

    if (isShared) {
      try {
        const docId = selectedItem ? selectedItem.id : Date.now().toString();
        const docRef = doc(db, "shared_schedules", docId);
        await setDoc(docRef, {
          ...itemData,
          id: docId,
          date: sStr,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("共有保存エラー:", e);
        Alert.alert("エラー", "共有データの保存に失敗しました。");
      }
    } else {
      if (selectedItem) {
        if (mode === "single") {
          Object.keys(newData).forEach((d) => {
            newData[d] = newData[d].map((i: ScheduleItem) => {
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
            newData[d] = newData[d].filter(
              (i: ScheduleItem) => i.id !== selectedItem.id,
            );
          });
          if (!newData[sStr]) newData[sStr] = [];
          newData[sStr].push({ ...selectedItem, ...itemData });
        }
      } else {
        // 🌟 新規保存：isDone: false を削除（itemDataに入っているためエラーを回避）
        if (!newData[sStr]) newData[sStr] = [];
        newData[sStr].push({
          id: Date.now().toString(),
          ...itemData,
        });
      }
    }

    const startForExport = isAllDay
      ? startDate
      : new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        startTime.getHours(),
        startTime.getMinutes(),
      );
    const endForExport = isAllDay
      ? endDate
      : new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        endTime.getHours(),
        endTime.getMinutes(),
      );

    // 🌟 戻り値のIDを受け取り、既存のIDがあれば渡す
    const returnedId = await exportToStandardCalendar(
      inputText,
      startForExport,
      endForExport,
      isAllDay,
      selectedItem?.externalEventId,
    );

    // 🌟 先ほど newData にプッシュしたアイテムにIDを記録する
    if (returnedId && newData[sStr] && newData[sStr].length > 0) {
      newData[sStr][newData[sStr].length - 1].externalEventId = returnedId;
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

    // 🌟 追加：アプリから消す前に、外部カレンダーからも予定を消す
    if (selectedItem.externalEventId) {
      try {
        await Calendar.deleteEventAsync(selectedItem.externalEventId);
      } catch (e) { }
    }

    const newData = { ...scheduleData };

    if (mode === "single") {
      Object.keys(newData).forEach((d) => {
        newData[d] = newData[d].map((i: ScheduleItem) => {
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

      const isShared =
        selectedItem.tags?.includes("共有") || selectedItem.tag === "共有";
      if (isShared) {
        try {
          await deleteDoc(doc(db, "shared_schedules", selectedItem.id));
        } catch (e) {
          console.error("共有データ削除エラー:", e);
        }
      } else {
        Object.keys(newData).forEach((d) => {
          newData[d] = newData[d].filter(
            (i: ScheduleItem) => i.id !== selectedItem.id,
          );
        });
      }
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
              onPress={() =>
                setRepeatType(
                  opt.value as
                  | "none"
                  | "daily"
                  | "weekly"
                  | "monthly"
                  | "custom",
                )
              }
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
                  onLongPress={() =>
                    handleLongPressSubTag(t, tagMaster[t].color)
                  } // 🌟 追加：長押しで編集
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
            {showSubTasks ? "詳細入力を閉じる" : "詳細を追加"}
          </Text>
        </TouchableOpacity>

        {showSubTasks && (
          <View style={styles.expandingInput}>
            {subTasks.map((task, idx) => (
              <View
                key={task.id}
                style={[
                  styles.subTaskCard,
                  {
                    borderLeftColor: task.isExpense
                      ? "#FF9500"
                      : task.isIncome
                        ? "#34C759"
                        : uiThemeColor,
                  },
                  { paddingVertical: 12 },
                ]}
              >
                {task.isExpense ? (
                  // =======================================================
                  // 💰 【金額・内訳モード】
                  // =======================================================
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "bold",
                          color: "#8E8E93",
                        }}
                      >
                        カテゴリを選択
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setSubTasks(subTasks.filter((t) => t.id !== task.id))
                        }
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 15 }}
                    >
                      {currentQuickTags.map((cat) => {
                        const isSelected = task.category === cat;
                        return (
                          <TouchableOpacity
                            key={cat}
                            onPress={() => {
                              const n = [...subTasks];
                              n[idx].category = cat;
                              n[idx].title = cat;
                              setSubTasks(n);
                            }}
                            style={[
                              styles.miniReminderChip,
                              {
                                marginRight: 8,
                                borderRadius: 16,
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                              },
                              isSelected && {
                                backgroundColor: "#FF9500",
                                borderColor: "#FF9500",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "bold",
                                color: isSelected ? "#FFF" : "#8E8E93",
                              }}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#F2F2F7",
                        padding: 12,
                        borderRadius: 14,
                      }}
                    >
                      <Ionicons
                        name="wallet-outline"
                        size={16}
                        color="#FF9500"
                        style={{ marginRight: 8 }}
                      />
                      <TextInput
                        style={{
                          flex: 1,
                          fontSize: 18,
                          fontWeight: "bold",
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
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "bold",
                          color: "#1C1C1E",
                          marginLeft: 6,
                        }}
                      >
                        円
                      </Text>
                    </View>
                  </View>
                ) : (
                  // =======================================================
                  // ✅ 【タスクモード】レイアウトを2段に分けてスペースを確保
                  // =======================================================
                  <View>
                    {/* 1段目：チェック・タイトル・削除ボタン（タイトル幅を最大化） */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          const n = [...subTasks];
                          n[idx].isDone = !n[idx].isDone;
                          setSubTasks(n);
                        }}
                        style={{ marginRight: 10 }}
                      >
                        <Ionicons
                          name={task.isDone ? "checkbox" : "square-outline"}
                          size={24}
                          color={task.isDone ? "#8E8E93" : uiThemeColor}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={[
                          styles.subTaskInput,
                          {
                            flex: 1,
                            fontSize: 16,
                            minHeight: 32,
                            paddingVertical: 4,
                          }, // 🌟 高さを固定せず、最低限の余白を確保
                          task.isDone && {
                            textDecorationLine: "line-through",
                            color: "#8E8E93",
                          },
                        ]}
                        placeholder="タスクを入力..."
                        placeholderTextColor="#BBB"
                        value={task.title}
                        onChangeText={(t) => {
                          const n = [...subTasks];
                          n[idx].title = t;
                          setSubTasks(n);
                        }}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setSubTasks(subTasks.filter((t) => t.id !== task.id))
                        }
                        style={{ marginLeft: 8 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* 2段目：収入と期限（横並びに配置） */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {/* 収入記録 */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: task.isIncome
                            ? "#34C75915"
                            : "#F2F2F7",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                        }}
                      >
                        <Ionicons
                          name="trending-up"
                          size={14}
                          color={task.isIncome ? "#34C759" : "#8E8E93"}
                        />
                        <Switch
                          value={task.isIncome || false}
                          onValueChange={(v) => {
                            const n = [...subTasks];
                            n[idx].isIncome = v;
                            if (v) n[idx].isExpense = false;
                            setSubTasks(n);
                          }}
                          style={{ transform: [{ scale: 0.6 }], marginLeft: 2 }}
                          trackColor={{ false: "#C7C7CC", true: "#34C759" }}
                        />
                        {task.isIncome && (
                          <TextInput
                            style={{
                              width: 60,
                              textAlign: "right",
                              fontSize: 12,
                              fontWeight: "bold",
                              marginLeft: 4,
                            }}
                            keyboardType="numeric"
                            placeholder="￥金額"
                            value={task.amount ? task.amount.toString() : ""}
                            onChangeText={(t) => {
                              const n = [...subTasks];
                              n[idx].amount = parseInt(t) || 0;
                              setSubTasks(n);
                            }}
                          />
                        )}
                      </View>

                      {/* 🌟 期限設定（日付と時間の両方） */}
                      {!task.hasDateTime ? (
                        <TouchableOpacity
                          style={[styles.microChip, { paddingVertical: 6 }]}
                          onPress={() => {
                            const n = [...subTasks];
                            n[idx].hasDateTime = true;
                            // 🌟 スタート日は selectedDate のまま、期限の初期値を設定
                            n[idx].deadlineDate = new Date(selectedDate);
                            n[idx].endTime = new Date();
                            setSubTasks(n);
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#8E8E93",
                              fontWeight: "bold",
                            }}
                          >
                            + ⏱️ 締切を設定
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <ModernDatePicker
                            value={task.deadlineDate || new Date(selectedDate)}
                            mode="date"
                            onChange={(d) => {
                              const n = [...subTasks];
                              n[idx].deadlineDate = d;
                              setSubTasks(n);
                            }}
                            themeColor={uiThemeColor}
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
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const n = [...subTasks];
                              n[idx].hasDateTime = false;
                              setSubTasks(n);
                            }}
                          >
                            <Ionicons name="close" size={16} color="#8E8E93" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[
                  styles.addSubTaskBtn,
                  {
                    flex: 1,
                    backgroundColor: uiThemeColor + "15",
                    borderRadius: 12,
                    paddingVertical: 12,
                    justifyContent: "center",
                  },
                ]}
                onPress={() => {
                  setIsTodo(true);
                  // 🌟 追加した瞬間の日付を date (スタート日) として自動保持
                  setSubTasks([
                    ...subTasks,
                    {
                      id: Date.now(),
                      title: "",
                      date: new Date(selectedDate),
                      hasDateTime: false,
                      amount: 0,
                      isExpense: false,
                      isIncome: false,
                      isDone: false,
                      category: "",
                    },
                  ]);
                }}
              >
                <Ionicons name="add-circle" size={18} color={uiThemeColor} />
                <Text
                  style={{
                    color: uiThemeColor,
                    fontWeight: "bold",
                    marginLeft: 6,
                  }}
                >
                  サブタスク
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addSubTaskBtn,
                  {
                    flex: 1,
                    backgroundColor: "#FF950015",
                    borderRadius: 12,
                    paddingVertical: 12,
                    justifyContent: "center",
                  },
                ]}
                onPress={() => {
                  setIsExpense(true);
                  setSubTasks([
                    ...subTasks,
                    {
                      id: Date.now(),
                      title: "",
                      date: new Date(selectedDate),
                      hasDateTime: false,
                      amount: 0,
                      isExpense: true,
                      isIncome: false,
                      isDone: false,
                      category: currentQuickTags[0] || "食費",
                    },
                  ]);
                }}
              >
                <Ionicons name="wallet" size={18} color="#FF9500" />
                <Text
                  style={{
                    color: "#FF9500",
                    fontWeight: "bold",
                    marginLeft: 6,
                  }}
                >
                  追加出費
                </Text>
              </TouchableOpacity>
            </View>
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
    currentQuickTags,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onShow={() => setIsReady(true)}
      onRequestClose={onClose} // 🌟 追加: Androidの戻るボタンで閉じる対応
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          // 🌟 変更: 外側をタップしたら「キーボードを閉じる」＋「画面を閉じる」
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        >
          {/* 🌟 変更: 内側（白い画面）をタップした時は「キーボードを閉じる」だけに留め、画面は閉じないようにブロック */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View
              style={[
                styles.modalContent,
                { borderTopWidth: 8, borderTopColor: uiThemeColor },
              ]}
            >
              {isSimpleMode ? (
                // ==========================================
                // 🟢 【大幅改善】新・簡易追加画面
                // ==========================================
                <View style={styles.simpleMainWrapper}>
                  {/* 1. ドラッグバー */}
                  <View style={styles.simpleDragBar} />

                  {/* 2. タイトル入力（大部分を占める大きな入力欄） */}
                  <TextInput
                    style={styles.simpleHeroInput}
                    placeholder="予定のタイトルを入力"
                    placeholderTextColor="#C7C7CC"
                    autoFocus
                    value={inputText}
                    onChangeText={setInputText}
                    multiline={false}
                  />

                  {/* 3. 日時・時間設定エリア（カード形式） */}
                  <View style={styles.simpleDateTimeCard}>
                    <View style={styles.timeRow}>
                      {/* 🌟 アイコンの代わりに「開始」の文字を入れて幅を固定 */}
                      <View style={styles.timeLabelContainer}>
                        <Text style={[styles.timeLabelText, { color: uiThemeColor }]}>開始</Text>
                      </View>
                      <View style={styles.timePickerGroup}>
                        <ModernDatePicker
                          value={startDate}
                          mode="date"
                          onChange={setStartDate}
                          themeColor={uiThemeColor}
                        />
                        <ModernDatePicker
                          value={startTime}
                          mode="time"
                          onChange={setStartTime}
                          themeColor={uiThemeColor}
                        />
                      </View>
                    </View>
                    <View style={styles.timeDivider} />
                    <View style={styles.timeRow}>
                      {/* 🌟 「終了」の文字 */}
                      <View style={styles.timeLabelContainer}>
                        <Text style={styles.timeLabelText}>終了</Text>
                      </View>
                      <View style={styles.timePickerGroup}>
                        <ModernDatePicker
                          value={endDate}
                          mode="date"
                          onChange={setEndDate}
                          themeColor={uiThemeColor}
                        />
                        <ModernDatePicker
                          value={endTime}
                          mode="time"
                          onChange={setEndTime}
                          themeColor={uiThemeColor}
                        />
                      </View>
                    </View>
                  </View>

                  {/* 🌟 4. 追加：カテゴリ（レイヤー）選択エリア */}
                  <View style={styles.simpleCategorySection}>
                    <Text style={styles.simpleCategoryTitle}>カテゴリ</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: "100%" }}>
                      {Object.keys(tagMaster).map((layerName) => {
                        // 以前の最強ロジックと同じく色を取得
                        const layerColor = tagMaster[layerName]?.color || layerMaster[layerName] || uiThemeColor;
                        const isSelected = selectedLayer === layerName;
                        return (
                          <TouchableOpacity
                            key={layerName}
                            style={[
                              styles.simpleCategoryChip,
                              isSelected && { backgroundColor: layerColor, borderColor: layerColor }
                            ]}
                            onPress={() => setSelectedLayer(layerName)}
                          >
                            <Text style={[styles.simpleCategoryChipText, isSelected && { color: "#FFF" }]}>
                              {layerName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* 4. オプションボタン（ToDo & 金額） */}
                  <View style={styles.simpleActionRow}>
                    {/* ToDo切り替えボタン */}
                    <TouchableOpacity
                      style={[styles.simpleOptBtn, isTodo && { backgroundColor: "#34C759", borderColor: "#34C759" }]}
                      onPress={() => setIsTodo(!isTodo)}
                    >
                      <Ionicons name="checkbox" size={22} color={isTodo ? "#FFF" : "#8E8E93"} />
                      <Text style={[styles.simpleOptBtnText, isTodo && { color: "#FFF" }]}>ToDoに追加</Text>
                    </TouchableOpacity>

                    {/* 金額入力切り替えボタン */}
                    <TouchableOpacity
                      style={[styles.simpleOptBtn, isExpense && { backgroundColor: "#FFCC00", borderColor: "#FFCC00" }]}
                      onPress={() => setIsExpense(!isExpense)}
                    >
                      <Ionicons name="wallet" size={22} color={isExpense ? "#FFF" : "#FFCC00"} />
                      <Text style={[styles.simpleOptBtnText, isExpense && { color: "#FFF" }]}>支出を記録</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 5. 条件付き金額入力エリア（支出ONの時だけふわっと出す） */}
                  {isExpense && (
                    <View style={styles.simpleAmountSection}>
                      <Text style={styles.amountSymbol}>¥</Text>
                      <TextInput
                        style={styles.simpleHeroAmountInput}
                        placeholder="0"
                        placeholderTextColor="#C7C7CC"
                        keyboardType="numeric"
                        value={inputAmount}
                        onChangeText={setInputAmount}
                      />
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniCategoryScroll}>
                        {["食費", "日用品", "交通費", "交際費", "趣味", "固定費"].map((cat) => (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.miniChip, selectedCategory === cat && { backgroundColor: "#FFCC00" }]}
                            onPress={() => setSelectedCategory(cat)}
                          >
                            <Text style={[styles.miniChipText, selectedCategory === cat && { color: "#FFF" }]}>{cat}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 6. 下部アクション */}
                  <View style={styles.simpleBottomActions}>
                    <TouchableOpacity style={styles.simpleDetailLink} onPress={() => setIsSimpleMode(false)}>
                      <Text style={[styles.simpleDetailLinkText, { color: uiThemeColor }]}>詳細設定を表示</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.simpleLargeSaveBtn, { backgroundColor: uiThemeColor }]}
                      onPress={handleSavePress}
                    >
                      <Text style={styles.simpleLargeSaveBtnText}>保存して閉じる</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (

                // ==========================================
                // 🔵 B. 詳細画面（今までの ScrollView など）
                // ==========================================
                <>


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
                                { label: "当日の朝(7:00)", value: "morning" },
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
                                      shadowColor: isSelected
                                        ? uiThemeColor
                                        : "#000",
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
                        <TouchableOpacity
                          onPress={onClose}
                          style={styles.cancelBtn}
                        >
                          <Text style={{ color: "#999" }}>キャンセル</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleSavePress}
                          style={[
                            styles.saveBtn,
                            { backgroundColor: uiThemeColor },
                          ]}
                        >
                          <Text style={styles.saveBtnText}>保存して閉じる</Text>
                        </TouchableOpacity>
                      </View>
                      {selectedItem && (
                        <TouchableOpacity
                          onPress={handleDeletePress}
                          style={styles.deleteBtn}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#FF3B30"
                          />
                          <Text style={styles.deleteBtnText}>
                            この予定を削除する
                          </Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  )}
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>

        {editSubTagModalVisible && (
          <Modal
            visible={editSubTagModalVisible}
            transparent
            animationType="fade"
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setEditSubTagModalVisible(false)}
            >
              <View
                style={[
                  styles.modalContent,
                  {
                    height: "auto",
                    borderTopWidth: 8,
                    borderTopColor: editingSubTagColor || uiThemeColor,
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { marginBottom: 15 }]}>
                  属性の編集
                </Text>

                <Text style={styles.label}>属性名</Text>
                <TextInput
                  style={styles.input}
                  value={editingSubTagName}
                  onChangeText={setEditingSubTagName}
                  autoFocus
                />

                <Text style={[styles.label, { marginTop: 15 }]}>カラー</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 20, paddingBottom: 5 }}
                >
                  {PRESET_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        {
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          backgroundColor: color,
                          marginRight: 10,
                        },
                        editingSubTagColor === color && {
                          borderWidth: 3,
                          borderColor: "#1C1C1E",
                        },
                      ]}
                      onPress={() => setEditingSubTagColor(color)}
                    />
                  ))}
                </ScrollView>

                <View
                  style={[
                    styles.actionButtons,
                    { justifyContent: "space-between", marginTop: 0 },
                  ]}
                >
                  <TouchableOpacity
                    onPress={deleteSubTag}
                    style={styles.cancelBtn}
                  >
                    <Text style={{ color: "#FF3B30", fontWeight: "bold" }}>
                      削除
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { backgroundColor: editingSubTagColor || uiThemeColor },
                    ]}
                    onPress={saveEditedSubTag}
                  >
                    <Text style={styles.saveBtnText}>保存</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* 🌟 追加：カテゴリ（プリセット）の名称編集モーダル */}
        {editQuickTagModal && (
          <Modal visible={editQuickTagModal} transparent animationType="fade">
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setEditQuickTagModal(false)}
            >
              <View
                style={[
                  styles.modalContent,
                  {
                    height: "auto",
                    borderTopWidth: 8,
                    borderTopColor: uiThemeColor,
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { marginBottom: 15 }]}>
                  カテゴリ名の編集
                </Text>
                <Text style={styles.label}>新しい名称を入力</Text>
                <TextInput
                  style={styles.input}
                  value={tempQuickTagText}
                  onChangeText={setTempQuickTagText}
                  autoFocus
                />
                <View
                  style={[
                    styles.actionButtons,
                    { justifyContent: "center", marginTop: 20 },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      {
                        backgroundColor: uiThemeColor,
                        width: "100%",
                        alignItems: "center",
                      },
                    ]}
                    onPress={saveQuickTag}
                  >
                    <Text style={styles.saveBtnText}>保存する</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </KeyboardAvoidingView>
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

  simpleMainWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    backgroundColor: "#FFF",
  },
  simpleDragBar: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E5EA",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  simpleHeroInput: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1C1E",
    marginVertical: 20,
    padding: 0, // 余計な余白をカット
  },
  simpleDateTimeCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  timePickerGroup: {
    flexDirection: "row",
    flex: 1,
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap", // 小さい画面でもはみ出さないように
  },
  timeDivider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginLeft: 32,
  },
  simpleActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  simpleOptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFF",
  },
  simpleOptBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8E8E93",
  },
  simpleAmountSection: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    backgroundColor: "#FFF9E6",
    padding: 15,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFCC0040",
  },
  amountSymbol: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFCC00",
    marginRight: 8,
  },
  simpleHeroAmountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
    color: "#1C1C1E",
  },
  miniCategoryScroll: {
    width: "100%",
    marginTop: 12,
  },
  miniChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFF",
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#FFCC0040",
  },
  miniChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFCC00",
  },
  simpleBottomActions: {
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    marginTop: 10,
  },
  simpleDetailLink: {
    padding: 10,
  },
  simpleDetailLinkText: {
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  simpleLargeSaveBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  simpleLargeSaveBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "800",
  },
  timeLabelContainer: {
    width: 44, // 🌟 ここの幅を固定することで、上下のピッカーの位置が綺麗に揃います
    alignItems: "flex-start",
  },
  timeLabelText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#8E8E93",
  },

  // --- カテゴリ選択エリア用 ---
  simpleCategorySection: {
    marginBottom: 20,
  },
  simpleCategoryTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#8E8E93",
    marginBottom: 8,
    marginLeft: 4,
  },
  simpleCategoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFF",
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
  },
  simpleCategoryChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8E8E93",
  },
});
