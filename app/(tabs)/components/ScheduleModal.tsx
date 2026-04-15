import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface SubTask {
  id: number;
  title: string;
  date: Date;
  amount: number;
  isExpense: boolean;
  category?: string;
  isAllDay?: boolean;
  startTime?: Date;
  endTime?: Date;
}

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

const COLOR_PALETTE = [
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#5AC8FA",
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#A2845E",
];

const getNextDate = (
  dateStr: string,
  type: "none" | "daily" | "weekly" | "monthly",
  count: number,
) => {
  if (type === "none" || count === 0) return dateStr;
  const d = new Date(dateStr);
  if (type === "daily") d.setDate(d.getDate() + count);
  if (type === "weekly") d.setDate(d.getDate() + count * 7);
  if (type === "monthly") d.setMonth(d.getMonth() + count);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

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
  const [selectedLayer, setSelectedLayer] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagColor, setTagColor] = useState("#007AFF");
  const [selectedCategory, setSelectedCategory] = useState("食費");
  const [repeatType, setRepeatType] = useState<
    "none" | "daily" | "weekly" | "monthly"
  >("none");

  const [isAllDay, setIsAllDay] = useState(true);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);

  const [isEvent, setIsEvent] = useState(true);
  const [isTodo, setIsTodo] = useState(false);
  const [isExpense, setIsExpense] = useState(false);

  const [showSubTasks, setShowSubTasks] = useState(false);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);

  const uiThemeColor = layerMaster[selectedLayer] || "#007AFF";

  const [quickMainTags, setQuickMainTags] = useState<{
    [key: string]: string[];
  }>({
    ALL_LAYERS: ["食費", "交通", "日用品", "交際費", "趣味", "その他"],
  });
  const [editQuickTagModal, setEditQuickTagModal] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [tempQuickTagText, setTempQuickTagText] = useState("");

  useEffect(() => {
    const loadQuickTags = async () => {
      const saved = await AsyncStorage.getItem("quickMainTagsData");
      if (saved) setQuickMainTags(JSON.parse(saved));
    };
    if (visible) loadQuickTags();
  }, [visible]);

  const currentQuickTags = useMemo(() => {
    return (
      quickMainTags[selectedLayer] ||
      quickMainTags["ALL_LAYERS"] || [
        "食費",
        "交通",
        "日用品",
        "交際費",
        "趣味",
        "その他",
      ]
    );
  }, [selectedLayer, quickMainTags]);

  const handleLongPressQuickTag = (index: number, currentText: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingTagIndex(index);
    setTempQuickTagText(currentText);
    setEditQuickTagModal(true);
  };

  const saveQuickTag = async () => {
    if (editingTagIndex === null || !tempQuickTagText.trim()) return;

    const newTags = { ...quickMainTags };
    if (!newTags[selectedLayer]) {
      newTags[selectedLayer] = [
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

    newTags[selectedLayer][editingTagIndex] = tempQuickTagText.trim();
    setQuickMainTags(newTags);
    await AsyncStorage.setItem("quickMainTagsData", JSON.stringify(newTags));
    setSelectedCategory(tempQuickTagText.trim());
    setEditQuickTagModal(false);
  };

  const titleHistory = useMemo(() => {
    const titles = new Set<string>();
    Object.values(scheduleData).forEach((dayItems: any) => {
      dayItems.forEach((item: any) => {
        if (item.title) titles.add(item.title);
      });
    });
    return Array.from(titles);
  }, [scheduleData]);

  const toHiragana = (str: string) => {
    return str
      .replace(/[\u30a1-\u30f6]/g, (match) => {
        const chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
      })
      .toLowerCase();
  };

  const [readingMaster, setReadingMaster] = useState<{
    [title: string]: string;
  }>({});
  useEffect(() => {
    const loadDictionary = async () => {
      const stored = await AsyncStorage.getItem("readingMasterData");
      if (stored) setReadingMaster(JSON.parse(stored));
    };
    if (visible) loadDictionary();
  }, [visible]);

  const suggestions = useMemo(() => {
    const inputReading = toHiragana(inputText.trim());
    if (!inputReading) return [];

    return titleHistory
      .filter((title) => {
        const titleReading = readingMaster[title] || toHiragana(title);
        return titleReading.startsWith(inputReading) && title !== inputText;
      })
      .slice(0, 5);
  }, [inputText, titleHistory, readingMaster]);

  const handleRegisterTag = async () => {
    if (!tagInput.trim())
      return Alert.alert("エラー", "属性名を入力してください");

    const newMaster = {
      ...tagMaster,
      [tagInput.trim()]: { layer: selectedLayer, color: tagColor },
    };
    setTagMaster(newMaster);
    await AsyncStorage.setItem("tagMasterData", JSON.stringify(newMaster));

    setIsCreatingNewTag(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteTag = async (tagName: string) => {
    Alert.alert("削除の確認", `「${tagName}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          const newMaster = { ...tagMaster };
          delete newMaster[tagName];
          setTagMaster(newMaster);
          await AsyncStorage.setItem(
            "tagMasterData",
            JSON.stringify(newMaster),
          );
          setTagInput("");
          setIsCreatingNewTag(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  useEffect(() => {
    if (visible) {
      const availableLayers = Object.keys(layerMaster);
      const defaultLayer =
        availableLayers.length > 0 ? availableLayers[0] : "生活";

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
        setSelectedLayer(
          tagMaster?.[selectedItem.tag || ""]?.layer || defaultLayer,
        );
        setSelectedCategory(selectedItem.category || "食費");
        setIsAllDay(selectedItem.isAllDay ?? true);

        if (selectedItem.startDate)
          setStartDate(new Date(selectedItem.startDate));
        else setStartDate(new Date(selectedDate));

        if (selectedItem.endDate) setEndDate(new Date(selectedItem.endDate));
        else setEndDate(new Date(selectedDate));

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
      } else {
        setInputText("");
        setTagInput("");
        setTagColor(layerMaster[defaultLayer] || "#007AFF");
        setInputAmount("");
        setIsEvent(activeMode === "calendar");
        setIsTodo(activeMode === "todo");
        setIsExpense(activeMode === "money");
        setSelectedLayer(defaultLayer);
        setSelectedCategory("食費");
        setIsAllDay(true);

        setStartDate(new Date(selectedDate));
        setEndDate(new Date(selectedDate));

        const now = new Date();
        now.setHours(10, 0, 0, 0);
        setStartTime(now);
        const later = new Date();
        later.setHours(11, 0, 0, 0);
        setEndTime(later);
      }
      setRepeatType("none");
      setSubTasks([]);
      setIsCreatingNewTag(false);
      setShowSubTasks(false);
    }
  }, [visible, selectedItem, activeMode, layerMaster]);

  const executeDelete = (deleteFuture: boolean) => {
    const newData = { ...scheduleData };
    if (deleteFuture && selectedItem?.recurringGroupId) {
      Object.keys(newData).forEach((date) => {
        if (date >= selectedDate) {
          newData[date] = newData[date].filter(
            (item: any) =>
              item.recurringGroupId !== selectedItem.recurringGroupId,
          );
        }
      });
    } else {
      Object.keys(newData).forEach((date) => {
        newData[date] = newData[date].filter(
          (item: any) => item.id !== selectedItem!.id,
        );
      });
    }
    setScheduleData(newData);
    setHasUnsavedChanges(true);
    onClose();
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    if (selectedItem.recurringGroupId) {
      Alert.alert("繰り返しの予定", "どの予定を削除しますか？", [
        { text: "キャンセル", style: "cancel" },
        { text: "この予定のみ", onPress: () => executeDelete(false) },
        {
          text: "これ以降すべて",
          style: "destructive",
          onPress: () => executeDelete(true),
        },
      ]);
    } else {
      Alert.alert("予定の削除", "この予定を消去してもよろしいですか？", [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => executeDelete(false),
        },
      ]);
    }
  };

  const handleLongPressTag = (tag: string) => {
    setTagInput(tag);
    setTagColor(tagMaster?.[tag]?.color || "#007AFF");
    setIsCreatingNewTag(true);
  };

  const executeSave = async (updateFuture: boolean) => {
    if (!inputText) return Alert.alert("エラー", "タイトルを入力してください");

    const newReadingMaster = {
      ...readingMaster,
      [inputText.trim()]: toHiragana(inputText.trim()),
    };
    setReadingMaster(newReadingMaster);
    await AsyncStorage.setItem(
      "readingMasterData",
      JSON.stringify(newReadingMaster),
    );

    const hasSubTag = tagInput.trim() !== "";
    const finalTag = hasSubTag ? tagInput.trim() : selectedLayer;
    const finalColor = hasSubTag ? tagColor : uiThemeColor;
    const finalCategory = isExpense ? selectedCategory : undefined;

    if (hasSubTag) {
      const newMaster = {
        ...tagMaster,
        [finalTag]: { layer: selectedLayer, color: finalColor },
      };
      setTagMaster(newMaster);
      await AsyncStorage.setItem("tagMasterData", JSON.stringify(newMaster));
    }

    const newData = { ...scheduleData };

    const sDateStr = startDate.toISOString().split("T")[0];
    const eDateStr = endDate.toISOString().split("T")[0];

    const itemData = {
      title: inputText,
      tag: finalTag,
      tags: [finalTag],
      amount: parseInt(inputAmount) || 0,
      isEvent,
      isTodo,
      isExpense,
      color: finalColor,
      category: finalCategory,
      repeatType: repeatType !== "none" ? repeatType : undefined,
      isAllDay: isAllDay,
      startDate: sDateStr,
      endDate: eDateStr,
      startTime: isAllDay ? undefined : formatTime(startTime),
      endTime: isAllDay ? undefined : formatTime(endTime),
    };

    const startNoTime = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const endNoTime = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
    );
    const durationDays = Math.round(
      (endNoTime.getTime() - startNoTime.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (selectedItem) {
      if (updateFuture && selectedItem.recurringGroupId) {
        Object.keys(newData).forEach((date) => {
          if (date >= selectedDate) {
            newData[date] = newData[date].map((item: any) => {
              if (
                item.recurringGroupId === selectedItem.recurringGroupId &&
                !item.id.includes("_sub_")
              ) {
                return { ...item, ...itemData };
              }
              return item;
            });
          }
        });
      } else {
        Object.keys(newData).forEach((date) => {
          newData[date] = newData[date].filter(
            (i: any) => i.id !== selectedItem.id,
          );
        });

        for (let d = 0; d <= Math.max(0, durationDays); d++) {
          const targetDate = getNextDate(sDateStr, "daily", d);
          if (!newData[targetDate]) newData[targetDate] = [];
          newData[targetDate].push({ ...selectedItem, ...itemData });
        }
      }
    } else {
      const limit =
        repeatType === "daily"
          ? 30
          : repeatType === "weekly"
            ? 52
            : repeatType === "monthly"
              ? 12
              : 1;
      const recurringGroupId =
        repeatType !== "none" ? `rec_${Date.now()}` : undefined;

      for (let i = 0; i < limit; i++) {
        const baseStart = getNextDate(sDateStr, repeatType, i);
        const baseId = `${Date.now()}_${i}`;

        for (let d = 0; d <= Math.max(0, durationDays); d++) {
          const targetDate = getNextDate(baseStart, "daily", d);
          if (!newData[targetDate]) newData[targetDate] = [];
          newData[targetDate].push({
            id: baseId,
            recurringGroupId,
            isDone: false,
            ...itemData,
          });
        }

        subTasks
          .filter((t) => t.title.trim() !== "")
          .forEach((task, index) => {
            const taskDateStr = task.date.toISOString().split("T")[0];
            const targetTaskDate = getNextDate(taskDateStr, repeatType, i);
            if (!newData[targetTaskDate]) newData[targetTaskDate] = [];
            newData[targetTaskDate].push({
              id: `${baseId}_sub_${index}`,
              recurringGroupId,
              title: `${task.title} (${inputText})`,
              tag: finalTag,
              tags: [finalTag],
              amount: task.isExpense ? task.amount : 0,
              isDone: false,
              isEvent: false,
              isTodo: true,
              isExpense: task.isExpense,
              color: finalColor,
              category: task.isExpense ? task.category : undefined,
              isAllDay: task.isAllDay !== false,
              startTime:
                task.isAllDay === false && task.startTime
                  ? formatTime(task.startTime)
                  : undefined,
              endTime:
                task.isAllDay === false && task.endTime
                  ? formatTime(task.endTime)
                  : undefined,
            });
          });
      }
    }
    setScheduleData(newData);
    setHasUnsavedChanges(true);
    onClose();
  };

  const handleSaveBtnClick = () => {
    if (selectedItem?.recurringGroupId) {
      Alert.alert("繰り返しの予定", "この変更をどのように適用しますか？", [
        { text: "キャンセル", style: "cancel" },
        { text: "この予定のみ", onPress: () => executeSave(false) },
        { text: "これ以降すべて", onPress: () => executeSave(true) },
      ]);
    } else {
      executeSave(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={[
              styles.modalContent,
              { borderTopWidth: 8, borderTopColor: uiThemeColor },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
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
                placeholderTextColor="#BBB"
                value={inputText}
                onChangeText={setInputText}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestionWrapper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {suggestions.map((suggestion: any, index: any) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionBadge}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          setInputText(suggestion);
                        }}
                      >
                        <Ionicons
                          name="time-outline"
                          size={12}
                          color="#8E8E93"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 🌟 プレビュー付きのスマートな時間設定UI */}
              <View style={styles.timeSection}>
                <View style={styles.timePreviewRow}>
                  <Ionicons name="time" size={14} color={uiThemeColor} />
                  <Text
                    style={[styles.timePreviewText, { color: uiThemeColor }]}
                  >
                    {isAllDay
                      ? startDate.getTime() === endDate.getTime()
                        ? "終日"
                        : `${startDate.getMonth() + 1}/${startDate.getDate()} 〜 ${endDate.getMonth() + 1}/${endDate.getDate()} 終日`
                      : `${startDate.getMonth() + 1}/${startDate.getDate()} ${formatTime(startTime)} 〜 ${endDate.getMonth() + 1}/${endDate.getDate()} ${formatTime(endTime)}`}
                  </Text>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>終日</Text>
                  <Switch
                    value={isAllDay}
                    onValueChange={setIsAllDay}
                    trackColor={{ true: uiThemeColor, false: "#a9a9a9" }}
                    ios_backgroundColor="#c0c0c0"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>

                <View style={styles.timePickerContainer}>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>開始</Text>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 5,
                        alignItems: "center",
                      }}
                    >
                      <DateTimePicker
                        value={startDate}
                        mode="date"
                        display="compact"
                        onChange={(e, d) => {
                          if (d) {
                            setStartDate(d);
                            if (d > endDate) setEndDate(d);
                          }
                        }}
                        style={{ width: 110 }}
                      />
                      {!isAllDay && (
                        <DateTimePicker
                          value={startTime}
                          mode="time"
                          display="default"
                          onChange={(e, d) => d && setStartTime(d)}
                          style={{ width: 75 }}
                        />
                      )}
                    </View>
                  </View>
                  <View style={[styles.timeRow, { marginTop: 12 }]}>
                    <Text style={styles.timeLabel}>終了</Text>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 5,
                        alignItems: "center",
                      }}
                    >
                      <DateTimePicker
                        value={endDate}
                        mode="date"
                        display="compact"
                        onChange={(e, d) => d && setEndDate(d)}
                        style={{ width: 110 }}
                      />
                      {!isAllDay && (
                        <DateTimePicker
                          value={endTime}
                          mode="time"
                          display="default"
                          onChange={(e, d) => d && setEndTime(d)}
                          style={{ width: 75 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              </View>

              <Text style={styles.label}>カレンダーの種類</Text>
              <View style={styles.layerContainer}>
                {Object.keys(layerMaster).map((layer) => (
                  <TouchableOpacity
                    key={layer}
                    style={[
                      styles.layerChip,
                      selectedLayer === layer && {
                        backgroundColor: layerMaster[layer],
                      },
                    ]}
                    onPress={() => setSelectedLayer(layer)}
                  >
                    <Text
                      style={[
                        styles.layerChipText,
                        selectedLayer === layer && { color: "#fff" },
                      ]}
                    >
                      {layer}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.tagSection}>
                <Text style={styles.label}>
                  属性（任意 / 長押しで編集 / ＋で追加）
                </Text>
                <View style={styles.tagListContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      onPress={() => {
                        setIsCreatingNewTag(!isCreatingNewTag);
                        setTagInput("");
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
                    {Object.keys(tagMaster || {})
                      .filter(
                        (t) =>
                          tagMaster![t].layer === selectedLayer &&
                          t !== selectedLayer,
                      )
                      .map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => {
                            setTagInput(tag);
                            setTagColor(tagMaster![tag].color);
                            setIsCreatingNewTag(false);
                          }}
                          onLongPress={() => handleLongPressTag(tag)}
                          style={[
                            styles.tagChip,
                            tagInput === tag && {
                              backgroundColor: tagMaster![tag].color,
                              borderColor: tagMaster![tag].color,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.dot,
                              {
                                backgroundColor:
                                  tagInput === tag
                                    ? "#fff"
                                    : tagMaster![tag].color,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.tagText,
                              tagInput === tag && { color: "#fff" },
                            ]}
                          >
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
                {isCreatingNewTag && (
                  <View
                    style={[
                      styles.newTagInputArea,
                      { borderColor: uiThemeColor },
                    ]}
                  >
                    <View style={styles.tagInputRow}>
                      <TextInput
                        autoFocus
                        style={[styles.newTagInput, { flex: 1 }]}
                        placeholder="新しい属性を入力"
                        value={tagInput}
                        onChangeText={setTagInput}
                      />

                      <View style={styles.tagActionIcons}>
                        {tagMaster?.[tagInput] && (
                          <TouchableOpacity
                            onPress={() => handleDeleteTag(tagInput)}
                            style={styles.iconBtn}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={20}
                              color="#FF3B30"
                            />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={handleRegisterTag}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={28}
                            color={uiThemeColor}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 15 }}
                    >
                      {COLOR_PALETTE.map((c) => {
                        const isSelected = tagColor === c;
                        return (
                          <TouchableOpacity
                            key={c}
                            onPress={() => {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                              setTagColor(c);
                            }}
                            style={[
                              styles.miniColorDot,
                              { backgroundColor: c },
                              isSelected && {
                                borderWidth: 3,
                                borderColor: "#1C1C1E",
                                transform: [{ scale: 1.03 }],
                              },
                            ]}
                          />
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
              <View
                style={[
                  styles.optionSection,
                  { borderLeftColor: uiThemeColor },
                ]}
              >
                {!selectedItem && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.label, { marginBottom: 8 }]}>
                      繰り返し設定
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[
                        { id: "none", label: "なし" },
                        { id: "daily", label: "毎日" },
                        { id: "weekly", label: "毎週" },
                        { id: "monthly", label: "毎月" },
                      ].map((opt) => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.layerChip,
                            repeatType === opt.id && {
                              backgroundColor: uiThemeColor,
                            },
                          ]}
                          onPress={() => setRepeatType(opt.id as any)}
                        >
                          <Text
                            style={[
                              styles.layerChipText,
                              repeatType === opt.id && { color: "#fff" },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.switchRow}>
                  <View style={styles.iconLabel}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={isEvent ? uiThemeColor : "#666"}
                    />
                    <Text
                      style={[
                        styles.switchLabel,
                        isEvent && { color: uiThemeColor },
                      ]}
                    >
                      カレンダーに予定として表示
                    </Text>
                  </View>
                  <Switch
                    value={isEvent}
                    onValueChange={setIsEvent}
                    trackColor={{ true: uiThemeColor, false: "#a9a9a9" }}
                    ios_backgroundColor="#c0c0c0"
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.iconLabel}>
                    <Ionicons
                      name="checkmark-done-circle-outline"
                      size={20}
                      color={isTodo ? uiThemeColor : "#666"}
                    />
                    <Text
                      style={[
                        styles.switchLabel,
                        isTodo && { color: uiThemeColor },
                      ]}
                    >
                      ToDoリストに表示
                    </Text>
                  </View>
                  <Switch
                    value={isTodo}
                    onValueChange={setIsTodo}
                    trackColor={{ true: uiThemeColor, false: "#a9a9a9" }}
                    ios_backgroundColor="#c0c0c0"
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.iconLabel}>
                    <Ionicons
                      name="card-outline"
                      size={20}
                      color={isExpense ? uiThemeColor : "#666"}
                    />
                    <Text
                      style={[
                        styles.switchLabel,
                        isExpense && { color: uiThemeColor },
                      ]}
                    >
                      支出を記録
                    </Text>
                  </View>
                  <Switch
                    value={isExpense}
                    onValueChange={setIsExpense}
                    trackColor={{ true: uiThemeColor, false: "#a9a9a9" }}
                    ios_backgroundColor="#c0c0c0"
                  />
                </View>

                {isExpense && (
                  <View style={{ marginBottom: 15 }}>
                    <TextInput
                      style={styles.input}
                      placeholder="金額 (¥)"
                      keyboardType="numeric"
                      value={inputAmount}
                      onChangeText={setInputAmount}
                    />
                    <Text style={[styles.label, { marginTop: 15 }]}>
                      支出の項目 (長押しで編集)
                    </Text>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                    >
                      {currentQuickTags.map((cat, index) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.layerChip,
                            selectedCategory === cat && {
                              backgroundColor: uiThemeColor,
                            },
                          ]}
                          onPress={() => setSelectedCategory(cat)}
                          onLongPress={() =>
                            handleLongPressQuickTag(index, cat)
                          }
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

                <TouchableOpacity
                  style={[
                    styles.subTaskToggleBtn,
                    { borderColor: uiThemeColor },
                  ]}
                  onPress={() => setShowSubTasks(!showSubTasks)}
                >
                  <Ionicons
                    name={showSubTasks ? "chevron-up" : "list-outline"}
                    size={18}
                    color={uiThemeColor}
                  />
                  <Text
                    style={{
                      color: uiThemeColor,
                      fontWeight: "bold",
                      marginLeft: 8,
                    }}
                  >
                    {showSubTasks
                      ? "サブタスク入力を閉じる"
                      : "サブタスクを追加..."}
                  </Text>
                </TouchableOpacity>

                {showSubTasks && (
                  <View style={styles.expandingInput}>
                    {subTasks.map((task, idx) => (
                      <View
                        key={task.id}
                        style={[
                          styles.subTaskCard,
                          { borderLeftColor: uiThemeColor },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <TextInput
                            style={styles.subTaskInput}
                            placeholder="やる事..."
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
                              setSubTasks(
                                subTasks.filter((t) => t.id !== task.id),
                              )
                            }
                          >
                            <Ionicons
                              name="close-circle"
                              size={20}
                              color="#FF3B30"
                            />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.subTaskControls}>
                          <View
                            style={[
                              styles.datePickerContainer,
                              { backgroundColor: uiThemeColor + "1A" },
                            ]}
                          >
                            <Ionicons
                              name="calendar-outline"
                              size={14}
                              color={uiThemeColor}
                              style={{ marginRight: 5 }}
                            />
                            <DateTimePicker
                              value={task.date}
                              mode="date"
                              display="compact"
                              onChange={(e, d) => {
                                if (d) {
                                  const n = [...subTasks];
                                  n[idx].date = d;
                                  setSubTasks(n);
                                }
                              }}
                              style={{ width: 100 }}
                            />
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Ionicons
                              name="logo-yen"
                              size={14}
                              color={task.isExpense ? uiThemeColor : "#BBB"}
                            />
                            <Switch
                              value={task.isExpense}
                              onValueChange={(v) => {
                                const n = [...subTasks];
                                n[idx].isExpense = v;
                                setSubTasks(n);
                              }}
                              trackColor={{
                                true: uiThemeColor,
                                false: "#a9a9a9",
                              }}
                              ios_backgroundColor="#c0c0c0"
                              style={{
                                transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }],
                              }}
                            />
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 8,
                            justifyContent: "space-between",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color={
                                task.isAllDay === false ? uiThemeColor : "#BBB"
                              }
                            />
                            <Switch
                              value={task.isAllDay === false}
                              onValueChange={(v) => {
                                const n = [...subTasks];
                                n[idx].isAllDay = !v;
                                setSubTasks(n);
                              }}
                              trackColor={{
                                true: uiThemeColor,
                                false: "#a9a9a9",
                              }}
                              ios_backgroundColor="#c0c0c0"
                              style={{
                                transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }],
                              }}
                            />
                          </View>
                          {task.isAllDay === false && (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              <DateTimePicker
                                value={task.startTime!}
                                mode="time"
                                display="default"
                                onChange={(e, d) => {
                                  if (d) {
                                    const n = [...subTasks];
                                    n[idx].startTime = d;
                                    setSubTasks(n);
                                  }
                                }}
                                style={{ width: 75 }}
                              />
                              <Text style={{ color: "#666" }}>-</Text>
                              <DateTimePicker
                                value={task.endTime!}
                                mode="time"
                                display="default"
                                onChange={(e, d) => {
                                  if (d) {
                                    const n = [...subTasks];
                                    n[idx].endTime = d;
                                    setSubTasks(n);
                                  }
                                }}
                                style={{ width: 75 }}
                              />
                            </View>
                          )}
                        </View>
                        {task.isExpense && (
                          <View style={styles.subTaskAmountContainer}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={[
                                  styles.yenSymbol,
                                  { color: uiThemeColor },
                                ]}
                              >
                                ¥
                              </Text>
                              <TextInput
                                style={styles.subTaskAmountInput}
                                placeholder="0"
                                placeholderTextColor="#BBB"
                                keyboardType="numeric"
                                value={
                                  task.amount > 0 ? task.amount.toString() : ""
                                }
                                onChangeText={(v) => {
                                  const n = [...subTasks];
                                  n[idx].amount = parseInt(v) || 0;
                                  setSubTasks(n);
                                }}
                              />
                            </View>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={{ marginTop: 8 }}
                            >
                              {currentQuickTags.map((cat, index) => (
                                <TouchableOpacity
                                  key={cat}
                                  style={[
                                    styles.microChip,
                                    task.category === cat && {
                                      backgroundColor: uiThemeColor,
                                    },
                                  ]}
                                  onPress={() => {
                                    const n = [...subTasks];
                                    n[idx].category = cat;
                                    setSubTasks(n);
                                  }}
                                  onLongPress={() =>
                                    handleLongPressQuickTag(index, cat)
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.microChipText,
                                      task.category === cat && {
                                        color: "#fff",
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
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.addSubTaskBtn}
                      onPress={() => {
                        const defaultStart = new Date();
                        defaultStart.setHours(10, 0, 0, 0);
                        const defaultEnd = new Date();
                        defaultEnd.setHours(11, 0, 0, 0);
                        setSubTasks([
                          ...subTasks,
                          {
                            id: Date.now(),
                            title: "",
                            date: new Date(selectedDate),
                            amount: 0,
                            isExpense: false,
                            category: selectedCategory,
                            isAllDay: true,
                            startTime: defaultStart,
                            endTime: defaultEnd,
                          },
                        ]);
                      }}
                    >
                      <Ionicons
                        name="add-circle"
                        size={22}
                        color={uiThemeColor}
                      />
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
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                  <Text style={{ color: "#999" }}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveBtnClick}
                  style={[styles.saveBtn, { backgroundColor: uiThemeColor }]}
                >
                  <Text style={styles.saveBtnText}>保存して閉じる</Text>
                </TouchableOpacity>
              </View>
              {selectedItem && (
                <TouchableOpacity
                  onPress={handleDelete}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  <Text style={styles.deleteBtnText}>この予定を削除する</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>

      <Modal visible={editQuickTagModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditQuickTagModal(false)}
        >
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>{selectedLayer}の項目を編集</Text>
            <TextInput
              style={styles.editInputText}
              value={tempQuickTagText}
              onChangeText={setTempQuickTagText}
              autoFocus
            />
            <View
              style={[
                styles.editActionRow,
                { justifyContent: "center", marginTop: 10 },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.saveBtnModal,
                  {
                    backgroundColor: uiThemeColor,
                    width: "100%",
                    alignItems: "center",
                  },
                ]}
                onPress={saveQuickTag}
              >
                <Text style={styles.saveTextModal}>保存する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  dateBadge: {
    backgroundColor: "#E5E5EA",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    color: "#3A3A3C",
  },
  mainInput: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    paddingVertical: 10,
    color: "#1C1C1E",
  },
  timeSection: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
  },
  timePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    gap: 6,
  },
  timePreviewText: {
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  timePickerContainer: {
    marginTop: 5,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeLabel: { fontSize: 13, fontWeight: "bold", color: "#666" },
  label: {
    fontSize: 11,
    color: "#636366",
    fontWeight: "bold",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  layerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 20,
  },
  layerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F5F5F7",
  },
  layerChipText: { fontSize: 13, color: "#666", fontWeight: "bold" },
  tagSection: { marginBottom: 25 },
  tagListContainer: { flexDirection: "row", alignItems: "center" },
  addTagCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F0F0F5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
    marginRight: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  tagText: { fontSize: 14, fontWeight: "600", color: "#444" },
  newTagInputArea: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "#F8F8FA",
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: "dashed",
  },

  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#DDD",
    paddingBottom: 5,
  },
  tagActionIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  miniColorDot: {
    width: 25,
    height: 25,
    borderRadius: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },

  newTagInput: { flex: 1, fontSize: 16, color: "#333", fontWeight: "bold" },
  colorIndicator: { width: 16, height: 16, borderRadius: 8, marginLeft: 10 },
  optionSection: {
    backgroundColor: "#F8F8FA",
    borderRadius: 20,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 5,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  iconLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { fontSize: 15, fontWeight: "500", color: "#3A3A3C" },
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
  subTaskControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: { padding: 12 },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 15,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "bold" },
  addSubTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    marginTop: 5,
  },
  input: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#EEE",
    color: "#333",
  },
  deleteBtn: {
    marginTop: 30,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F5",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  deleteBtnText: { color: "#FF3B30", fontSize: 14, fontWeight: "600" },
  subTaskAmountContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F5",
  },
  yenSymbol: { fontSize: 14, fontWeight: "bold", marginRight: 5 },
  subTaskAmountInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    paddingVertical: 2,
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
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#F0F0F5",
    marginRight: 6,
  },
  microChipText: { fontSize: 10, color: "#666", fontWeight: "bold" },
  suggestionWrapper: {
    marginTop: -5,
    marginBottom: 15,
    height: 36,
  },
  suggestionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  suggestionText: {
    fontSize: 13,
    color: "#1C1C1E",
    fontWeight: "600",
  },
  editCardModal: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 25,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#333",
  },
  editInputText: {
    backgroundColor: "#F2F2F7",
    padding: 10,
    borderRadius: 10,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  editActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  saveBtnModal: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 15,
  },
  saveTextModal: { color: "#fff", fontWeight: "bold" },
});
