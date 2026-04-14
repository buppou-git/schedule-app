import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";

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
  startTime?: string;
  endTime?: string;
}

interface Props {
  scheduleData: { [key: string]: ScheduleItem[] };
  setScheduleData: (data: any) => void;
  selectedDate: string;
  tagMaster: { [key: string]: { layer: string; color: string } };
  setTagMaster: (data: any) => void;
  layerMaster: { [key: string]: string };
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
}

export default function MoneyDashboard({
  scheduleData,
  setScheduleData,
  selectedDate,
  tagMaster,
  setTagMaster,
  layerMaster,
  activeTags,
  setHasUnsavedChanges,
}: Props) {
  const [isSummaryMode, setIsSummaryMode] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [currentModalMonth, setCurrentModalMonth] = useState(
    selectedDate.substring(0, 7),
  );
  const [isSettingMode, setIsSettingMode] = useState(false);
  const [isManualInput, setIsManualInput] = useState(false);

  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(
    null,
  );
  const [chartGroupBy, setChartGroupBy] = useState<"layer" | "category" | "tag">("layer");

  const [inputAmount, setInputAmount] = useState("");
  const [selectedMainTag, setSelectedMainTag] = useState("食費");
  const [selectedSubTag, setSelectedSubTag] = useState("");
  const [manualTag, setManualTag] = useState("");
  const [manualTitle, setManualTitle] = useState("");

  const [payday, setPayday] = useState(25);
  const [monthlyBudget, setMonthlyBudget] = useState(100000);
  const [layerBudgets, setLayerBudgets] = useState<{ [key: string]: number }>(
    {},
  );

  const [quickMainTags, setQuickMainTags] = useState<{ [key: string]: string[] }>({
    ALL_LAYERS: ["食費", "交通", "日用品", "交際費", "趣味", "その他"],
  });

  const [editQuickTagModal, setEditQuickTagModal] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [tempQuickTagText, setTempQuickTagText] = useState("");

  const [editingLayer, setEditingLayer] = useState("ALL_LAYERS");

  useEffect(() => {
    const loadQuickTags = async () => {
      const saved = await AsyncStorage.getItem("quickMainTagsData");
      if (saved) setQuickMainTags(JSON.parse(saved));
    };
    loadQuickTags();
  }, []);

  const handleLongPressQuickTag = (index: number, currentText: string, targetLayer: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingLayer(targetLayer);
    setEditingTagIndex(index);
    setTempQuickTagText(currentText);
    setEditQuickTagModal(true);
  };

  const saveQuickTag = async () => {
    if (editingTagIndex === null || !tempQuickTagText.trim()) return;

    const newTags = { ...quickMainTags };
    if (!newTags[editingLayer]) {
      newTags[editingLayer] = [...(quickMainTags["ALL_LAYERS"] || ["食費", "交通", "日用品", "交際費", "趣味", "その他"])];
    }

    newTags[editingLayer][editingTagIndex] = tempQuickTagText.trim();
    setQuickMainTags(newTags);
    await AsyncStorage.setItem("quickMainTagsData", JSON.stringify(newTags));
    setSelectedMainTag(tempQuickTagText.trim());
    setEditQuickTagModal(false);
  };

  const screenWidth = Dimensions.get("window").width;
  const halfWidth = (screenWidth - 40) / 2;

  const isSingleFilter = activeTags.length === 1;
  const currentLayer = activeTags[0] || "default";
  const currentActiveLayer = isSingleFilter ? activeTags[0] : null;
  const themeColor = isSingleFilter
    ? layerMaster[currentLayer] || "#1C1C1E"
    : "#1C1C1E";

  const palette = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#F9CA24",
    "#6AB04C",
    "#E056FD",
    "#FFBE76",
  ];

  const displayLayers = useMemo(() => {
    if (activeTags.length > 0) return activeTags;
    return ["ALL_LAYERS", ...Object.keys(layerMaster)];
  }, [activeTags, layerMaster]);

  useEffect(() => {
    setIsSummaryMode(false);
    setSelectedFilterTag(null);
    setChartGroupBy(activeTags.length !== 1 ? "layer" : "category");
  }, [selectedDate, activeTags]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedBudget = await AsyncStorage.getItem("myMonthlyBudget");
        const savedPayday = await AsyncStorage.getItem("myPayday");
        const savedLayerBudgets =
          await AsyncStorage.getItem("layerBudgetsData");
        if (savedBudget !== null) setMonthlyBudget(parseInt(savedBudget));
        if (savedPayday !== null) setPayday(parseInt(savedPayday));
        if (savedLayerBudgets !== null)
          setLayerBudgets(JSON.parse(savedLayerBudgets));
      } catch (error) {
        console.error(error);
      }
    };
    loadSettings();
  }, []);

  const toggleManualMode = () => {
    if (!isManualInput && selectedSubTag) setManualTag(selectedSubTag);
    setIsManualInput(!isManualInput);
  };

  const handleAddExpense = (targetLayer: string, layerColor: string) => {
    const amountNum = parseInt(inputAmount);

    // 🌟 サブタグ（属性）は任意なので空でもOK！
    const finalTag = isManualInput ? manualTag.trim() : selectedSubTag;

    const finalTitle =
      isManualInput && manualTitle.trim()
        ? manualTitle.trim()
        : selectedMainTag;

    // 🌟 バリデーション修正：属性（finalTag）が無くても保存可能にする
    if (!selectedMainTag || isNaN(amountNum) || amountNum <= 0) {
      return Alert.alert(
        "入力不足",
        "金額と項目（クイックチップ）を入力してください。",
      );
    }

    // 🌟 サブタグが入力された場合のみ、tagMasterへ新規登録を行う
    if (finalTag && !tagMaster[finalTag]) {
      const assignLayer = targetLayer === "ALL_LAYERS" ? "共通" : targetLayer;
      const newTagMaster = {
        ...tagMaster,
        [finalTag]: { layer: assignLayer, color: layerColor },
      };
      setTagMaster(newTagMaster);
      setHasUnsavedChanges(true);
      AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
    }

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      category: selectedMainTag,
      // 🌟 サブタグが空なら undefined や空配列として扱う
      tag: finalTag || undefined,
      tags: finalTag ? [finalTag] : [],
      title: finalTitle,
      amount: amountNum,
      isDone: false,
      color: (finalTag && tagMaster[finalTag]?.color) || layerColor,
      isEvent: false,
      isTodo: false,
      isExpense: true,
    };

    const newData = { ...scheduleData };
    newData[selectedDate] = [...(newData[selectedDate] || []), newItem];
    setScheduleData(newData);
    setHasUnsavedChanges(true);
    setInputAmount("");
    setManualTitle("");
    setManualTag("");
    Keyboard.dismiss();
  };

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    item: ScheduleItem;
    date: string;
  } | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const handleOpenEdit = (item: ScheduleItem, date: string) => {
    setEditingItem({ item, date });
    setEditAmount(item.amount.toString());
    setEditTitle(item.title || "");
    setEditModalVisible(true);
  };

  const handleUpdate = () => {
    if (!editingItem) return;
    const newAmount = parseInt(editAmount);
    if (isNaN(newAmount) || newAmount <= 0)
      return Alert.alert("エラー", "金額を正しく入力してください");
    const newData = { ...scheduleData };
    newData[editingItem.date] = newData[editingItem.date].map((i) =>
      i.id === editingItem.item.id
        ? { ...i, amount: newAmount, title: editTitle }
        : i,
    );
    setScheduleData(newData);
    setHasUnsavedChanges(true);
    setEditModalVisible(false);
  };

  const getStatsForMonth = (monthStr: string) => {
    let total = 0;
    const totals: { [key: string]: number } = {};
    Object.keys(scheduleData).forEach((date) => {
      if (date.startsWith(monthStr)) {
        scheduleData[date].forEach((item) => {
          if (!item.isExpense) return;
          const itemTag =
            item.tags && item.tags.length > 0 ? item.tags[0] : item.tag || "";

          const itemLayer = tagMaster[itemTag]?.layer || "共通";

          if (activeTags.length > 0 && !activeTags.includes(itemLayer)) return;
          if (selectedFilterTag && itemTag !== selectedFilterTag) return;

          total += item.amount;

          let groupKey = itemTag;
          if (chartGroupBy === "layer") {
            groupKey = itemLayer;
          } else if (chartGroupBy === "category") {
            groupKey = item.category || itemTag;
          }

          // 🌟 属性がなく、かつ項目別の集計の場合は category を優先
          if (!groupKey) groupKey = item.category || "未分類";

          totals[groupKey] = (totals[groupKey] || 0) + item.amount;
        });
      }
    });
    return { total, totals };
  };

  const lineChartData = useMemo(() => {
    const labels: string[] = [];
    const data: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      labels.push(`${d.getMonth() + 1}月`);
      data.push(getStatsForMonth(mStr).total || 0);
    }
    return { labels, datasets: [{ data }] };
  }, [scheduleData, activeTags, selectedFilterTag, chartGroupBy]);

  const mainStats = useMemo(() => {
    const s = getStatsForMonth(selectedDate.substring(0, 7));
    let dTotal = 0;
    (scheduleData[selectedDate] || []).forEach((item) => {
      if (!item.isExpense) return;
      const itemTag =
        item.tags && item.tags.length > 0 ? item.tags[0] : item.tag || "";
      const itemLayer = tagMaster[itemTag]?.layer || "共通";
      if (activeTags.length > 0 && !activeTags.includes(itemLayer)) return;
      dTotal += item.amount;
    });
    return { ...s, dailyTotal: dTotal };
  }, [
    selectedDate,
    scheduleData,
    activeTags,
    tagMaster,
    chartGroupBy,
    selectedFilterTag,
  ]);

  const stats = useMemo(() => {
    return getStatsForMonth(selectedDate.substring(0, 7));
  }, [
    scheduleData,
    selectedDate,
    activeTags,
    tagMaster,
    isSingleFilter,
    chartGroupBy,
    selectedFilterTag,
  ]);

  const filteredHistory = useMemo(() => {
    const days: { date: string; items: ScheduleItem[] }[] = [];
    Object.keys(scheduleData)
      .filter((d) => d.startsWith(currentModalMonth))
      .sort((a, b) => b.localeCompare(a))
      .forEach((date) => {
        const items = scheduleData[date].filter((item) => {
          if (!item.isExpense) return false;
          const itemTag =
            item.tags && item.tags.length > 0 ? item.tags[0] : item.tag || "";
          const itemLayer = tagMaster[itemTag]?.layer || "共通";
          if (activeTags.length > 0 && !activeTags.includes(itemLayer))
            return false;
          if (selectedFilterTag && itemTag !== selectedFilterTag) return false;
          return true;
        });
        if (items.length > 0) days.push({ date, items });
      });
    return days;
  }, [scheduleData, currentModalMonth, activeTags, selectedFilterTag]);

  const activeLimit =
    currentActiveLayer && layerBudgets[currentActiveLayer]
      ? layerBudgets[currentActiveLayer]
      : monthlyBudget;
  const progress = Math.min(stats.total / activeLimit, 1);
  const statusColor = stats.total > activeLimit ? "#FF3B30" : themeColor;

  return (
    <View style={styles.container}>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, !isSummaryMode && styles.toggleActive]}
          onPress={() => setIsSummaryMode(false)}
        >
          <View style={styles.toggleItem}>
            <Ionicons
              name="list"
              size={16}
              color={!isSummaryMode ? "#1C1C1E" : "#8E8E93"}
            />
            <Text style={styles.toggleText}>日別詳細</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, isSummaryMode && styles.toggleActive]}
          onPress={() => setIsSummaryMode(true)}
        >
          <View style={styles.toggleItem}>
            <Ionicons
              name="pie-chart"
              size={15}
              color={isSummaryMode ? "#1C1C1E" : "#8E8E93"}
            />
            <Text style={styles.toggleText}>予算統計</Text>
          </View>
        </TouchableOpacity>
      </View>

      {isSummaryMode ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.iconTextRow}>
              <MaterialCommunityIcons
                name="piggy-bank-outline"
                size={18}
                color={themeColor}
              />
              <Text style={[styles.paydayText, { color: themeColor }]}>
                給料日まで あと{" "}
                {Math.max(0, payday - new Date(selectedDate).getDate())} 日
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsSettingMode(!isSettingMode)}>
              <Ionicons
                name={isSettingMode ? "checkmark-circle" : "options-outline"}
                size={22}
                color={themeColor}
              />
            </TouchableOpacity>
          </View>

          {isSettingMode ? (
            <View style={styles.settingArea}>
              {/* 🌟 ここから... */}
              {activeTags.length === 1 ? (
                <View>
                  <Text style={styles.settingLabel}>『{activeTags[0]}』の月間予算</Text>
                  <TextInput
                    style={styles.settingInput}
                    keyboardType="numeric"
                    placeholder="未設定（全体予算を共有）"
                    value={layerBudgets[activeTags[0]] ? layerBudgets[activeTags[0]].toString() : ""}
                    onChangeText={(t) => {
                      const val = parseInt(t);
                      const newBudgets = { ...layerBudgets };
                      if (isNaN(val) || val <= 0) {
                        delete newBudgets[activeTags[0]];
                      } else {
                        newBudgets[activeTags[0]] = val;
                      }
                      setLayerBudgets(newBudgets);
                      AsyncStorage.setItem("layerBudgetsData", JSON.stringify(newBudgets));
                    }}
                  />
                  <Text style={styles.settingHintText}>
                    ※ 未設定の場合は、全体の予算（¥{monthlyBudget.toLocaleString()}）が適用されます。
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.settingLabel}>全体の月間予算</Text>
                  <TextInput
                    style={styles.settingInput}
                    keyboardType="numeric"
                    value={monthlyBudget.toString()}
                    onChangeText={(t) => {
                      setMonthlyBudget(parseInt(t) || 0);
                      AsyncStorage.setItem("myMonthlyBudget", t);
                    }}
                  />
                  <Text style={styles.settingLabel}>給料日指定</Text>
                  <TextInput
                    style={styles.settingInput}
                    keyboardType="numeric"
                    placeholder="25"
                    value={payday.toString()}
                    onChangeText={(t) => {
                      setPayday(parseInt(t) || 25);
                      AsyncStorage.setItem("myPayday", t);
                    }}
                  />
                </View>
              )}
            </View>
          ) : (
            <>
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>
                    {selectedFilterTag
                      ? `${selectedFilterTag} の総額`
                      : currentLayer || "全体"}
                  </Text>
                  <Text
                    style={[styles.progressPercent, { color: statusColor }]}
                  >
                    {selectedFilterTag
                      ? `¥${stats.total.toLocaleString()}`
                      : `${Math.round(progress * 100)}%`}
                  </Text>
                </View>
                {!selectedFilterTag && (
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progress * 100}%`,
                          backgroundColor: statusColor,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>

              <View style={styles.chartToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.chartToggleBtn,
                    chartGroupBy === "layer" && { backgroundColor: themeColor },
                  ]}
                  onPress={() => setChartGroupBy("layer")}
                >
                  <Text
                    style={[
                      styles.chartToggleText,
                      chartGroupBy === "layer" && { color: "#fff" },
                    ]}
                  >
                    レイヤー別
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chartToggleBtn,
                    chartGroupBy === "category" && {
                      backgroundColor: themeColor,
                    },
                  ]}
                  onPress={() => setChartGroupBy("category")}
                >
                  <Text
                    style={[
                      styles.chartToggleText,
                      chartGroupBy === "category" && { color: "#fff" },
                    ]}
                  >
                    項目別
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chartToggleBtn,
                    chartGroupBy === "tag" && { backgroundColor: themeColor },
                  ]}
                  onPress={() => setChartGroupBy("tag")}
                >
                  <Text
                    style={[
                      styles.chartToggleText,
                      chartGroupBy === "tag" && { color: "#fff" },
                    ]}
                  >
                    属性別
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.chartArea}>
                {Object.keys(stats.totals).length > 0 ? (
                  <PieChart
                    data={Object.keys(stats.totals).map((key, index) => ({
                      name: key,
                      population: stats.totals[key],
                      color:
                        chartGroupBy === "layer"
                          ? key === "共通" ? "#8E8E93" : (layerMaster[key] || palette[index % palette.length])
                          : chartGroupBy === "tag"
                            ? tagMaster[key]?.color || "#CCC"
                            : palette[index % palette.length],
                      legendFontColor: "#666",
                      legendFontSize: 11,
                    }))}
                    width={screenWidth * 0.8}
                    height={160}
                    chartConfig={{ color: () => `black` }}
                    accessor={"population"}
                    backgroundColor={"transparent"}
                    paddingLeft={"15"}
                    absolute
                  />
                ) : (
                  <Text style={styles.noDataText}>
                    この条件のデータはありません
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.fullHistoryButton}
                onPress={() => setIsHistoryModalVisible(true)}
              >
                <Text
                  style={[styles.fullHistoryButtonText, { color: themeColor }]}
                >
                  {selectedFilterTag
                    ? `${selectedFilterTag} の履歴を確認`
                    : "全履歴と分析を確認"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.dailyContainer}>
          <View style={[styles.dailyHalf, { width: halfWidth }]}>
            <View style={styles.iconTextRowSmall}>
              <Ionicons name="receipt-outline" size={12} color={themeColor} />
              <Text style={[styles.dailyLabel, { color: themeColor }]}>
                {selectedDate.split("-")[2]}日支出
              </Text>
            </View>
            <Text style={styles.dailyTotalText}>
              ¥{mainStats.dailyTotal.toLocaleString()}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(scheduleData[selectedDate] || [])
                .filter((item) => {
                  if (!item.isExpense) return false;
                  const itemTag =
                    item.tags && item.tags.length > 0
                      ? item.tags[0]
                      : item.tag || "";
                  const itemLayer = tagMaster[itemTag]?.layer || "共通";
                  if (activeTags.length > 0 && !activeTags.includes(itemLayer))
                    return false;
                  return true;
                })
                .map((item) => {
                  const itemTag =
                    item.tags && item.tags.length > 0
                      ? item.tags[0]
                      : item.tag || "";
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.dailyItemRow}
                      onPress={() => handleOpenEdit(item, selectedDate)}
                    >
                      <View style={styles.dailyItemInfo}>
                        <View
                          style={[
                            styles.dailyItemDot,
                            { backgroundColor: item.color },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          {/* 🌟 属性がない場合は「カテゴリー（クイックチップ名）」を太字で表示する */}
                          <Text
                            style={[
                              styles.dailyItemText,
                              { fontWeight: "bold", color: themeColor },
                            ]}
                            numberOfLines={1}
                          >
                            {itemTag || item.category || "未分類"}
                          </Text>
                          {/* 🌟 属性がある場合は、サブテキストにカテゴリーを表示する */}
                          <Text
                            style={{ fontSize: 9, color: "#888" }}
                            numberOfLines={1}
                          >
                            {itemTag ? `${item.category} ` : ""}
                            {item.title !== item.category && (itemTag ? `- ${item.title}` : item.title)}
                          </Text>
                        </View>
                        <Text style={styles.dailyItemAmount}>
                          ¥{item.amount.toLocaleString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>

          <View style={[styles.dailyHalf, { width: halfWidth, padding: 0, borderWidth: 0, backgroundColor: "transparent" }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={halfWidth}
              decelerationRate="fast"
              contentContainerStyle={{ paddingRight: 10 }}
            >
              {displayLayers.map((layer) => {
                const baseColor = layer === "ALL_LAYERS" ? "#8E8E93" : (layerMaster[layer] || themeColor);
                const lightBgColor = baseColor + "15";

                const cardQuickTags = quickMainTags[layer] || quickMainTags["ALL_LAYERS"] || [];
                const cardSubTags = layer === "ALL_LAYERS"
                  ? Object.keys(tagMaster).filter((t) => tagMaster[t].layer === "共通")
                  : Object.keys(tagMaster).filter((t) => tagMaster[t].layer === layer);

                return (
                  <View
                    key={layer}
                    style={[
                      styles.inputCard,
                      { width: halfWidth - 10, backgroundColor: lightBgColor, borderColor: baseColor + "30", borderWidth: 1 }
                    ]}
                  >

                    <View style={styles.inputHeaderRow}>
                      <Text style={[styles.inputCardTitle, { color: baseColor }]}>
                        {layer === "ALL_LAYERS" ? "全体入力（共通出費）" : layer}
                      </Text>
                      <TouchableOpacity onPress={toggleManualMode}>
                        <Ionicons
                          name={isManualInput ? "flash" : "create-outline"}
                          size={16}
                          color={baseColor}
                        />
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[styles.quickInput, { color: baseColor, borderColor: baseColor + "40", borderWidth: 1 }]}
                      placeholder="¥ 0"
                      placeholderTextColor={baseColor + "80"}
                      keyboardType="numeric"
                      value={inputAmount}
                      onChangeText={setInputAmount}
                    />

                    <View style={{ flex: 1, justifyContent: "space-between" }}>
                      <View>
                        <View style={styles.layerQuickChipsGrid}>
                          {cardQuickTags.map((tag, index) => {
                            const isSelected = selectedMainTag === tag;
                            return (
                              <TouchableOpacity
                                key={tag}
                                style={[
                                  styles.layerQuickChip3Col,
                                  {
                                    backgroundColor: isSelected ? baseColor : "#FFF",
                                    borderColor: isSelected ? baseColor : baseColor + "30",
                                  },
                                ]}
                                onPress={() => setSelectedMainTag(tag)}
                                onLongPress={() => handleLongPressQuickTag(index, tag, layer)}
                              >
                                <Text
                                  style={[styles.layerQuickChipText, { color: isSelected ? "#FFF" : baseColor }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                >
                                  {tag}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {isManualInput ? (
                          <View style={{ gap: 4, marginTop: 4 }}>
                            <TextInput
                              style={[styles.smallManualInput, { color: baseColor, borderColor: baseColor + "30", borderWidth: 1 }]}
                              placeholder="属性を手入力"
                              placeholderTextColor={baseColor + "60"}
                              value={manualTag}
                              onChangeText={setManualTag}
                            />
                            <TextInput
                              style={[styles.smallManualInput, { color: baseColor, borderColor: baseColor + "30", borderWidth: 1 }]}
                              placeholder="詳細メモ (任意)"
                              placeholderTextColor={baseColor + "60"}
                              value={manualTitle}
                              onChangeText={setManualTitle}
                            />
                          </View>
                        ) : (
                          <View style={[styles.subTagSection, { borderTopColor: baseColor + "30" }]}>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={styles.subTagScroll}
                            >
                              {cardSubTags.length > 0 ? (
                                cardSubTags.map((sub) => {
                                  const isSelected = selectedSubTag === sub;
                                  return (
                                    <TouchableOpacity
                                      key={sub}
                                      style={[
                                        styles.subChip,
                                        {
                                          backgroundColor: isSelected ? baseColor : "#FFF",
                                          borderColor: isSelected ? baseColor : baseColor + "30",
                                        }
                                      ]}
                                      onPress={() => setSelectedSubTag(sub)}
                                    >
                                      <Text style={[styles.subChipText, { color: isSelected ? "#FFF" : baseColor }]}>
                                        {sub}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })
                              ) : (
                                <Text style={[styles.noSubTagText, { color: baseColor + "80" }]}>
                                  右上の📝から追加(任意)
                                </Text>
                              )}
                            </ScrollView>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[styles.addExecuteBtn, { backgroundColor: baseColor }]}
                        onPress={() => handleAddExpense(layer, baseColor)}
                      >
                        <Ionicons name="checkmark-done" size={20} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      <Modal visible={isHistoryModalVisible} animationType="slide">
        <View style={styles.historyModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderText}>
              {selectedFilterTag
                ? `${selectedFilterTag} の分析`
                : "支出分析レポート"}
            </Text>
            <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
              <Ionicons name="close-circle" size={32} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.analysisCard}>
              <Text style={styles.analysisTitle}>支出推移 (過去6ヶ月)</Text>
              <LineChart
                data={lineChartData}
                width={screenWidth - 40}
                height={160}
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  decimalPlaces: 0,
                  color: () => themeColor,
                  labelColor: () => `#333`,
                  propsForDots: {
                    r: "5",
                    strokeWidth: "2",
                    stroke: themeColor,
                  },
                }}
                bezier
                style={styles.lineChartStyle}
              />
            </View>
            <View style={styles.monthNavigator}>
              <TouchableOpacity
                onPress={() => {
                  const [y, m] = currentModalMonth.split("-").map(Number);
                  const d = new Date(y, m - 2, 1);
                  setCurrentModalMonth(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                  );
                }}
                style={styles.navBtn}
              >
                <Ionicons name="chevron-back" size={24} color={themeColor} />
              </TouchableOpacity>
              <View style={styles.monthDisplay}>
                <Text style={styles.monthDisplayText}>
                  {currentModalMonth.replace("-", "年")}月
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const [y, m] = currentModalMonth.split("-").map(Number);
                  const d = new Date(y, m, 1);
                  setCurrentModalMonth(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                  );
                }}
                style={styles.navBtn}
              >
                <Ionicons name="chevron-forward" size={24} color={themeColor} />
              </TouchableOpacity>
            </View>
            {filteredHistory.map((dayGroup) => (
              <View key={dayGroup.date} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayHeaderText, { color: themeColor }]}>
                    {dayGroup.date.substring(8, 10)}日
                  </Text>
                  <View
                    style={[
                      styles.dayLine,
                      { backgroundColor: `${themeColor}33` },
                    ]}
                  />
                </View>
                {dayGroup.items.map((item) => {
                  const itemTag =
                    item.tags && item.tags.length > 0
                      ? item.tags[0]
                      : item.tag || "";
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.historyRow}
                      onPress={() => handleOpenEdit(item, dayGroup.date)}
                    >
                      <View style={styles.historyLeft}>
                        <View
                          style={[
                            styles.historyDot,
                            { backgroundColor: item.color },
                          ]}
                        />
                        <View>
                          {/* 🌟 属性がない場合は「カテゴリー」をタイトルにする */}
                          <Text style={styles.historyTitle}>
                            {itemTag ? `${itemTag} - ${item.category}` : item.category}
                          </Text>
                          {item.title !== item.category && (
                            <Text style={styles.historyTag}>{item.title}</Text>
                          )}
                        </View>
                      </View>
                      <Text style={styles.historyAmount}>
                        ¥{item.amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={editModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>支出の編集</Text>
            <Text style={styles.settingLabel}>詳細メモ</Text>
            <TextInput
              style={styles.editInputText}
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <Text style={styles.settingLabel}>金額</Text>
            <TextInput
              style={styles.editInputAmount}
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
            />
            <View style={styles.editActionRow}>
              <TouchableOpacity
                onPress={() => {
                  const newData = { ...scheduleData };
                  newData[editingItem!.date] = newData[
                    editingItem!.date
                  ].filter((i) => i.id !== editingItem!.item.id);
                  setScheduleData(newData);
                  setEditModalVisible(false);
                }}
              >
                <Text style={{ color: "#FF3B30", fontWeight: "bold" }}>
                  削除
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: themeColor }]}
                onPress={handleUpdate}
              >
                <Text style={styles.saveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={editQuickTagModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditQuickTagModal(false)}
        >
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>{editingLayer}の項目を編集</Text>
            <TextInput
              style={styles.editInputText}
              value={tempQuickTagText}
              onChangeText={setTempQuickTagText}
              autoFocus
            />
            <View style={[styles.editActionRow, { justifyContent: "center", marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: themeColor, width: "100%", alignItems: "center" }]}
                onPress={saveQuickTag}
              >
                <Text style={styles.saveText}>保存する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", paddingHorizontal: 15 },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 3,
    marginBottom: 15,
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
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  paydayText: { fontSize: 14, fontWeight: "bold" },
  progressSection: { marginBottom: 15 },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 5,
  },
  progressLabel: { fontSize: 11, color: "#999", fontWeight: "bold" },
  progressPercent: { fontSize: 24, fontWeight: "900" },
  progressBarBg: {
    height: 10,
    backgroundColor: "#F2F2F7",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 5 },
  chartArea: { alignItems: "center", marginBottom: 10, marginTop: 10 },
  chartToggleRow: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
  },
  chartToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
  },
  chartToggleText: { fontSize: 11, fontWeight: "bold", color: "#666" },
  noDataText: { color: "#CCC", marginVertical: 30, fontSize: 12 },
  fullHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    marginTop: 10,
  },
  fullHistoryButtonText: { fontWeight: "bold", fontSize: 14 },
  settingArea: { paddingVertical: 5 },
  settingLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
    marginTop: 10,
  },
  settingInput: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  dailyContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    height: 320,
  },
  dailyHalf: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    overflow: "hidden",
  },
  dailyRightBg: { backgroundColor: "#F8FFF9" },
  dailyTotalText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  dailyItemRow: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F2F2F7",
  },
  dailyItemInfo: { flexDirection: "row", alignItems: "center" },
  dailyItemDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  dailyItemText: { fontSize: 11, color: "#555", flex: 1 },
  dailyItemAmount: { fontSize: 11, color: "#333", fontWeight: "600" },

  inputCard: {
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  inputHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  inputCardTitle: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  quickInput: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 8,
    fontSize: 18,
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "bold",
  },

  layerQuickChipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  layerQuickChip3Col: {
    width: "31.5%",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  layerQuickChipText: {
    fontSize: 10,
    fontWeight: "bold",
  },

  subTagSection: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
  },
  subTagScroll: { flexDirection: "row", height: 35 },
  subChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 6,
    height: 28,
    justifyContent: "center",
  },
  subChipText: { fontSize: 10, fontWeight: "bold" },
  noSubTagText: {
    fontSize: 10,
    fontStyle: "italic",
    paddingTop: 5,
  },
  smallManualInput: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    marginBottom: 6,
    textAlign: "center",
    fontWeight: "600",
  },
  addExecuteBtn: {
    marginTop: 5,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  dailyLabel: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  iconTextRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  iconTextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyModalContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  modalHeaderText: { fontSize: 22, fontWeight: "bold", color: "#1C1C1E" },
  modalScroll: { flex: 1, paddingHorizontal: 15 },
  analysisCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
  },
  analysisTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#8E8E93",
    marginBottom: 10,
  },
  lineChartStyle: { marginVertical: 8, borderRadius: 16, paddingRight: 40 },
  monthNavigator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    gap: 15,
  },
  monthDisplay: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  monthDisplayText: { fontSize: 18, fontWeight: "bold", color: "#1C1C1E" },
  navBtn: { backgroundColor: "#fff", padding: 10, borderRadius: 20 },
  dayGroup: { marginBottom: 20 },
  dayHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  dayHeaderText: { fontSize: 16, fontWeight: "bold", marginRight: 10 },
  dayLine: { flex: 1, height: 1 },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 15,
    marginBottom: 8,
  },
  historyLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyTitle: { fontSize: 14, fontWeight: "600", color: "#333" },
  historyTag: { fontSize: 10, color: "#999", marginTop: 2 },
  historyAmount: { fontSize: 14, fontWeight: "bold", color: "#1C1C1E" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
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
  editInputAmount: {
    backgroundColor: "#F2F2F7",
    padding: 15,
    borderRadius: 15,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  editActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  saveBtn: { paddingHorizontal: 25, paddingVertical: 12, borderRadius: 15 },
  saveText: { color: "#fff", fontWeight: "bold" },

  settingHintText: {
    fontSize: 10,
    color: "#8E8E93",
    marginTop: -10,
    marginBottom: 15,
    marginLeft: 4,
  },
});