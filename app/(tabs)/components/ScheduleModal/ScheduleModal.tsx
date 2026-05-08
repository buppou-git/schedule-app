import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// 🌟 通知の脳みそをインポート
import { useNotificationManager } from "../../../../hooks/useNotificationManager";
import { ScheduleItem, SubTask } from "../../../../types";
import { PRESET_COLORS } from "../../../../utils/helpers";

import { exportToStandardCalendar } from "../../../../hooks/useCalendarExport";

import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebaseConfig";

import { ModernDatePicker, formatTime } from "./ModernDatePicker";
import { RepeatSection } from "./RepeatSection";
import { styles } from "./ScheduleModal.styles";
import { TagSection } from "./TagSection";
import { TimeSection } from "./TimeSection";

import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
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
  // =========================================================
  // 🌟 改善：バラバラだった入力用Stateを1つの「formData」に統合！
  // =========================================================
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    isEvent: true,
    isTodo: false,
    isExpense: false,
    tag: "",
    tagColor: "#007AFF",
    category: "食費",
    isAllDay: true,
    repeatType: "none" as "none" | "daily" | "weekly" | "monthly" | "custom",
    repeatDays: [] as number[],
    repeatInterval: 1,
    startDate: new Date(),
    endDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
  });

  // 🌟 関数自体をメモ化して、子コンポーネントの無駄な再描画を防ぐ
  const updateForm = useCallback((updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // =========================================================
  // 🌟 特殊な処理が必要なStateやUI管理用のStateは独立して残す
  // =========================================================
  const [isReady, setIsReady] = useState(false);
  const isInitialized = useRef(false);
  const [selectedLayer, setSelectedLayer] = useState("");
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [newTagColor, setNewTagColor] = useState("");
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
      formData.category ===
      quickMainTags[editingLayerForQuick]?.[editingTagIndex]
    ) {
      updateForm({ category: tempQuickTagText.trim() });
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
      if (formData.tag === editingSubTagOriginalName)
        updateForm({ tag: trimmed });
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
            if (formData.tag === editingSubTagOriginalName)
              updateForm({ tag: "" });
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

  useEffect(() => {
    // 画面が閉じている時はリセット
    if (!visible) {
      setIsReady(false);
      isInitialized.current = false;
      setIsSimpleMode(true); // 🌟 これを追加！閉じるたびに確実に簡易画面に戻す
      return;
    }

    if (isInitialized.current) return;

    // 🌟 InteractionManager を使って、アニメーション終了後に中身を描画する
    const task = InteractionManager.runAfterInteractions(() => {
      const layers = Object.keys(layerMaster);
      const def = layers.length > 0 ? layers[0] : "生活";

      if (selectedItem) {
        // 🌟 先に時間のパース（変換）だけやっておく
        const parsedStartTime = new Date();
        if (selectedItem.startTime) {
          const [h, m] = selectedItem.startTime.split(":").map(Number);
          parsedStartTime.setHours(h, m, 0, 0);
        }
        const parsedEndTime = new Date();
        if (selectedItem.endTime) {
          const [h, m] = selectedItem.endTime.split(":").map(Number);
          parsedEndTime.setHours(h, m, 0, 0);
        }

        // 🌟 1撃で15個の値をセット！
        updateForm({
          title: selectedItem.title || "",
          amount: selectedItem.amount > 0 ? selectedItem.amount.toString() : "",
          isEvent: selectedItem.isEvent ?? true,
          isTodo: selectedItem.isTodo ?? false,
          isExpense: selectedItem.isExpense ?? false,
          tag: selectedItem.tag || "",
          tagColor: selectedItem.color || "#007AFF",
          category: selectedItem.category || "食費",
          isAllDay: selectedItem.isAllDay ?? true,
          repeatType: selectedItem.repeatType || "none",
          repeatDays: selectedItem.repeatDays || [],
          repeatInterval: selectedItem.repeatInterval || 1,
          startDate: new Date(selectedItem.startDate || selectedDate),
          endDate: new Date(selectedItem.endDate || selectedDate),
          startTime: parsedStartTime,
          endTime: parsedEndTime,
        });

        // 👇 formData 以外の「独立したState」を初期化
        const savedLayer =
          tagMaster?.[selectedItem.tag || ""]?.layer ||
          (layerMaster[selectedItem.tag || ""] ? selectedItem.tag : def);
        setSelectedLayer(savedLayer || def);

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
        setNewTagColor("");

        // 🌟 復活：サブタスクとスナップショットの処理！
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
        // ==========================================
        // 🌟 新規作成時（elseの中身）も一撃でリセット！
        // ==========================================
        updateForm({
          title: "",
          amount: "",
          isEvent: activeMode === "calendar",
          isTodo: activeMode === "todo",
          isExpense: activeMode === "money",
          tag: "",
          tagColor: layerMaster[def] || "#007AFF",
          category: "食費",
          isAllDay: true,
          repeatType: "none",
          repeatDays: [],
          repeatInterval: 1,
          startDate: new Date(selectedDate),
          endDate: new Date(selectedDate),
          startTime: new Date(),
          endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
        });

        // 👇 残りの特殊な子たちを初期化
        setSelectedLayer(def);
        setSelectedReminders([]);
        setCustomReminderTimes([]);
        setNewTagColor("");
        setSubTasks([]);
        setShowSubTasks(false);
      }
      setIsCreatingNewTag(false);

      isInitialized.current = true;
      setIsReady(true); // 🌟 ここで「準備完了」の合図を出す
    });

    // 🌟 task (InteractionManager) の後始末
    return () => task.cancel();
    // 🌟 改善3: 激重の原因だった layerMaster と tagMaster を監視対象から外す！
  }, [visible, selectedItem, activeMode, selectedDate]);

  const toHiragana = (str: string) =>
    str
      .replace(/[\u30a1-\u30f6]/g, (m) =>
        String.fromCharCode(m.charCodeAt(0) - 0x60),
      )
      .toLowerCase();

  // 🌟 改善1: 全予定の読み込みは「モーダルを開いた時（visibleがtrueになった時）」の1回だけに制限！
  const allTitles = useMemo(() => {
    if (!visible) return [];
    const titles = new Set<string>();
    const allItems = Object.values(scheduleData).flat() as ScheduleItem[];
    const recentItems = allItems.slice(-150);

    recentItems.forEach((i) => {
      if (i.title) titles.add(i.title);
    });
    return Array.from(titles);
  }, [scheduleData, visible]); // 👈 inputText を依存から外した（超重要）

  // 🌟 改善2: 文字を打つたびに走るのは、抽出済みの allTitles からの「絞り込み」だけ！
  const suggestions = useMemo(() => {
    const s = formData.title.trim();
    if (!s || !isReady) return [];
    const r = toHiragana(s);
    return allTitles
      .filter(
        (t) => (readingMaster[t] || toHiragana(t)).startsWith(r) && t !== s,
      )
      .slice(0, 5);
  }, [formData.title, allTitles, readingMaster, isReady]);

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
    if (!formData.title)
      return Alert.alert("エラー", "タイトルを入力してください");

    if (selectedItem) {
      const currentSnapshot = JSON.stringify({
        title: formData.title,
        amount: parseInt(formData.amount) || 0,
        isEvent: formData.isEvent,
        isTodo: formData.isTodo,
        isExpense: formData.isExpense,
        tag: formData.tag.trim(),
        category: formData.category,
        isAllDay: formData.isAllDay,
        startDate: formData.startDate.toISOString().split("T")[0],
        endDate: formData.endDate.toISOString().split("T")[0],
        startTime: formData.isAllDay ? "" : formatTime(formData.startTime),
        endTime: formData.isAllDay ? "" : formatTime(formData.endTime),
        repeatType: formData.repeatType,
        repeatDays: formData.repeatDays,
        repeatInterval: formData.repeatInterval,
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
    if (!formData.title)
      return Alert.alert("エラー", "タイトルを入力してください");
    const r = {
      ...readingMaster,
      [formData.title.trim()]: toHiragana(formData.title.trim()),
    };
    setReadingMaster(r);
    AsyncStorage.setItem("readingMasterData", JSON.stringify(r));

    const finalTag = formData.tag.trim() || selectedLayer;

    let finalColor = uiThemeColor;
    if (formData.tag.trim()) {
      const existingTag = tagMaster[formData.tag.trim()];
      if (existingTag) {
        finalColor = existingTag.color;
      } else {
        finalColor = newTagColor || uiThemeColor;
        const m = {
          ...tagMaster,
          [formData.tag.trim()]: { layer: selectedLayer, color: finalColor },
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
        let triggerDate = new Date(formData.startDate);
        if (formData.isAllDay) {
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
            formData.startTime.getHours(),
            formData.startTime.getMinutes(),
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
          const id = await scheduleItemNotification(
            formData.title,
            triggerDate,
          );
          if (id) finalNotificationIds.push(id);
        }
      }

      if (selectedReminders.includes("custom")) {
        for (const customTime of customReminderTimes) {
          if (customTime > new Date()) {
            const id = await scheduleItemNotification(
              formData.title,
              customTime,
            );
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

    const pureTodos = updatedSubTasks.filter(
      (t) => !t.isExpense && !t.isIncome,
    );
    const allDone = pureTodos.length > 0 && pureTodos.every((t) => t.isDone);

    const newData = { ...scheduleData };
    const sStr = formData.startDate.toISOString().split("T")[0];
    const itemData = {
      title: formData.title,
      tag: finalTag,
      tags: [finalTag],
      amount: parseInt(formData.amount) || 0,
      isEvent: formData.isEvent,
      isTodo: formData.isTodo,
      isExpense: formData.isExpense,
      isDone: allDone ? true : selectedItem ? selectedItem.isDone : false,
      color: finalColor,
      category: formData.isExpense ? formData.category : undefined,
      repeatType:
        formData.repeatType !== "none" ? formData.repeatType : undefined,
      repeatDays:
        formData.repeatType === "custom" ? formData.repeatDays : undefined,
      repeatInterval:
        formData.repeatType === "custom" ? formData.repeatInterval : undefined,
      isAllDay: formData.isAllDay,
      startDate: sStr,
      endDate: formData.endDate.toISOString().split("T")[0],
      startTime: formData.isAllDay ? undefined : formatTime(formData.startTime),
      endTime: formData.isAllDay ? undefined : formatTime(formData.endTime),
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
        if (!newData[sStr]) newData[sStr] = [];
        newData[sStr].push({
          id: Date.now().toString(),
          ...itemData,
        });
      }
    }

    const startForExport = formData.isAllDay
      ? formData.startDate
      : new Date(
          formData.startDate.getFullYear(),
          formData.startDate.getMonth(),
          formData.startDate.getDate(),
          formData.startTime.getHours(),
          formData.startTime.getMinutes(),
        );
    const endForExport = formData.isAllDay
      ? formData.endDate
      : new Date(
          formData.endDate.getFullYear(),
          formData.endDate.getMonth(),
          formData.endDate.getDate(),
          formData.endTime.getHours(),
          formData.endTime.getMinutes(),
        );

    const returnedId = await exportToStandardCalendar(
      formData.title,
      startForExport,
      endForExport,
      formData.isAllDay,
      selectedItem?.externalEventId,
    );

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
      } catch (e) {}
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
        {/* 🌟 部品①：時間設定 */}
        <TimeSection
          isAllDay={formData.isAllDay}
          startDate={formData.startDate}
          startTime={formData.startTime}
          endDate={formData.endDate}
          endTime={formData.endTime}
          uiThemeColor={uiThemeColor}
          updateForm={updateForm}
        />

        {/* 🌟 部品②：繰り返し設定 */}
        <RepeatSection
          repeatType={formData.repeatType}
          repeatDays={formData.repeatDays}
          repeatInterval={formData.repeatInterval}
          uiThemeColor={uiThemeColor}
          updateForm={updateForm}
        />

        {/* 🌟 部品③：カテゴリとタグ */}
        <TagSection
          selectedLayer={selectedLayer}
          setSelectedLayer={setSelectedLayer}
          layerMaster={layerMaster}
          tagMaster={tagMaster}
          formDataTag={formData.tag}
          uiThemeColor={uiThemeColor}
          updateForm={updateForm}
          isCreatingNewTag={isCreatingNewTag}
          setIsCreatingNewTag={setIsCreatingNewTag}
          newTagColor={newTagColor}
          setNewTagColor={setNewTagColor}
          handleLongPressSubTag={handleLongPressSubTag}
        />
      </View>
    );
  }, [
    isReady,
    // 👇 ここから下は、部品の「どれかの値」が変わった時だけ再計算するルールです
    formData.isAllDay,
    formData.startDate,
    formData.startTime,
    formData.endDate,
    formData.endTime,
    formData.repeatType,
    formData.repeatDays,
    formData.repeatInterval,
    formData.tag,
    uiThemeColor,
    layerMaster,
    selectedLayer,
    tagMaster,
    isCreatingNewTag,
    newTagColor,
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
                  updateForm({ isTodo: true }); // 🌟 旧: setIsTodo(true)
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
                  updateForm({ isExpense: true }); // 🌟 旧: setIsExpense(true)
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
    formData.category, // 🌟 旧: selectedCategory
    selectedDate,
    currentQuickTags,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View
              style={[
                styles.modalContent,
                {
                  borderTopWidth: 8,
                  borderTopColor: uiThemeColor,
                  maxHeight: "85%",
                  height: undefined,
                },
              ]}
            >
              {isSimpleMode ? (
                // ==========================================
                // 🟢 【大幅改善】新・簡易追加画面
                // ==========================================
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.simpleMainWrapper}>
                      {/* 1. ドラッグバー */}
                      <View style={styles.simpleDragBar} />

                      {/* 2. タイトル入力（大部分を占める大きな入力欄） */}
                      <TextInput
                        style={styles.simpleHeroInput}
                        placeholder="予定のタイトルを入力"
                        placeholderTextColor="#C7C7CC"
                        autoFocus
                        value={formData.title} // 🌟
                        onChangeText={(t) => updateForm({ title: t })} // 🌟
                        multiline={false}
                      />

                      {/* 3. 日時・時間設定エリア（カード形式） */}
                      <View style={styles.simpleDateTimeCard}>
                        <View style={styles.timeRow}>
                          <View style={styles.timeLabelContainer}>
                            <Text
                              style={[
                                styles.timeLabelText,
                                { color: uiThemeColor },
                              ]}
                            >
                              開始
                            </Text>
                          </View>
                          <View style={styles.timePickerGroup}>
                            <ModernDatePicker
                              value={formData.startDate} // 🌟
                              mode="date"
                              onChange={(d) => updateForm({ startDate: d })} // 🌟
                              themeColor={uiThemeColor}
                            />
                            <ModernDatePicker
                              value={formData.startTime} // 🌟
                              mode="time"
                              onChange={(d) => updateForm({ startTime: d })} // 🌟
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
                              value={formData.endDate} // 🌟
                              mode="date"
                              onChange={(d) => updateForm({ endDate: d })} // 🌟
                              themeColor={uiThemeColor}
                            />
                            <ModernDatePicker
                              value={formData.endTime} // 🌟
                              mode="time"
                              onChange={(d) => updateForm({ endTime: d })} // 🌟
                              themeColor={uiThemeColor}
                            />
                          </View>
                        </View>
                      </View>

                      {/* 🌟 4. カテゴリ（レイヤー）選択エリア */}
                      <View style={styles.simpleCategorySection}>
                        <Text style={styles.simpleCategoryTitle}>カテゴリ</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{ width: "100%" }}
                        >
                          {Object.keys(tagMaster)
                            .filter(
                              (name) => name !== "祝日" && name !== "外部予定",
                            ) // 🌟 祝日は選択不要なので除外
                            .map((tagName) => {
                              // 🌟 タグの色を取得（設定がない場合はテーマカラー）
                              const tagInfo = tagMaster[tagName];
                              const tagColor = tagInfo?.color || uiThemeColor;

                              // 🌟 修正：変数名を `selectedLayer` に変更！
                              const isSelected = selectedLayer === tagName;

                              return (
                                <TouchableOpacity
                                  key={tagName}
                                  activeOpacity={0.7}
                                  style={[
                                    styles.simpleCategoryChip,
                                    { borderColor: tagColor + "40" },
                                    isSelected && {
                                      backgroundColor: tagColor,
                                      borderColor: tagColor,
                                    },
                                  ]}
                                  onPress={() => {
                                    Haptics.impactAsync(
                                      Haptics.ImpactFeedbackStyle.Light,
                                    );
                                    // 🌟 修正：正しく `setSelectedLayer` を呼び出す
                                    setSelectedLayer(tagName);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.simpleCategoryChipText,
                                      { color: tagColor },
                                      isSelected && { color: "#FFF" },
                                    ]}
                                  >
                                    {tagName}
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
                          style={[
                            styles.simpleOptBtn,
                            formData.isTodo && {
                              backgroundColor: "#34C759",
                              borderColor: "#34C759",
                            },
                          ]}
                          onPress={() =>
                            updateForm({ isTodo: !formData.isTodo })
                          } // 🌟
                        >
                          <Ionicons
                            name="checkbox"
                            size={22}
                            color={formData.isTodo ? "#FFF" : "#8E8E93"}
                          />
                          <Text
                            style={[
                              styles.simpleOptBtnText,
                              formData.isTodo && { color: "#FFF" },
                            ]}
                          >
                            ToDoに追加
                          </Text>
                        </TouchableOpacity>

                        {/* 金額入力切り替えボタン */}
                        <TouchableOpacity
                          style={[
                            styles.simpleOptBtn,
                            formData.isExpense && {
                              backgroundColor: "#FFCC00",
                              borderColor: "#FFCC00",
                            },
                          ]}
                          onPress={() =>
                            updateForm({ isExpense: !formData.isExpense })
                          } // 🌟
                        >
                          <Ionicons
                            name="wallet"
                            size={22}
                            color={formData.isExpense ? "#FFF" : "#FFCC00"}
                          />
                          <Text
                            style={[
                              styles.simpleOptBtnText,
                              formData.isExpense && { color: "#FFF" },
                            ]}
                          >
                            支出を記録
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* 5. 条件付き金額入力エリア（支出ONの時だけふわっと出す） */}
                      {formData.isExpense && (
                        <View style={styles.simpleAmountSection}>
                          <Text style={styles.amountSymbol}>¥</Text>
                          <TextInput
                            style={styles.simpleHeroAmountInput}
                            placeholder="0"
                            placeholderTextColor="#C7C7CC"
                            keyboardType="numeric"
                            value={formData.amount} // 🌟
                            onChangeText={(t) => updateForm({ amount: t })} // 🌟
                          />
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.miniCategoryScroll}
                          >
                            {[
                              "食費",
                              "日用品",
                              "交通費",
                              "交際費",
                              "趣味",
                              "固定費",
                            ].map((cat) => (
                              <TouchableOpacity
                                key={cat}
                                style={[
                                  styles.miniChip,
                                  formData.category === cat && {
                                    // 🌟
                                    backgroundColor: "#FFCC00",
                                  },
                                ]}
                                onPress={() => updateForm({ category: cat })} // 🌟
                              >
                                <Text
                                  style={[
                                    styles.miniChipText,
                                    formData.category === cat && {
                                      // 🌟
                                      color: "#FFF",
                                    },
                                  ]}
                                >
                                  {cat}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {/* 6. 下部アクション */}
                      <View style={styles.simpleBottomActions}>
                        <TouchableOpacity
                          style={styles.simpleDetailLink}
                          onPress={() => setIsSimpleMode(false)}
                        >
                          <Text
                            style={[
                              styles.simpleDetailLinkText,
                              { color: uiThemeColor },
                            ]}
                          >
                            詳細設定を表示
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.simpleLargeSaveBtn,
                            { backgroundColor: uiThemeColor },
                          ]}
                          onPress={handleSavePress}
                        >
                          <Text style={styles.simpleLargeSaveBtnText}>
                            保存して閉じる
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableWithoutFeedback>
                </ScrollView>
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
                        <Text
                          style={[styles.modalTitle, { color: uiThemeColor }]}
                        >
                          {selectedItem ? "予定を編集" : "新規作成"}
                        </Text>
                        <Text style={styles.dateBadge}>{selectedDate}</Text>
                      </View>
                      <TextInput
                        style={styles.mainInput}
                        placeholder="予定のタイトル"
                        placeholderTextColor="#AEAEB2"
                        value={formData.title} // 🌟
                        onChangeText={(t) => updateForm({ title: t })} // 🌟
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
                                onPress={() => updateForm({ title: s })} // 🌟
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

                            {(formData.isAllDay // 🌟
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
                                        return prev.filter(
                                          (v) => v !== opt.value,
                                        );
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
                            value={formData.isEvent} // 🌟
                            onValueChange={(v) => updateForm({ isEvent: v })} // 🌟
                            trackColor={{
                              false: "#C7C7CC",
                              true: uiThemeColor,
                            }}
                            ios_backgroundColor="#E5E5EA"
                          />
                        </View>
                        <View style={styles.switchRow}>
                          <Text style={styles.switchLabel}>
                            ToDoリストに表示
                          </Text>
                          <Switch
                            value={formData.isTodo} // 🌟
                            onValueChange={(v) => updateForm({ isTodo: v })} // 🌟
                            trackColor={{
                              false: "#C7C7CC",
                              true: uiThemeColor,
                            }}
                            ios_backgroundColor="#E5E5EA"
                          />
                        </View>
                        <View style={styles.switchRow}>
                          <Text style={styles.switchLabel}>支出を記録</Text>
                          <Switch
                            value={formData.isExpense} // 🌟
                            onValueChange={(v) => updateForm({ isExpense: v })} // 🌟
                            trackColor={{
                              false: "#C7C7CC",
                              true: uiThemeColor,
                            }}
                            ios_backgroundColor="#E5E5EA"
                          />
                        </View>

                        {formData.isExpense && ( // 🌟
                          <View>
                            <TextInput
                              style={styles.input}
                              placeholder="金額 (¥)"
                              placeholderTextColor="#AEAEB2"
                              keyboardType="numeric"
                              value={formData.amount} // 🌟
                              onChangeText={(t) => updateForm({ amount: t })} // 🌟
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
                                    formData.category === cat && {
                                      // 🌟
                                      backgroundColor: uiThemeColor,
                                    },
                                  ]}
                                  onPress={() => updateForm({ category: cat })} // 🌟
                                >
                                  <Text
                                    style={[
                                      styles.layerChipText,
                                      formData.category === cat && {
                                        // 🌟
                                        color: "#fff",
                                      },
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
