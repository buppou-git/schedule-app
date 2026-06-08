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

import { deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../../../../firebaseConfig";

import { ModernDatePicker, formatTime } from "./ModernDatePicker";
import { RepeatSection } from "./RepeatSection";
import { RepeatSettingsModal } from "./RepeatSettingsModal";
import { styles } from "./ScheduleModal.styles";
import { SubTaskSection } from "./SubTaskSection";
import { TagSection } from "./TagSection";
import { TimeSection } from "./TimeSection";

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
  View,
} from "react-native";

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
  selectedItem: ScheduleItem | null;
  activeMode: string;
  scheduleData: { [date: string]: ScheduleItem[] };
  setScheduleData: React.Dispatch<
    React.SetStateAction<{ [key: string]: ScheduleItem[] }>
  >;
  layerMaster?: { [key: string]: string };
  tagMaster?: { [key: string]: { layer: string; color: string } };
  setTagMaster?: (data: {
    [key: string]: { layer: string; color: string };
  }) => void;
  onForceRender?: () => void;
  isExternalSyncEnabled?: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
  sharedRooms?: { [layerName: string]: string };
  safeDebouncedSync?: (item: ScheduleItem, date: string) => void;
  setDebugMessage?: (msg: string) => void;
}

const ScheduleModal = ({
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
  sharedRooms = {},
  onForceRender,
  safeDebouncedSync,
  setDebugMessage,
}: ScheduleModalProps) => {
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
    repeatEndDate: null as Date | null,
    startDate: new Date(),
    endDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
  });

  // 🌟 関数自体をメモ化して、子コンポーネントの無駄な再描画を防ぐ
  const updateForm = useCallback((updates: Partial<typeof formData>) => {
    setFormData((prev) => {
      let next = { ...prev, ...updates };

      // 🌟🌟🌟 限界突破：日時が逆転しない＆自動連動する最強の補正システム！ 🌟🌟🌟
      const normalizeDate = (d: Date) => {
        const nd = new Date(d);
        nd.setHours(0, 0, 0, 0);
        return nd;
      };

      const startDay = normalizeDate(next.startDate);
      const endDay = normalizeDate(next.endDate);

      // ① 終日モードの場合（日付のみの連動・補正）
      if (next.isAllDay) {
        if (updates.startDate) {
          // 開始日を変えたら、終了日も元の期間を保ってスライドさせる
          const oldStartDay = normalizeDate(prev.startDate);
          const oldEndDay = normalizeDate(prev.endDate);
          const dayDiff = oldEndDay.getTime() - oldStartDay.getTime();
          next.endDate = new Date(startDay.getTime() + Math.max(0, dayDiff));
        } else if (startDay.getTime() > endDay.getTime()) {
          // 終了日を過去に戻して逆転した場合の補正
          next.startDate = new Date(next.endDate);
        }
      }
      // ② 終日オフ（時間指定あり）の場合（時間を含めた連動・補正）
      else {
        const createDateTime = (d: Date, t: Date) => {
          const dt = new Date(d);
          dt.setHours(t.getHours(), t.getMinutes(), 0, 0);
          return dt;
        };

        const oldStartDT = createDateTime(prev.startDate, prev.startTime);
        const oldEndDT = createDateTime(prev.endDate, prev.endTime);

        // 🌟 元の予定の長さ（ミリ秒）を記憶しておく。最低でも1時間（60*60*1000）を保証！
        const duration = Math.max(
          oldEndDT.getTime() - oldStartDT.getTime(),
          60 * 60 * 1000,
        );

        const startDT = createDateTime(next.startDate, next.startTime);
        const endDT = createDateTime(next.endDate, next.endTime);

        if (updates.startDate || updates.startTime) {
          // 🌟 ここがご要望の機能！
          // 開始日時を変えたら、終了日時も自動で「1時間後（または変更前の長さ）」にスライドする！
          const newEndDT = new Date(startDT.getTime() + duration);
          next.endDate = new Date(newEndDT);
          next.endTime = new Date(newEndDT);
        } else if (startDT.getTime() > endDT.getTime()) {
          // 終了日時を過去に戻して逆転した場合、開始日時を「終了日時 - 元の長さ」に押し下げる！
          const newStartDT = new Date(endDT.getTime() - duration);
          next.startDate = new Date(newStartDT);
          next.startTime = new Date(newStartDT);
        }
      }

      return next;
    });
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
    } else {
      // 🌟 魔法の追加3：「名前」はそのままに「色」だけ変えた場合も確実に保存する！
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

  const uiThemeColor = useMemo(() => {
    const selectedTag = formData.tag.trim();
    if (selectedTag && tagMaster[selectedTag]) {
      return tagMaster[selectedTag].color;
    }
    return layerMaster[selectedLayer] || "#007AFF";
  }, [formData.tag, selectedLayer, layerMaster, tagMaster]);

  // 🌟 追加：保存処理中かどうかを判定するフラグ
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  // 🌟 追加：簡易モードの判定フラグ
  const [isSimpleMode, setIsSimpleMode] = useState(true);

  const [repeatSettingsVisible, setRepeatSettingsVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setIsReady(false);
      isInitialized.current = false;
      setIsSimpleMode(true);
      return;
    }

    if (isInitialized.current) return;

    setTimeout(() => {
      // 🌟 限界突破：10個のバラバラの更新を「1回」に束ねる最強の魔法！
      // これにより、開く瞬間の「10連続フリーズ」が消滅します！
      const layers = Object.keys(layerMaster);
      const def = layers.length > 0 ? layers[0] : "生活";

      if (selectedItem) {
        setIsSimpleMode(false);
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

          repeatEndDate: selectedItem.repeatEndDate
            ? new Date(selectedItem.repeatEndDate)
            : null,

          startDate: new Date(selectedItem.startDate || selectedDate),
          endDate: new Date(selectedItem.endDate || selectedDate),
          startTime: parsedStartTime,
          endTime: parsedEndTime,
        });

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

        const savedSubTasks = selectedItem.subTasks || [];
        setSubTasks(savedSubTasks);
        setShowSubTasks(savedSubTasks.length > 0);

        setInitialSnapshot(
          JSON.stringify({
            title: selectedItem.title || "",
            amount: parseInt(selectedItem.amount?.toString() || "0"),
            isTodo: selectedItem.isTodo ?? false,
            repeatType: selectedItem.repeatType || "none",
            repeatDays: selectedItem.repeatDays || [],
            repeatInterval: selectedItem.repeatInterval || 1,
            repeatEndDate: selectedItem.repeatEndDate || null,
            subTasksData: savedSubTasks
              .map((t: SubTask) => `${t.title}_${t.isDone}`)
              .join(","),
          }),
        );
      } else {
        setIsSimpleMode(true);
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
          repeatEndDate: null,
          startDate: new Date(selectedDate),
          endDate: new Date(selectedDate),
          startTime: new Date(),
          endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
        });

        setSelectedLayer(def);
        setSelectedReminders([]);
        setCustomReminderTimes([]);
        setNewTagColor("");
        setSubTasks([]);
        setShowSubTasks(false);
      }
      setIsCreatingNewTag(false);

      isInitialized.current = true;
      setIsReady(true);
    }, 10);
  }, [visible, selectedItem, activeMode, selectedDate, layerMaster]);

  const toHiragana = (str: string) =>
    str
      .replace(/[\u30a1-\u30f6]/g, (m) =>
        String.fromCharCode(m.charCodeAt(0) - 0x60),
      )
      .toLowerCase();

  // =========================================================
  // 🌟 究極の爆速化1：起動時の数秒フリーズの元凶「150件の予定スキャン」を裏側へ！
  // =========================================================
  const [allTitles, setAllTitles] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!visible || !isReady) return;
    // 🌟 限界突破：画面の展開アニメーションが終わるのを待ってから、0.4秒後にコッソリ計算を始める
    const timer = setTimeout(() => {
      const titles = new Set<string>();
      const dateKeys = Object.keys(scheduleData).sort();
      let count = 0;
      for (let i = dateKeys.length - 1; i >= 0; i--) {
        const items = scheduleData[dateKeys[i]] || [];
        for (let j = items.length - 1; j >= 0; j--) {
          const title = items[j].title;
          if (title) titles.add(title);
          count++;
          if (count >= 150) break;
        }
        if (count >= 150) break;
      }
      setAllTitles(Array.from(titles));
    }, 400);
    return () => clearTimeout(timer);
  }, [visible, isReady, scheduleData]);

  // 🌟 サジェスト生成も useEffect で行い、文字入力のモッサリを完全に排除！
  useEffect(() => {
    const s = formData.title.trim();
    if (!s || !isReady || allTitles.length === 0) {
      setSuggestions([]);
      return;
    }
    const r = toHiragana(s);
    const filtered = allTitles
      .filter(
        (t) => (readingMaster[t] || toHiragana(t)).startsWith(r) && t !== s,
      )
      .slice(0, 5);
    setSuggestions(filtered);
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
        repeatEndDate: formData.repeatEndDate
          ? formData.repeatEndDate.toISOString().split("T")[0]
          : null,
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
    // 🌟 1. 保存中なら処理をブロック
    if (isSaving || isSavingRef.current) return;

    if (!formData.title)
      return Alert.alert("エラー", "タイトルを入力してください");

    isSavingRef.current = true;
    setIsSaving(true);

    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      const r = {
        ...readingMaster,
        [formData.title.trim()]: toHiragana(formData.title.trim()),
      };
      setReadingMaster(r);
      AsyncStorage.setItem("readingMasterData", JSON.stringify(r));

      const finalTag = formData.tag.trim() || selectedLayer;
      let finalColor = uiThemeColor;

      // 🌟🌟🌟 これが「大学カテゴリーで消える」バグを完全に粉砕する修正！ 🌟🌟🌟
      const m = { ...tagMaster };
      let tagMasterChanged = false;

      // 1. サブタグが入力された場合
      if (formData.tag.trim()) {
        const existingTag = tagMaster[formData.tag.trim()];
        if (existingTag) {
          finalColor = existingTag.color;
        } else {
          finalColor = newTagColor || uiThemeColor;
          m[formData.tag.trim()] = { layer: selectedLayer, color: finalColor };
          tagMasterChanged = true;
        }
      }

      // 2. 🌟 親レイヤー（大学など）自体もタグとして強制登録！
      // これが無いと、サブタグなしで保存した時にフィルター機能が「所属不明」と勘違いして隠してしまいます。
      if (!m[selectedLayer]) {
        m[selectedLayer] = {
          layer: selectedLayer,
          color: layerMaster[selectedLayer] || uiThemeColor,
        };
        tagMasterChanged = true;
      }

      if (tagMasterChanged) {
        setTagMaster?.(m);
        AsyncStorage.setItem("tagMasterData", JSON.stringify(m));
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

      // 🌟 通知デザインの決定（カテゴリ名：タイトル）
      const displayCategory = formData.tag.trim() || selectedLayer;
      const notifTitle = `⏰ ${displayCategory}：${formData.title}`;

      const timeString = formData.isAllDay
        ? "終日"
        : `${formData.startTime.getHours().toString().padStart(2, "0")}:${formData.startTime.getMinutes().toString().padStart(2, "0")}〜`;

      if (selectedReminders.length > 0) {
        for (const option of selectedReminders) {
          if (option === "custom") continue;
          let triggerDate = new Date(formData.startDate);
          let bodyPrefix = "予定のお時間です";

          if (formData.isAllDay) {
            if (option === "morning") {
              triggerDate.setHours(7, 0, 0, 0);
              bodyPrefix = "本日";
            } else if (option === "dayBefore") {
              triggerDate.setDate(triggerDate.getDate() - 1);
              triggerDate.setHours(21, 0, 0, 0);
              bodyPrefix = "明日";
            } else if (option === "2daysBefore") {
              triggerDate.setDate(triggerDate.getDate() - 2);
              triggerDate.setHours(21, 0, 0, 0);
              bodyPrefix = "明後日";
            }
          } else {
            triggerDate.setHours(
              formData.startTime.getHours(),
              formData.startTime.getMinutes(),
              0,
              0,
            );
            if (option === "exact") {
              bodyPrefix = "時間になりました";
            } else if (option === "10min") {
              triggerDate.setMinutes(triggerDate.getMinutes() - 10);
              bodyPrefix = "10分前";
            } else if (option === "30min") {
              triggerDate.setMinutes(triggerDate.getMinutes() - 30);
              bodyPrefix = "30分前";
            } else if (option === "1hour") {
              triggerDate.setHours(triggerDate.getHours() - 1);
              bodyPrefix = "1時間前";
            } else if (option === "morning") {
              triggerDate.setHours(7, 0, 0, 0);
              bodyPrefix = "本日";
            } else if (option === "dayBefore") {
              triggerDate.setDate(triggerDate.getDate() - 1);
              triggerDate.setHours(21, 0, 0, 0);
              bodyPrefix = "明日";
            }
          }

          if (triggerDate > new Date()) {
            const id = await scheduleItemNotification(
              notifTitle, // 1行目
              `${bodyPrefix} ${timeString}`, // 2行目
              triggerDate,
            );
            if (id) finalNotificationIds.push(id);
          }
        }
      }

      // 🌟 ここがカスタム通知対応部分！（引数を3つに修正済み）
      if (selectedReminders.includes("custom")) {
        for (const customTime of customReminderTimes) {
          if (customTime > new Date()) {
            const id = await scheduleItemNotification(
              notifTitle, // 1行目
              `カスタム ${timeString}`, // 2行目（例：カスタム設定 14:00〜）
              customTime,
            );
            if (id) finalNotificationIds.push(id);
          }
        }
      }

      // 🌟 重複エラー回避：updatedSubTasks の宣言はここ「1つだけ」にする！
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
            let bodyPrefix = "時間になりました";

            if (task.reminderOption === "1hour") {
              triggerDate.setHours(triggerDate.getHours() - 1);
              bodyPrefix = "1時間前";
            } else if (task.reminderOption === "1day") {
              triggerDate.setDate(triggerDate.getDate() - 1);
              bodyPrefix = "明日";
            }

            if (triggerDate > new Date()) {
              const subTime = new Date(task.endTime);
              const subTimeString = `${subTime.getHours().toString().padStart(2, "0")}:${subTime.getMinutes().toString().padStart(2, "0")}〜`;
              const subNotifTitle = `⏰ ${formData.title}：${task.title}`;

              const id = await scheduleItemNotification(
                subNotifTitle, // 1行目
                `${bodyPrefix} ${subTimeString}`, // 2行目
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

      const sYear = formData.startDate.getFullYear();
      const sMonth = String(formData.startDate.getMonth() + 1).padStart(2, "0");
      const sDay = String(formData.startDate.getDate()).padStart(2, "0");
      const sStr = `${sYear}-${sMonth}-${sDay}`;

      const eYear = formData.endDate.getFullYear();
      const eMonth = String(formData.endDate.getMonth() + 1).padStart(2, "0");
      const eDay = String(formData.endDate.getDate()).padStart(2, "0");
      const eStr = `${eYear}-${eMonth}-${eDay}`;

      const itemData: Omit<ScheduleItem, "id"> = {
        title: formData.title,
        tag: finalTag,
        layer: selectedLayer, // 🌟 親レイヤーを明示
        // 🌟 【超重要】親と子が同じなら1つ、違うなら2つ並べるルールに完全統一！
        tags:
          finalTag === selectedLayer
            ? [selectedLayer]
            : [selectedLayer, finalTag],
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
          formData.repeatType === "custom"
            ? formData.repeatInterval
            : undefined,

        repeatEndDate:
          formData.repeatType !== "none" && formData.repeatEndDate
            ? formData.repeatEndDate.toISOString().split("T")[0]
            : undefined,

        isAllDay: formData.isAllDay,

        startDate: sStr,
        endDate: eStr,
        startTime: formData.isAllDay
          ? undefined
          : formatTime(formData.startTime),
        endTime: formData.isAllDay ? undefined : formatTime(formData.endTime),
        notificationIds: finalNotificationIds,
        reminderOptions: selectedReminders,
        customReminderTimes: customReminderTimes.map((d) => d.toISOString()),
        subTasks: updatedSubTasks,
        date: sStr,
      };

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

      const targetRoomId = sharedRooms[selectedLayer];
      const isShared = !!targetRoomId;
      // 🌟 変数の型を明示的に指定
      let finalReturnedId: string | undefined = selectedItem?.externalEventId;

      if (!isShared) {
        const returnedId = await exportToStandardCalendar(
          formData.title,
          startForExport,
          endForExport,
          formData.isAllDay,
          selectedItem?.externalEventId,
        );
        // 🌟 ?? undefined をつけることで、null が返ってきたら undefined に自動変換する！
        finalReturnedId = returnedId ?? undefined;
      }

      const newEventId = Date.now().toString();
      const targetDocId = selectedItem ? selectedItem.id : newEventId;

      const wasShared = selectedItem
        ? (selectedItem.tags || [selectedItem.tag || ""]).some((tag) =>
            Object.keys(sharedRooms).includes(tag),
          )
        : false;

      let hasCloudAction = false;
      const batch = writeBatch(db);

      // 🌟 修正②：古いカテゴリから移動した時の削除処理
      if (selectedItem && wasShared) {
        const oldLayer =
          selectedItem.sharedLayer ||
          (selectedItem.tags || [selectedItem.tag || ""]).find((tag) =>
            Object.keys(sharedRooms).includes(tag),
          );

        if (oldLayer && (!isShared || oldLayer !== selectedLayer)) {
          const oldRoomId = sharedRooms[oldLayer];
          if (oldRoomId) {
            batch.delete(
              doc(db, "rooms", oldRoomId, "schedules", selectedItem.id),
            );
            hasCloudAction = true;
          }
        }
      }

      // 🌟 修正③：エラーの元凶である「undefined」を JSON.parse で完全に消し去る
      const rawNewItem = {
        ...selectedItem,
        ...itemData,
        id: mode === "single" && selectedItem ? newEventId : targetDocId,
        repeatType: mode === "single" ? undefined : itemData.repeatType,
        linkedMasterId:
          mode === "single" && selectedItem ? selectedItem.id : undefined,
        externalEventId: finalReturnedId || selectedItem?.externalEventId,
        // 🌟 追加：翻訳システムのために、クラウドに「どの部屋のデータか」を刻み込む！
        sharedRoomId: isShared ? sharedRooms[selectedLayer] : undefined,
      };

      const newItem = JSON.parse(JSON.stringify(rawNewItem)) as ScheduleItem;

      const isSharedLayer = Object.keys(sharedRooms).includes(selectedLayer);

      // 🌟 共有レイヤーの場合、クラウドへ静かに同期する（アラートなし）
      if (isSharedLayer && safeDebouncedSync) {
        const fixedItem = {
          ...newItem,
          layer: selectedLayer,
          sharedLayer: selectedLayer,
          sharedRoomId: sharedRooms[selectedLayer],
          tags: newItem.tags,
        };
        safeDebouncedSync(fixedItem, sStr);
      }

      // 🌟 削除アクション（古い部屋からの移動時など）があった場合のみ commit
      if (hasCloudAction) {
        await batch.commit().catch((e) => console.error("共有削除エラー:", e));
      }

      setScheduleData((prevData: Record<string, ScheduleItem[]>) => {
        const nextData: Record<string, ScheduleItem[]> = {};
        Object.keys(prevData).forEach((key) => {
          nextData[key] = [...prevData[key]];
        });

        if (selectedItem) {
          if (mode === "single") {
            Object.keys(nextData).forEach((d) => {
              if (nextData[d].some((i) => i.id === selectedItem.id)) {
                nextData[d] = nextData[d].map((i) =>
                  i.id === selectedItem.id
                    ? {
                        ...i,
                        exceptionDates: [
                          ...(i.exceptionDates || []),
                          selectedDate,
                        ],
                      }
                    : i,
                );
              }
            });
          } else {
            Object.keys(nextData).forEach((d) => {
              if (nextData[d].some((i) => i.id === selectedItem.id)) {
                nextData[d] = nextData[d].filter(
                  (i) => i.id !== selectedItem.id,
                );
              }
            });
          }
        }

        // 🌟 修正③：エラーの元凶である「undefined」を JSON.parse(JSON.stringify()) で完全に消し去る魔法
        const rawNewItem = {
          ...selectedItem,
          ...itemData,
          id: mode === "single" && selectedItem ? newEventId : targetDocId,
          repeatType: mode === "single" ? undefined : itemData.repeatType,
          linkedMasterId:
            mode === "single" && selectedItem ? selectedItem.id : undefined,
          externalEventId: finalReturnedId || selectedItem?.externalEventId,
        };

        const newItem = JSON.parse(JSON.stringify(rawNewItem)) as ScheduleItem;

        if (!nextData[sStr]) {
          nextData[sStr] = [newItem];
        } else {
          nextData[sStr] = [
            ...nextData[sStr].filter((i) => i.id !== newItem.id),
            newItem,
          ];
        }

        return nextData;
      });

      setHasUnsavedChanges(true);
      onForceRender?.();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      console.error("Save Error:", error);
      Alert.alert("保存エラー", "予定の保存に失敗しました。");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleDeletePress = () => {
    if (selectedItem && selectedItem.repeatType) {
      Alert.alert("繰り返しの削除", "この予定をどのように削除しますか？", [
        { text: "この予定のみ", onPress: () => executeDelete("single") },
        { text: "これ以降すべて", onPress: () => executeDelete("following") },
        {
          text: "すべての繰り返し",
          onPress: () => executeDelete("all"),
          style: "destructive",
        },
        { text: "キャンセル", style: "cancel" },
      ]);
    } else {
      executeDelete("normal");
    }
  };

  const executeDelete = async (
    mode: "normal" | "all" | "single" | "following",
  ) => {
    if (!selectedItem) return;
    if (isSaving || isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSaving(true);

    // 🌟 UI更新のために1フレーム待つ
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      if (selectedItem.externalEventId) {
        try {
          await Calendar.deleteEventAsync(selectedItem.externalEventId);
        } catch (e) {}
      }

      const wasShared =
        selectedItem.tags?.some((tag) =>
          Object.keys(sharedRooms).includes(tag),
        ) || Object.keys(sharedRooms).includes(selectedItem.tag || "");

      // 🌟 今回追加：「これ以降すべて」を選んだ場合で、しかもそれが「一番最初の予定」だった場合は「全削除」扱いにする
      const isFullDelete =
        mode === "all" ||
        mode === "normal" ||
        (mode === "following" && selectedItem.startDate === selectedDate);

      if (isFullDelete) {
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
        if (wasShared) {
          const oldLayer =
            selectedItem.sharedLayer ||
            (selectedItem.tags || [selectedItem.tag || ""]).find((tag) =>
              Object.keys(sharedRooms).includes(tag),
            );

          const roomId = oldLayer ? sharedRooms[oldLayer] : null;
          if (roomId) {
            deleteDoc(
              doc(db, "rooms", roomId, "schedules", selectedItem.id),
            ).catch((e) => console.error("共有データ削除エラー:", e));
          }
        }
      } else if (mode === "following") {
        // 🌟 今回追加：「これ以降すべて」を選んだ場合、共有カレンダー上の「終了日（endDate）」を前日に書き換える！
        if (wasShared) {
          const targetDateObj = new Date(selectedDate);
          targetDateObj.setDate(targetDateObj.getDate() - 1);
          const newEndDate = `${targetDateObj.getFullYear()}-${("0" + (targetDateObj.getMonth() + 1)).slice(-2)}-${("0" + targetDateObj.getDate()).slice(-2)}`;

          const oldLayer =
            selectedItem.sharedLayer ||
            (selectedItem.tags || [selectedItem.tag || ""]).find((tag) =>
              Object.keys(sharedRooms).includes(tag),
            );

          const roomId = oldLayer ? sharedRooms[oldLayer] : null;
          if (roomId) {
            const { updateDoc } = await import("firebase/firestore");
            updateDoc(doc(db, "rooms", roomId, "schedules", selectedItem.id), {
              endDate: newEndDate,
              updatedAt: new Date().toISOString(),
            }).catch((e) => console.error("共有データ更新エラー:", e));
          }
        }
      }

      setScheduleData((prevData: Record<string, ScheduleItem[]>) => {
        const nextData: Record<string, ScheduleItem[]> = {};
        Object.keys(prevData).forEach((key) => {
          nextData[key] = [...prevData[key]];
        });

        if (mode === "single") {
          // 「今回のみ」：例外日リスト（exceptionDates）に追加してその日だけ非表示に
          Object.keys(nextData).forEach((d) => {
            if (nextData[d].some((i) => i.id === selectedItem.id)) {
              nextData[d] = nextData[d].map((i: ScheduleItem) => {
                if (i.id === selectedItem.id) {
                  return {
                    ...i,
                    exceptionDates: [...(i.exceptionDates || []), selectedDate],
                  };
                }
                return i;
              });
            }
          });
        } else if (mode === "following") {
          // 「これ以降すべて」：終了日（endDate）を選択された日の「前日」に書き換えてスパッと打ち切る！
          if (selectedItem.startDate === selectedDate) {
            Object.keys(nextData).forEach((d) => {
              if (nextData[d].some((i) => i.id === selectedItem.id)) {
                nextData[d] = nextData[d].filter(
                  (i: ScheduleItem) => i.id !== selectedItem.id,
                );
              }
            });
          } else {
            const targetDateObj = new Date(selectedDate);
            targetDateObj.setDate(targetDateObj.getDate() - 1);
            const newEndDate = `${targetDateObj.getFullYear()}-${("0" + (targetDateObj.getMonth() + 1)).slice(-2)}-${("0" + targetDateObj.getDate()).slice(-2)}`;

            Object.keys(nextData).forEach((d) => {
              if (nextData[d].some((i) => i.id === selectedItem.id)) {
                nextData[d] = nextData[d].map((i: ScheduleItem) => {
                  if (i.id === selectedItem.id) {
                    return { ...i, endDate: newEndDate };
                  }
                  return i;
                });
              }
            });
          }
        } else {
          // 「すべての繰り返し」：全削除
          Object.keys(nextData).forEach((d) => {
            if (nextData[d].some((i) => i.id === selectedItem.id)) {
              nextData[d] = nextData[d].filter(
                (i: ScheduleItem) => i.id !== selectedItem.id,
              );
            }
          });
        }
        return nextData;
      });

      setHasUnsavedChanges(true);
      onForceRender?.();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onClose();
    } catch (error: unknown) {
      console.error("Delete Error:", error);
      Alert.alert("削除エラー", "削除中に問題が発生しました。");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
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
          repeatEndDate={formData.repeatEndDate}
          uiThemeColor={uiThemeColor}
          onPress={() => setRepeatSettingsVisible(true)}
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
    formData.repeatEndDate,
    formData.tag,
    uiThemeColor,
    layerMaster,
    selectedLayer,
    tagMaster,
    isCreatingNewTag,
    newTagColor,
  ]);

  // =========================================================
  // 🌟 限界突破の最終兵器3：巨大なUIを「ブロック単位」で完全キャッシュ！
  // 通知や金額を操作した時に、関係ない部分のフリーズを100%シャットアウトします。
  // =========================================================

  // 🟦 詳細モード：通知ブロック
  const notificationsBlock = useMemo(() => {
    if (!isReady) return null;
    return (
      <View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <View
            style={{
              backgroundColor: uiThemeColor + "15",
              padding: 6,
              borderRadius: 8,
              marginRight: 10,
            }}
          >
            <Ionicons name="notifications" size={18} color={uiThemeColor} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#1C1C1E" }}>
            通知リマインダー
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingBottom: 16,
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

          {(formData.isAllDay
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
            const isSelected = selectedReminders.includes(opt.value);
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
                    backgroundColor: isSelected ? uiThemeColor : "#FFF",
                  },
                ]}
                onPress={() =>
                  setSelectedReminders((prev) => {
                    if (prev.includes(opt.value))
                      return prev.filter((v) => v !== opt.value);
                    if (
                      opt.value === "custom" &&
                      customReminderTimes.length === 0
                    )
                      setCustomReminderTimes([new Date()]);
                    return [...prev, opt.value];
                  })
                }
              >
                <Text
                  style={[
                    styles.layerChipText,
                    isSelected && { color: "#fff", fontWeight: "bold" },
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
              marginTop: 8,
              padding: 12,
              backgroundColor: uiThemeColor + "12",
              borderRadius: 12,
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
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
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
                      customReminderTimes.filter((_, i) => i !== idx),
                    )
                  }
                >
                  <Ionicons name="remove-circle" size={24} color="#FF3B30" />
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
                setCustomReminderTimes([...customReminderTimes, new Date()])
              }
            >
              <Ionicons name="add-circle" size={20} color={uiThemeColor} />
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
    );
  }, [
    isReady,
    uiThemeColor,
    selectedReminders,
    customReminderTimes,
    formData.isAllDay,
    formData.startDate,
    formData.startTime,
  ]);

  // 🟦 詳細モード：スイッチブロック
  const switchesBlock = useMemo(() => {
    if (!isReady) return null;
    return (
      <View style={{ paddingTop: 4 }}>
        <View style={styles.switchRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: uiThemeColor + "15",
                padding: 6,
                borderRadius: 8,
                marginRight: 10,
              }}
            >
              <Ionicons name="calendar" size={18} color={uiThemeColor} />
            </View>
            <Text
              style={{ fontSize: 15, fontWeight: "bold", color: "#1C1C1E" }}
            >
              予定として表示
            </Text>
          </View>
          <Switch
            value={formData.isEvent}
            onValueChange={(v) => updateForm({ isEvent: v })}
            trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
            ios_backgroundColor="#E5E5EA"
          />
        </View>
        <View style={styles.switchRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#34C75915",
                padding: 6,
                borderRadius: 8,
                marginRight: 10,
              }}
            >
              <Ionicons name="checkbox" size={18} color="#34C759" />
            </View>
            <Text
              style={{ fontSize: 15, fontWeight: "bold", color: "#1C1C1E" }}
            >
              ToDoリストに表示
            </Text>
          </View>
          <Switch
            value={formData.isTodo}
            onValueChange={(v) => updateForm({ isTodo: v })}
            trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
            ios_backgroundColor="#E5E5EA"
          />
        </View>
        <View style={styles.switchRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: "#FFCC0015",
                padding: 6,
                borderRadius: 8,
                marginRight: 10,
              }}
            >
              <Ionicons name="wallet" size={18} color="#FFCC00" />
            </View>
            <Text
              style={{ fontSize: 15, fontWeight: "bold", color: "#1C1C1E" }}
            >
              支出を記録
            </Text>
          </View>
          <Switch
            value={formData.isExpense}
            onValueChange={(v) => updateForm({ isExpense: v })}
            trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
            ios_backgroundColor="#E5E5EA"
          />
        </View>
      </View>
    );
  }, [
    isReady,
    uiThemeColor,
    formData.isEvent,
    formData.isTodo,
    formData.isExpense,
    updateForm,
  ]);

  // 🟦 詳細モード：支出ブロック
  const expenseBlock = useMemo(() => {
    if (!isReady || !formData.isExpense) return null;
    return (
      <View
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: "#E5E5EA",
        }}
      >
        <TextInput
          style={{
            backgroundColor: "#FFF",
            padding: 12,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: "bold",
            color: "#1C1C1E",
            borderWidth: 1,
            borderColor: "#E5E5EA",
          }}
          placeholder="金額 (¥)"
          placeholderTextColor="#AEAEB2"
          keyboardType="numeric"
          value={formData.amount}
          onChangeText={(t) => updateForm({ amount: t })}
        />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
          }}
        >
          {currentQuickTags.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.layerChip,
                {
                  borderWidth: 1,
                  borderColor: "#E5E5EA",
                  backgroundColor: "#FFF",
                },
                formData.category === cat && {
                  backgroundColor: uiThemeColor,
                  borderColor: uiThemeColor,
                },
              ]}
              onPress={() => updateForm({ category: cat })}
            >
              <Text
                style={[
                  styles.layerChipText,
                  formData.category === cat && {
                    color: "#fff",
                    fontWeight: "bold",
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }, [
    isReady,
    uiThemeColor,
    formData.isExpense,
    formData.amount,
    formData.category,
    currentQuickTags,
    updateForm,
  ]);

  // 🌟 optionsSection を再構築（仮想DOMのDiffを極限まで最適化）
  const optionsSection = (
    <View
      style={{
        backgroundColor: "#F8F8FA",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
      }}
    >
      {notificationsBlock}
      <View
        style={{ height: 1, backgroundColor: "#E5E5EA", marginVertical: 12 }}
      />
      {switchesBlock}
      {expenseBlock}
    </View>
  );

  // 🟩 簡易モード：日時ブロック
  const simpleTimeBlock = useMemo(() => {
    if (!isReady)
      return (
        <View
          style={{
            height: 300,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={uiThemeColor} />
        </View>
      );
    return (
      <View style={styles.simpleDateTimeCard}>
        {/* 🌟 終日トグルをここに追加！ */}
        <View style={[styles.switchRow, { marginBottom: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name="time"
              size={18}
              color={uiThemeColor}
              style={{ marginRight: 8 }}
            />
            <Text
              style={{ fontSize: 15, fontWeight: "bold", color: "#1C1C1E" }}
            >
              終日
            </Text>
          </View>
          <Switch
            value={formData.isAllDay}
            onValueChange={(v) => updateForm({ isAllDay: v })}
            trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
            ios_backgroundColor="#E5E5EA"
          />
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeLabelContainer}>
            <Text style={[styles.timeLabelText, { color: uiThemeColor }]}>
              開始
            </Text>
          </View>
          <View style={styles.timePickerGroup}>
            <ModernDatePicker
              value={formData.startDate}
              mode="date"
              onChange={(d) => updateForm({ startDate: d })}
              themeColor={uiThemeColor}
            />
            {/* 🌟 終日ONの時は、時間ピッカーを隠す！ */}
            {!formData.isAllDay && (
              <ModernDatePicker
                value={formData.startTime}
                mode="time"
                onChange={(d) => updateForm({ startTime: d })}
                themeColor={uiThemeColor}
              />
            )}
          </View>
        </View>
        <View style={styles.timeDivider} />
        <View style={styles.timeRow}>
          <View style={styles.timeLabelContainer}>
            <Text style={styles.timeLabelText}>終了</Text>
          </View>
          <View style={styles.timePickerGroup}>
            <ModernDatePicker
              value={formData.endDate}
              mode="date"
              onChange={(d) => updateForm({ endDate: d })}
              themeColor={uiThemeColor}
            />
            {/* 🌟 終日ONの時は、時間ピッカーを隠す！ */}
            {!formData.isAllDay && (
              <ModernDatePicker
                value={formData.endTime}
                mode="time"
                onChange={(d) => updateForm({ endTime: d })}
                themeColor={uiThemeColor}
              />
            )}
          </View>
        </View>
      </View>
    );
  }, [
    isReady,
    uiThemeColor,
    formData.startDate,
    formData.startTime,
    formData.endDate,
    formData.endTime,
    formData.isAllDay, // 🌟 終日フラグが切り替わった時にUIを再描画する
    updateForm,
  ]);

  // 🟩 簡易モード：カレンダーブロック
  const simpleLayerBlock = useMemo(() => {
    if (!isReady) return null;
    return (
      <View style={styles.simpleCategorySection}>
        <Text style={styles.simpleCategoryTitle}>カレンダー</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ width: "100%" }}
        >
          {Object.keys(layerMaster)
            .filter((name) => name !== "祝日" && name !== "外部予定")
            .map((layerName) => {
              const layerColor = layerMaster[layerName] || uiThemeColor;
              const isSelected = selectedLayer === layerName;
              return (
                <TouchableOpacity
                  key={layerName}
                  activeOpacity={0.7}
                  style={[
                    styles.simpleCategoryChip,
                    { borderColor: layerColor + "40" },
                    isSelected && {
                      backgroundColor: layerColor,
                      borderColor: layerColor,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedLayer(layerName);
                    updateForm({ tag: "" });
                    if (layerName === "家計簿") updateForm({ isExpense: true });
                  }}
                >
                  <Text
                    style={[
                      styles.simpleCategoryChipText,
                      { color: layerColor },
                      isSelected && { color: "#FFF" },
                    ]}
                  >
                    {layerName}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </View>
    );
  }, [isReady, uiThemeColor, layerMaster, selectedLayer, updateForm]);

  // 🟩 簡易モード：アクションブロック
  const simpleActionsBlock = useMemo(() => {
    if (!isReady) return null;
    return (
      <View style={styles.simpleActionRow}>
        <TouchableOpacity
          style={[
            styles.simpleOptBtn,
            formData.isTodo && {
              backgroundColor: "#34C759",
              borderColor: "#34C759",
            },
          ]}
          onPress={() => updateForm({ isTodo: !formData.isTodo })}
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
        <TouchableOpacity
          style={[
            styles.simpleOptBtn,
            formData.isExpense && {
              backgroundColor: "#FFCC00",
              borderColor: "#FFCC00",
            },
          ]}
          onPress={() => updateForm({ isExpense: !formData.isExpense })}
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
    );
  }, [isReady, formData.isTodo, formData.isExpense, updateForm]);

  // 🟩 簡易モード：支出ブロック
  const simpleExpenseBlock = useMemo(() => {
    if (!isReady || !formData.isExpense) return null;
    return (
      <View style={styles.simpleAmountSection}>
        <Text style={styles.amountSymbol}>¥</Text>
        <TextInput
          style={styles.simpleHeroAmountInput}
          placeholder="0"
          placeholderTextColor="#C7C7CC"
          keyboardType="numeric"
          value={formData.amount}
          onChangeText={(t) => updateForm({ amount: t })}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.miniCategoryScroll}
        >
          {["食費", "日用品", "交通費", "交際費", "趣味", "固定費"].map(
            (cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.miniChip,
                  formData.category === cat && { backgroundColor: "#FFCC00" },
                ]}
                onPress={() => updateForm({ category: cat })}
              >
                <Text
                  style={[
                    styles.miniChipText,
                    formData.category === cat && { color: "#FFF" },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </ScrollView>
      </View>
    );
  }, [
    isReady,
    uiThemeColor,
    formData.isExpense,
    formData.amount,
    formData.category,
    updateForm,
  ]);

  // 🌟 simpleModeOptions を再構築（仮想DOMのDiffを最適化）
  const simpleModeOptions = (
    <>
      {simpleTimeBlock}
      {simpleLayerBlock}
      {simpleActionsBlock}
      {simpleExpenseBlock}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* ======================= */}
        {/* 1. メインの予定追加モーダル */}
        {/* ======================= */}
        {/* 🌟 究極の修正：全体を覆う枠を View にする */}
        <View style={styles.modalOverlay}>
          {/* 🌟 最強の防波堤：画面の裏側に「全体サイズの透明な閉じるボタン」を敷く！ */}
          {/* これならタップが貫通しない上に、中身の邪魔を一切しません */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}
          />

          {/* 🌟 コンテンツ部分は Touchable 系のタグで一切囲まない！ */}
          {/* これで「ボタン押下後にスクロールがロックされる」React Nativeのバグが完全に消滅します！ */}
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
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <View style={styles.simpleMainWrapper}>
                  <View style={styles.simpleDragBar} />
                  <TextInput
                    style={styles.simpleHeroInput}
                    placeholder="予定のタイトルを入力"
                    placeholderTextColor="#C7C7CC"
                    autoFocus
                    value={formData.title}
                    onChangeText={(t) => updateForm({ title: t })}
                    multiline={false}
                  />
                  {simpleModeOptions}
                  <View style={styles.simpleBottomActions}>
                    <TouchableOpacity
                      style={styles.simpleDetailLink}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Keyboard.dismiss();
                        setTimeout(() => {
                          setIsSimpleMode(false);
                        }, 50);
                      }}
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
                      onPress={handleSavePress}
                      disabled={isSaving}
                      style={[
                        styles.saveBtn,
                        {
                          backgroundColor: isSaving ? "#C7C7CC" : uiThemeColor,
                        },
                      ]}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.saveBtnText}>保存して閉じる</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            ) : (
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
                    <View style={{ marginBottom: 20 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#8E8E93",
                          }}
                        >
                          {selectedItem ? "詳細を編集" : "新規作成 (詳細)"}
                        </Text>
                        <Text
                          style={[
                            styles.dateBadge,
                            {
                              backgroundColor: uiThemeColor + "15",
                              color: uiThemeColor,
                              fontWeight: "bold",
                              overflow: "hidden",
                            },
                          ]}
                        >
                          {selectedDate}
                        </Text>
                      </View>
                      <TextInput
                        style={{
                          fontSize: 26,
                          fontWeight: "800",
                          color: "#1C1C1E",
                          paddingVertical: 12,
                          borderBottomWidth: 1.5,
                          borderBottomColor: "#F2F2F7",
                        }}
                        placeholder="予定のタイトルを入力"
                        placeholderTextColor="#C7C7CC"
                        value={formData.title}
                        onChangeText={(t) => updateForm({ title: t })}
                      />
                    </View>

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
                              onPress={() => updateForm({ title: s })}
                            >
                              <Text style={styles.suggestionText}>{s}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {timeAndTagSection}
                    {optionsSection}

                    <View style={{ marginBottom: 20 }}>
                      <SubTaskSection
                        showSubTasks={showSubTasks}
                        setShowSubTasks={setShowSubTasks}
                        subTasks={subTasks}
                        setSubTasks={setSubTasks}
                        uiThemeColor={uiThemeColor}
                        selectedDate={selectedDate}
                        currentQuickTags={currentQuickTags}
                        updateForm={updateForm}
                      />
                    </View>

                    <View style={{ gap: 12, marginBottom: 20 }}>
                      <TouchableOpacity
                        onPress={handleSavePress}
                        disabled={isSaving}
                        style={{
                          backgroundColor: isSaving ? "#C7C7CC" : uiThemeColor,
                          width: "100%",
                          paddingVertical: 16,
                          borderRadius: 16,
                          alignItems: "center",
                        }}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text
                            style={{
                              color: "#FFF",
                              fontSize: 17,
                              fontWeight: "bold",
                            }}
                          >
                            保存して閉じる
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={onClose}
                        style={{
                          width: "100%",
                          paddingVertical: 14,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#8E8E93",
                            fontSize: 16,
                            fontWeight: "bold",
                          }}
                        >
                          キャンセル
                        </Text>
                      </TouchableOpacity>

                      {selectedItem && (
                        <TouchableOpacity
                          onPress={handleDeletePress}
                          disabled={isSaving}
                          style={{
                            width: "100%",
                            paddingVertical: 16,
                            backgroundColor: isSaving ? "#E5E5EA" : "#FF3B3015",
                            borderRadius: 16,
                            alignItems: "center",
                            marginTop: 10,
                            flexDirection: "row",
                            justifyContent: "center",
                          }}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color="#FF3B30" />
                          ) : (
                            <>
                              <Ionicons
                                name="trash-outline"
                                size={18}
                                color="#FF3B30"
                                style={{ marginRight: 6 }}
                              />
                              <Text
                                style={{
                                  color: "#FF3B30",
                                  fontSize: 16,
                                  fontWeight: "bold",
                                }}
                              >
                                この予定を削除する
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>

        {/* ======================= */}
        {/* 2. 属性（サブタグ）編集モーダル */}
        {/* ======================= */}
        {editSubTagModalVisible && (
          <Modal
            visible={editSubTagModalVisible}
            transparent
            animationType="fade"
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setEditSubTagModalVisible(false)}
              />
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
            </View>
          </Modal>
        )}

        {/* ======================= */}
        {/* 3. カテゴリ名編集モーダル */}
        {/* ======================= */}
        {editQuickTagModal && (
          <Modal visible={editQuickTagModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setEditQuickTagModal(false)}
              />
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
            </View>
          </Modal>
        )}

        <RepeatSettingsModal
          visible={repeatSettingsVisible}
          onClose={() => setRepeatSettingsVisible(false)}
          repeatType={formData.repeatType}
          repeatDays={formData.repeatDays}
          repeatInterval={formData.repeatInterval}
          repeatEndDate={formData.repeatEndDate}
          uiThemeColor={uiThemeColor}
          updateForm={updateForm}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}; // 🌟 関数をここで閉じる！

// =========================================================
// 🌟 限界突破2：最強の盾（React.memo）で道連れフリーズを100%防ぐ！
// 親画面（index.tsx）が更新されても、このモーダルは絶対に無駄な再描画をしません。
// =========================================================
export default React.memo(ScheduleModal, (prev, next) => {
  // 🌟 モーダルが閉じている時、または閉じようとしている時は「絶対に」再計算しない！
  // （これで保存ボタンやキャンセルボタンを押した瞬間のフリーズが完全に消滅します）
  if (!next.visible) return true;

  // 開いている間は、必要なデータが変わった時だけスマートに更新する
  return (
    prev.visible === next.visible &&
    prev.selectedItem === next.selectedItem &&
    prev.selectedDate === next.selectedDate &&
    prev.activeMode === next.activeMode &&
    prev.scheduleData === next.scheduleData
  );
});
