import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import { useAppStore } from "../store/useAppStore";
import { ScheduleItem } from "../types";

interface Props {
  selectedDate: string;
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
  isSummaryMode?: boolean;
}

export default function MoneyDashboard({
  selectedDate,
  activeTags,
  setHasUnsavedChanges,
  isSummaryMode,
}: Props) {
  // 🌟 引数がスッキリ！

  // 🌟 ここを追加：足りなくなったデータは倉庫（Store）から直接引き出す！
  const {
    scheduleData,
    setScheduleData,
    layerMaster,
    tagMaster,
    setTagMaster,
  } = useAppStore();

  const [dashboardMode, setDashboardMode] = useState<"macro" | "micro">(
    "macro",
  );
  const [isSettingMode, setIsSettingMode] = useState(false);
  const [isManualInput, setIsManualInput] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState<{
    [key: string]: boolean;
  }>({});

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
  const [subTagBudgets, setSubTagBudgets] = useState<{ [key: string]: number }>(
    {},
  );
  const [layerBudgetEnabled, setLayerBudgetEnabled] = useState<{
    [key: string]: boolean;
  }>({});

  const [quickMainTags, setQuickMainTags] = useState<{
    [key: string]: string[];
  }>({
    ALL_LAYERS: ["食費", "交通", "日用品", "交際費", "趣味", "その他"],
  });

  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [currentModalMonth, setCurrentModalMonth] = useState(
    selectedDate.substring(0, 7),
  );
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(
    null,
  );
  const [chartGroupBy, setChartGroupBy] = useState<
    "layer" | "category" | "tag"
  >("layer");
  const [editQuickTagModal, setEditQuickTagModal] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [tempQuickTagText, setTempQuickTagText] = useState("");
  const [editingLayer, setEditingLayer] = useState("ALL_LAYERS");

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    item: ScheduleItem;
    date: string;
  } | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const [showOtherInCharts, setShowOtherInCharts] = useState(true);

  useEffect(() => {
    const load = async () => {
      const val = await AsyncStorage.getItem("showOtherInCharts");
      if (val !== null) setShowOtherInCharts(JSON.parse(val));
    };
    load();
  }, []);

  const isSingleFilter = activeTags.length === 1;
  const currentActiveLayer =
    isSingleFilter && !showOtherInCharts ? activeTags[0] : null;

  const getItemTotalExpense = (item: any) => {
    // 親タスクの金額（ここは予定としてそのまま足す）
    let total = item.isExpense ? item.amount || 0 : 0;

    if (item.subTasks && item.subTasks.length > 0) {
      item.subTasks.forEach((sub: any) => {
        // 🌟 修正：支出設定がON、かつ「完了済み (isDone)」の時だけ足し算する！
        if (sub.isExpense && sub.isDone) {
          total += sub.amount || 0;
        }
      });
    }
    return total;
  };

  const toggleManualMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isManualInput && selectedSubTag) {
      setManualTag(selectedSubTag);
    }
    setIsManualInput(!isManualInput);
  };

  const toggleLayerExpansion = (layer: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const { layerActuals, subTagActuals } = useMemo(() => {
    const lActuals: Record<string, number> = {};
    const sActuals: Record<string, number> = {};
    const monthStr = selectedDate.substring(0, 7);

    Object.keys(scheduleData).forEach((date) => {
      if (date.startsWith(monthStr)) {
        scheduleData[date].forEach((item) => {
          // 🌟 修正：サブタスクの金額も含めて1円でもあれば計上する
          const itemTotal = getItemTotalExpense(item);
          if (itemTotal > 0) {
            const itemTag = item.tags?.[0] || item.tag || "未分類";
            const itemLayer = tagMaster[itemTag]?.layer || itemTag;
            lActuals[itemLayer] = (lActuals[itemLayer] || 0) + itemTotal;
            sActuals[itemTag] = (sActuals[itemTag] || 0) + itemTotal;
          }
        });
      }
    });
    return { layerActuals: lActuals, subTagActuals: sActuals };
  }, [scheduleData, selectedDate, tagMaster]);

  const globalBudgetCalc = useMemo(() => {
    const totalAllocated = Object.keys(layerMaster).reduce((sum, l) => {
      if (layerBudgetEnabled[l] === false) return sum;
      // 🌟 追加：フィルターが効いていて、かつ「その他を表示」がOFFなら計算から除外
      if (
        activeTags.length > 0 &&
        !activeTags.includes(l) &&
        !showOtherInCharts
      )
        return sum;
      return sum + (layerBudgets[l] || 0);
    }, 0);

    let commonActual = 0;
    const isCommonActive =
      activeTags.length === 0 || activeTags.includes("共通");
    // 🌟 変更：共通出費もスイッチと連動させる
    if (
      layerBudgetEnabled["共通"] !== false &&
      (isCommonActive || showOtherInCharts)
    ) {
      commonActual = layerActuals["共通"] || 0;
    }

    const unallocatedBuffer = monthlyBudget - totalAllocated - commonActual;

    return {
      totalAllocated,
      commonActual,
      unallocatedBuffer,
      isOverflow: unallocatedBuffer < 0,
    };
  }, [
    monthlyBudget,
    layerBudgets,
    layerMaster,
    layerBudgetEnabled,
    layerActuals,
    activeTags,
    showOtherInCharts,
  ]);

  const singleLayerBudgetCalc = useMemo(() => {
    if (!currentActiveLayer) return { totalAllocated: 0, unallocatedBuffer: 0 };
    const budget = layerBudgets[currentActiveLayer] || 0;
    const subTags = Object.keys(tagMaster).filter(
      (t) => tagMaster[t].layer === currentActiveLayer,
    );
    const total = subTags.reduce((sum, s) => sum + (subTagBudgets[s] || 0), 0);
    return {
      totalAllocated: total,
      unallocatedBuffer: budget - total,
      isOverflow: budget < total,
    };
  }, [currentActiveLayer, layerBudgets, subTagBudgets, tagMaster]);

  // 🌟 追加：分析バー（積み上げグラフ）用のセグメント計算
  const barSegments = useMemo(() => {
    const segments: { color: string; actual: number; budget: number }[] = [];
    let otherActual = 0;
    let otherBudget = 0;

    const layers = [...Object.keys(layerMaster), "共通"];
    layers.forEach((l) => {
      if (layerBudgetEnabled[l] === false) return;

      const actual = layerActuals[l] || 0;
      const budget = l === "共通" ? 0 : layerBudgets[l] || 0;
      const isMatched = activeTags.length === 0 || activeTags.includes(l);

      if (isMatched) {
        segments.push({
          color: l === "共通" ? "#8E8E93" : layerMaster[l],
          actual,
          budget,
        });
      } else if (showOtherInCharts) {
        otherActual += actual;
        otherBudget += budget;
      }
    });

    if (showOtherInCharts && (otherActual > 0 || otherBudget > 0)) {
      segments.push({
        color: "#C7C7CC",
        actual: otherActual,
        budget: otherBudget,
      });
    }

    return segments;
  }, [
    layerMaster,
    layerActuals,
    layerBudgets,
    activeTags,
    layerBudgetEnabled,
    showOtherInCharts,
  ]);

  useEffect(() => {
    const load = async () => {
      const [b, p, lb, sb, le, q] = await Promise.all([
        AsyncStorage.getItem("myMonthlyBudget"),
        AsyncStorage.getItem("myPayday"),
        AsyncStorage.getItem("layerBudgetsData"),
        AsyncStorage.getItem("subTagBudgetsData"),
        AsyncStorage.getItem("layerBudgetEnabledData"),
        AsyncStorage.getItem("quickMainTagsData"),
      ]);
      if (b) setMonthlyBudget(parseInt(b));
      if (p) setPayday(parseInt(p));
      if (lb) setLayerBudgets(JSON.parse(lb));
      if (sb) setSubTagBudgets(JSON.parse(sb));
      if (le) setLayerBudgetEnabled(JSON.parse(le));
      if (q) setQuickMainTags(JSON.parse(q));
    };
    load();
  }, []);

  const handleLongPressQuickTag = (
    index: number,
    currentText: string,
    targetLayer: string,
  ) => {
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
      newTags[editingLayer] = [
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
    newTags[editingLayer][editingTagIndex] = tempQuickTagText.trim();
    setQuickMainTags(newTags);
    await AsyncStorage.setItem("quickMainTagsData", JSON.stringify(newTags));
    setSelectedMainTag(tempQuickTagText.trim());
    setEditQuickTagModal(false);
  };

  const handleAddExpense = (target: string, color: string) => {
    const amountNum = parseInt(inputAmount);
    if (isNaN(amountNum) || amountNum <= 0)
      return Alert.alert("入力不足", "金額を入力してください。");

    const isAll = target === "ALL_LAYERS";
    let fTag = isManualInput ? manualTag.trim() : selectedSubTag;

    // 🌟 修正：属性が空なら、カテゴリ名ではなく「共通」タグを付与する
    if (!fTag) fTag = isAll ? "共通出費" : target;

    if (fTag && !tagMaster[fTag]) {
      const assignLayer = isAll ? "共通" : target;
      const newTagMaster = {
        ...tagMaster,
        [fTag]: { layer: assignLayer, color: color },
      };
      setTagMaster(newTagMaster);
      AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
    }

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      category: selectedMainTag || "未分類",
      tag: fTag,
      tags: [fTag],
      title: isManualInput && manualTitle ? manualTitle : selectedMainTag,
      amount: amountNum,
      isDone: false,
      color: tagMaster[fTag]?.color || color,
      isEvent: false,
      isTodo: false,
      isExpense: true,
    };

    const newData = {
      ...scheduleData,
      [selectedDate]: [...(scheduleData[selectedDate] || []), newItem],
    };
    setInputAmount("");
    setManualTitle("");
    setManualTag("");
    Keyboard.dismiss();
    setTimeout(() => {
      setScheduleData(newData);
      setHasUnsavedChanges(true);
    }, 100);
  };

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
    setEditModalVisible(false);
    setTimeout(() => {
      setScheduleData(newData);
      setHasUnsavedChanges(true);
    }, 100);
  };

  const getStatsForMonth = (monthStr: string) => {
    let total = 0;
    const totals: { [key: string]: number } = {};

    Object.keys(scheduleData).forEach((date) => {
      if (date.startsWith(monthStr)) {
        scheduleData[date].forEach((item) => {
          const itemTotal = getItemTotalExpense(item);
          if (itemTotal === 0) return;

          const itemTag =
            item.tags && item.tags.length > 0 ? item.tags[0] : item.tag || "";
          const itemLayer = tagMaster[itemTag]?.layer || "共通";

          // 🌟 修正版：「その他」の表示/非表示をスイッチと連動させる
          const isMatch =
            (activeTags.length === 0 || activeTags.includes(itemLayer)) &&
            (!selectedFilterTag || itemTag === selectedFilterTag);

          if (!isMatch) {
            // フィルター対象外の場合、スイッチがONなら「その他」として加算
            if (showOtherInCharts) {
              const groupKey = "その他";
              total += itemTotal;
              totals[groupKey] = (totals[groupKey] || 0) + itemTotal;
            }
            return; // スイッチがOFFなら何もしない（ここでこの予定の処理を終わる）
          }

          // フィルター対象（一致する）場合の通常の集計
          total += itemTotal;
          let groupKey = itemTag;
          if (chartGroupBy === "layer") groupKey = itemLayer;
          else if (chartGroupBy === "category")
            groupKey = item.category || itemTag;
          if (!groupKey) groupKey = item.category || "未分類";

          totals[groupKey] = (totals[groupKey] || 0) + itemTotal;
        });
      }
    });
    return { total, totals };
  };

  const lineChartData = useMemo(() => {
    // 🌟 修正：モーダルが閉じていても、空配列を返さずに0で埋めた配列を作る
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
    let dTotal = 0;
    (scheduleData[selectedDate] || []).forEach((item) => {
      const itemTotal = getItemTotalExpense(item);
      if (itemTotal === 0) return; // 🌟 変更

      const itemTag =
        item.tags && item.tags.length > 0 ? item.tags[0] : item.tag || "";
      const itemLayer = tagMaster[itemTag]?.layer || "共通";
      if (activeTags.length > 0 && !activeTags.includes(itemLayer)) return;

      dTotal += itemTotal; // 🌟 変更
    });
    return { dailyTotal: dTotal };
  }, [selectedDate, scheduleData, activeTags, tagMaster]);

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
    if (!isHistoryModalVisible) return [];
    const days: { date: string; items: ScheduleItem[] }[] = [];
    Object.keys(scheduleData)
      .filter((d) => d.startsWith(currentModalMonth))
      .sort((a, b) => b.localeCompare(a))
      .forEach((date) => {
        const items = scheduleData[date].filter((item) => {
          if (getItemTotalExpense(item) === 0) return false; // 🌟 合算額が0なら表示しない
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
  }, [
    scheduleData,
    currentModalMonth,
    activeTags,
    selectedFilterTag,
    isHistoryModalVisible,
  ]);

  const screenWidth = Dimensions.get("window").width;

  // はみ出し修正：正確なコンテナ幅の計算
  const containerWidth = screenWidth - 30; // paddingHorizontal: 15 * 2
  const exactCardWidth = containerWidth * 0.55;

  const themeColor = currentActiveLayer
    ? layerMaster[currentActiveLayer]
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
  const displayLayers = useMemo(
    () =>
      activeTags.length > 0
        ? activeTags
        : ["ALL_LAYERS", ...Object.keys(layerMaster)],
    [activeTags, layerMaster],
  );

  const activeLimit =
    currentActiveLayer && layerBudgets[currentActiveLayer]
      ? layerBudgets[currentActiveLayer]
      : monthlyBudget;
  const progress = Math.min(stats.total / (activeLimit || 1), 1);
  const statusColor = stats.total > activeLimit ? "#FF3B30" : themeColor;

  return (
    <View style={styles.container}>
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
            <ScrollView
              style={styles.settingArea}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.settingLabel}>給料日指定</Text>
              <TextInput
                style={styles.settingInput}
                keyboardType="numeric"
                value={payday.toString()}
                onChangeText={(t) => {
                  setPayday(parseInt(t) || 25);
                  AsyncStorage.setItem("myPayday", t);
                }}
              />
              <View style={styles.settingSwitchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingSwitchLabel}>
                    フィルター外を「その他」で表示
                  </Text>
                  <Text style={{ fontSize: 10, color: "#8E8E93" }}>
                    オフにするとフィルター中の支出のみが集計されます
                  </Text>
                </View>
                <Switch
                  value={showOtherInCharts}
                  onValueChange={(v) => {
                    setShowOtherInCharts(v);
                    AsyncStorage.setItem(
                      "showOtherInCharts",
                      JSON.stringify(v),
                    );
                    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // ←必要ならHapticsも
                  }}
                  trackColor={{ false: "#E5E5EA", true: themeColor }}
                />
              </View>

              <View style={styles.divider} />
              <Text style={[styles.settingLabel, { marginTop: 10 }]}>
                予算スライダーの表示切替
              </Text>
              {[...Object.keys(layerMaster), "共通"].map((l) => (
                <View key={l} style={styles.settingSwitchRow}>
                  <Text style={styles.settingSwitchLabel}>{l}</Text>
                  <Switch
                    value={layerBudgetEnabled[l] !== false}
                    onValueChange={(v) => {
                      const n = { ...layerBudgetEnabled, [l]: v };
                      setLayerBudgetEnabled(n);
                      AsyncStorage.setItem(
                        "layerBudgetEnabledData",
                        JSON.stringify(n),
                      );
                    }}
                    trackColor={{
                      false: "#E5E5EA",
                      true: layerMaster[l] || "#8E8E93",
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <>
              <View style={styles.dashboardToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.dashToggleBtn,
                    dashboardMode === "macro" && {
                      backgroundColor: themeColor,
                    },
                  ]}
                  onPress={() => setDashboardMode("macro")}
                >
                  <Text
                    style={[
                      styles.dashToggleText,
                      dashboardMode === "macro" && { color: "#FFF" },
                    ]}
                  >
                    実績俯瞰
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dashToggleBtn,
                    dashboardMode === "micro" && {
                      backgroundColor: themeColor,
                    },
                  ]}
                  onPress={() => setDashboardMode("micro")}
                >
                  <Text
                    style={[
                      styles.dashToggleText,
                      dashboardMode === "micro" && { color: "#FFF" },
                    ]}
                  >
                    予算調整
                  </Text>
                </TouchableOpacity>
              </View>

              {dashboardMode === "macro" ? (
                <ScrollView
                  style={styles.macroArea}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>
                        {selectedFilterTag
                          ? `${selectedFilterTag} の総額`
                          : activeTags.length > 0
                            ? "選択中の進捗（その他を含む）"
                            : "今月の総支出"}
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
                        chartGroupBy === "layer" && {
                          backgroundColor: themeColor,
                        },
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
                        chartGroupBy === "tag" && {
                          backgroundColor: themeColor,
                        },
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
                            key === "その他"
                              ? "#C7C7CC" // 🌟 追加：「その他」はグレーで固定
                              : chartGroupBy === "layer"
                                ? key === "共通"
                                  ? "#8E8E93"
                                  : layerMaster[key] ||
                                    palette[index % palette.length]
                                : tagMaster[key]?.color ||
                                  palette[index % palette.length],
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
                      <Text style={styles.noDataText}>データがありません</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.historyOpenBtn, { borderColor: themeColor }]}
                    onPress={() => setIsHistoryModalVisible(true)}
                  >
                    <Ionicons name="analytics" size={18} color={themeColor} />
                    <Text
                      style={[styles.historyOpenBtnText, { color: themeColor }]}
                    >
                      支出推移と履歴レポートを見る
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <ScrollView
                  style={styles.microArea}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {!currentActiveLayer ? (
                    // 🌍 GLOBAL モード
                    <>
                      <View style={styles.masterBudgetHeader}>
                        <Text style={styles.masterTitle}>
                          全体予算 (ALL LAYERS)
                        </Text>
                        <View style={styles.masterInputWrapper}>
                          <Text style={styles.currencySymbol}>¥</Text>
                          <TextInput
                            style={styles.masterBudgetInput}
                            keyboardType="numeric"
                            value={monthlyBudget.toString()}
                            onChangeText={(t) => {
                              setMonthlyBudget(parseInt(t) || 0);
                              AsyncStorage.setItem("myMonthlyBudget", t);
                            }}
                          />
                        </View>
                      </View>
                      <View style={styles.masterStackContainer}>
                        <View
                          style={[styles.masterStackLayer, { opacity: 0.2 }]}
                        >
                          {barSegments.map((seg, idx) => (
                            <View
                              key={`bg-${idx}`}
                              style={{
                                width: `${(seg.budget / (monthlyBudget || 1)) * 100}%`,
                                height: "100%",
                                backgroundColor: seg.color,
                              }}
                            />
                          ))}
                        </View>
                        <View style={styles.masterStackLayer}>
                          {barSegments.map((seg, idx) => (
                            <View
                              key={`fg-${idx}`}
                              style={{
                                width: `${(seg.actual / (monthlyBudget || 1)) * 100}%`,
                                height: "100%",
                                backgroundColor: seg.color,
                                borderRightWidth: 1,
                                borderColor: "#FFF",
                              }}
                            />
                          ))}
                        </View>
                      </View>
                      <View style={styles.masterProgressLabelRow}>
                        <Text style={{ fontSize: 11, color: "#666" }}>
                          割当: ¥
                          {globalBudgetCalc.totalAllocated.toLocaleString()} /
                          共通: ¥
                          {globalBudgetCalc.commonActual.toLocaleString()}
                        </Text>
                        {globalBudgetCalc.isOverflow ? (
                          <View style={styles.warningBadge}>
                            <Ionicons
                              name="alert-circle"
                              size={14}
                              color="#FF3B30"
                            />
                            <Text style={styles.warningText}>
                              超過: ¥
                              {Math.abs(
                                globalBudgetCalc.unallocatedBuffer,
                              ).toLocaleString()}
                            </Text>
                          </View>
                        ) : (
                          <Text
                            style={{
                              fontSize: 12,
                              color: "#34C759",
                              fontWeight: "bold",
                            }}
                          >
                            残り枠: ¥
                            {globalBudgetCalc.unallocatedBuffer.toLocaleString()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.divider} />

                      {Object.keys(layerMaster).map((l) => {
                        if (layerBudgetEnabled[l] === false) return null;
                        if (activeTags.length > 0 && !activeTags.includes(l))
                          return null;
                        const b = layerBudgets[l] || 0;
                        const a = layerActuals[l] || 0;
                        const color = layerMaster[l];
                        const limit =
                          b + Math.max(0, globalBudgetCalc.unallocatedBuffer);
                        const layerSubTags = Object.keys(tagMaster).filter(
                          (t) => tagMaster[t].layer === l,
                        );

                        return (
                          <View key={l} style={styles.sliderCard}>
                            <TouchableOpacity
                              style={styles.sliderHeader}
                              onPress={() => toggleLayerExpansion(l)}
                              activeOpacity={0.7}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    fontWeight: "bold",
                                    color,
                                    fontSize: 16,
                                  }}
                                >
                                  {l}
                                </Text>
                                {layerSubTags.length > 0 && (
                                  <Ionicons
                                    name={
                                      expandedLayers[l]
                                        ? "chevron-down"
                                        : "chevron-forward"
                                    }
                                    size={16}
                                    color={color}
                                    style={{ marginLeft: 4 }}
                                  />
                                )}
                              </View>
                              <Text style={styles.sliderSubText}>
                                実績 ¥{a.toLocaleString()} / 予算 ¥
                                {b.toLocaleString()}
                              </Text>
                            </TouchableOpacity>
                            <View style={styles.absoluteScaleBar}>
                              <View
                                style={{
                                  position: "absolute",
                                  width: `${Math.min(limit / (monthlyBudget || 1), 1) * 100}%`,
                                  height: "100%",
                                  backgroundColor: color + "1A",
                                }}
                              />
                              <View
                                style={{
                                  position: "absolute",
                                  width: `${Math.min(b / (monthlyBudget || 1), 1) * 100}%`,
                                  height: "100%",
                                  backgroundColor: color + "3A",
                                }}
                              />
                              <View
                                style={{
                                  position: "absolute",
                                  width: `${Math.min(a / (monthlyBudget || 1), 1) * 100}%`,
                                  height: "100%",
                                  backgroundColor: a > b ? "#FF3B30" : color,
                                }}
                              />
                            </View>
                            <Slider
                              style={{ height: 40 }}
                              minimumValue={0}
                              maximumValue={monthlyBudget}
                              step={1000}
                              value={b}
                              thumbTintColor={color}
                              minimumTrackTintColor="transparent"
                              maximumTrackTintColor="transparent"
                              onValueChange={(val) => {
                                const n = { ...layerBudgets, [l]: val };
                                setLayerBudgets(n);
                                AsyncStorage.setItem(
                                  "layerBudgetsData",
                                  JSON.stringify(n),
                                );
                              }}
                            />

                            {expandedLayers[l] &&
                              layerSubTags.map((sub) => {
                                const sb = subTagBudgets[sub] || 0;
                                const sa = subTagActuals[sub] || 0;
                                const sc = tagMaster[sub]?.color || color;
                                const validLayerB = b || 1;
                                const layerUnallocated =
                                  b -
                                  layerSubTags.reduce(
                                    (s, t) => s + (subTagBudgets[t] || 0),
                                    0,
                                  );
                                const slimit =
                                  sb + Math.max(0, layerUnallocated);

                                return (
                                  <View
                                    key={sub}
                                    style={styles.subTagAdjustRow}
                                  >
                                    <View style={styles.subTagHeader}>
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          color: "#555",
                                          fontWeight: "bold",
                                        }}
                                      >
                                        ↳ {sub}
                                      </Text>
                                      <Text
                                        style={{ fontSize: 10, color: "#888" }}
                                      >
                                        ¥{sa.toLocaleString()} / ¥
                                        {sb.toLocaleString()}
                                      </Text>
                                    </View>
                                    <View
                                      style={[
                                        styles.absoluteScaleBar,
                                        { height: 8, borderRadius: 4 },
                                      ]}
                                    >
                                      <View
                                        style={{
                                          position: "absolute",
                                          width: `${Math.min(slimit / validLayerB, 1) * 100}%`,
                                          height: "100%",
                                          backgroundColor: sc + "1A",
                                        }}
                                      />
                                      <View
                                        style={{
                                          position: "absolute",
                                          width: `${Math.min(sb / validLayerB, 1) * 100}%`,
                                          height: "100%",
                                          backgroundColor: sc + "3A",
                                        }}
                                      />
                                      <View
                                        style={{
                                          position: "absolute",
                                          width: `${Math.min(sa / validLayerB, 1) * 100}%`,
                                          height: "100%",
                                          backgroundColor:
                                            sa > sb ? "#FF3B30" : sc,
                                        }}
                                      />
                                    </View>
                                    <Slider
                                      style={{
                                        width: "100%",
                                        height: 25,
                                        marginTop: 2,
                                      }}
                                      minimumValue={0}
                                      maximumValue={validLayerB}
                                      step={500}
                                      value={sb}
                                      minimumTrackTintColor="transparent"
                                      maximumTrackTintColor="transparent"
                                      thumbTintColor={sc}
                                      onValueChange={(val) => {
                                        const n = {
                                          ...subTagBudgets,
                                          [sub]: val,
                                        };
                                        setSubTagBudgets(n);
                                        AsyncStorage.setItem(
                                          "subTagBudgetsData",
                                          JSON.stringify(n),
                                        );
                                      }}
                                    />
                                  </View>
                                );
                              })}
                          </View>
                        );
                      })}

                      {/* 🌟 2. 共通出費枠（フィルターに「共通」が含まれている、またはフィルターなしの時だけ個別表示） */}
                      {layerBudgetEnabled["共通"] !== false &&
                        (activeTags.length === 0 ||
                          activeTags.includes("共通")) &&
                        (() => {
                          const a = layerActuals["共通"] || 0;
                          const validMaster = monthlyBudget || 1;

                          return (
                            <View style={styles.sliderCard}>
                              <View style={styles.sliderHeader}>
                                <Text
                                  style={{
                                    fontWeight: "bold",
                                    color: "#8E8E93",
                                    fontSize: 16,
                                  }}
                                >
                                  共通出費 (未分類)
                                </Text>
                                <Text style={styles.sliderSubText}>
                                  実績 ¥{a.toLocaleString()}
                                </Text>
                              </View>
                              <View style={styles.absoluteScaleBar}>
                                <View
                                  style={{
                                    position: "absolute",
                                    width: `${Math.min(a / validMaster, 1) * 100}%`,
                                    height: "100%",
                                    backgroundColor: "#8E8E93",
                                  }}
                                />
                              </View>
                            </View>
                          );
                        })()}

                      {/* 🌟 3. 「その他」スライダー（スイッチON ＆ フィルター適用中のみ表示） */}
                      {showOtherInCharts &&
                        activeTags.length > 0 &&
                        (() => {
                          let otherBudget = 0;
                          let otherActual = 0;

                          // フィルターに含まれていないレイヤー（と共通出費）をすべて合算してぶち込む！
                          [...Object.keys(layerMaster), "共通"].forEach((l) => {
                            if (
                              !activeTags.includes(l) &&
                              layerBudgetEnabled[l] !== false
                            ) {
                              otherBudget +=
                                l === "共通" ? 0 : layerBudgets[l] || 0;
                              otherActual += layerActuals[l] || 0;
                            }
                          });

                          const isOver =
                            otherActual > otherBudget && otherBudget > 0;
                          const validMaster = monthlyBudget || 1;

                          return (
                            <View style={styles.sliderCard}>
                              <View style={styles.sliderHeader}>
                                <Text
                                  style={{
                                    fontWeight: "bold",
                                    color: "#8E8E93",
                                    fontSize: 16,
                                  }}
                                >
                                  その他
                                </Text>
                                <Text style={styles.sliderSubText}>
                                  実績 ¥{otherActual.toLocaleString()} / 予算 ¥
                                  {otherBudget.toLocaleString()}
                                </Text>
                              </View>
                              <View style={styles.absoluteScaleBar}>
                                <View
                                  style={{
                                    position: "absolute",
                                    width: `${Math.min(otherActual / validMaster, 1) * 100}%`,
                                    height: "100%",
                                    backgroundColor: isOver
                                      ? "#FF3B30"
                                      : "#C7C7CC",
                                  }}
                                />
                              </View>
                            </View>
                          );
                        })()}
                    </>
                  ) : (
                    /* --- シングルレイヤーモード --- */
                    <>
                      <View style={styles.masterBudgetHeader}>
                        <Text style={styles.masterTitle}>
                          {currentActiveLayer} 予算
                        </Text>
                        <View style={styles.masterInputWrapper}>
                          <Text style={styles.currencySymbol}>¥</Text>
                          <TextInput
                            style={styles.masterBudgetInput}
                            keyboardType="numeric"
                            value={(
                              layerBudgets[currentActiveLayer!] || 0
                            ).toString()}
                            onChangeText={(t) => {
                              const n = {
                                ...layerBudgets,
                                [currentActiveLayer!]: parseInt(t) || 0,
                              };
                              setLayerBudgets(n);
                              AsyncStorage.setItem(
                                "layerBudgetsData",
                                JSON.stringify(n),
                              );
                            }}
                          />
                        </View>
                      </View>

                      {(() => {
                        const layerSubTags = Object.keys(tagMaster).filter(
                          (t) => tagMaster[t].layer === currentActiveLayer,
                        );
                        const layerBudget =
                          layerBudgets[currentActiveLayer!] || 0;
                        const validB = layerBudget || 1;

                        return (
                          <>
                            <View style={styles.masterStackContainer}>
                              <View
                                style={[
                                  styles.masterStackLayer,
                                  { opacity: 0.2 },
                                ]}
                              >
                                {layerSubTags.map((sub) => (
                                  <View
                                    key={`bg-${sub}`}
                                    style={{
                                      width: `${((subTagBudgets[sub] || 0) / validB) * 100}%`,
                                      height: "100%",
                                      backgroundColor:
                                        tagMaster[sub]?.color || themeColor,
                                    }}
                                  />
                                ))}
                              </View>
                              <View style={styles.masterStackLayer}>
                                {layerSubTags.map((sub) => (
                                  <View
                                    key={`fg-${sub}`}
                                    style={{
                                      width: `${((subTagActuals[sub] || 0) / validB) * 100}%`,
                                      height: "100%",
                                      backgroundColor:
                                        tagMaster[sub]?.color || themeColor,
                                      borderRightWidth: 1,
                                      borderColor: "#FFF",
                                    }}
                                  />
                                ))}
                              </View>
                            </View>

                            <View style={styles.masterProgressLabelRow}>
                              <Text style={{ fontSize: 11, color: "#666" }}>
                                割当済み: ¥
                                {singleLayerBudgetCalc.totalAllocated.toLocaleString()}
                              </Text>
                              {singleLayerBudgetCalc.isOverflow ? (
                                <View style={styles.warningBadge}>
                                  <Ionicons
                                    name="alert-circle"
                                    size={14}
                                    color="#FF3B30"
                                  />
                                  <Text style={styles.warningText}>
                                    超過: ¥
                                    {Math.abs(
                                      singleLayerBudgetCalc.unallocatedBuffer,
                                    ).toLocaleString()}
                                  </Text>
                                </View>
                              ) : (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: themeColor,
                                    fontWeight: "bold",
                                  }}
                                >
                                  残り枠: ¥
                                  {singleLayerBudgetCalc.unallocatedBuffer.toLocaleString()}
                                </Text>
                              )}
                            </View>

                            <View style={styles.divider} />

                            {layerSubTags.length === 0 ? (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: "#999",
                                  marginTop: 10,
                                }}
                              >
                                サブタグを登録してリソースを最適化しましょう。
                              </Text>
                            ) : (
                              layerSubTags.map((sub) => {
                                const sb = subTagBudgets[sub] || 0;
                                const sa = subTagActuals[sub] || 0;
                                const sc = tagMaster[sub]?.color || themeColor;
                                const slimit =
                                  sb +
                                  Math.max(
                                    0,
                                    singleLayerBudgetCalc.unallocatedBuffer,
                                  );
                                const isOver = sa > sb;

                                return (
                                  <View key={sub} style={styles.sliderCard}>
                                    <View style={styles.sliderHeader}>
                                      <Text
                                        style={{
                                          fontWeight: "bold",
                                          color: "#333",
                                          fontSize: 15,
                                        }}
                                      >
                                        {sub}
                                      </Text>
                                      <Text style={styles.sliderSubText}>
                                        実績 ¥{sa.toLocaleString()} / 予算 ¥
                                        {sb.toLocaleString()}
                                      </Text>
                                    </View>

                                    <View
                                      style={[
                                        styles.absoluteScaleBar,
                                        { height: 10, borderRadius: 5 },
                                      ]}
                                    >
                                      <View
                                        style={{
                                          position: "absolute",
                                          width: `${Math.min(slimit / validB, 1) * 100}%`,
                                          height: "100%",
                                          backgroundColor: sc + "1A",
                                        }}
                                      />
                                      <View
                                        style={{
                                          position: "absolute",
                                          width: `${Math.min(sb / validB, 1) * 100}%`,
                                          height: "100%",
                                          backgroundColor: sc + "3A",
                                        }}
                                      />
                                      <View
                                        style={{
                                          position: "absolute",
                                          width: `${Math.min(sa / validB, 1) * 100}%`,
                                          height: "100%",
                                          backgroundColor: isOver
                                            ? "#FF3B30"
                                            : sc,
                                        }}
                                      />
                                    </View>

                                    <Slider
                                      style={{
                                        width: "100%",
                                        height: 35,
                                        marginTop: 5,
                                      }}
                                      minimumValue={0}
                                      maximumValue={layerBudget}
                                      step={500}
                                      value={sb}
                                      minimumTrackTintColor="transparent"
                                      maximumTrackTintColor="transparent"
                                      thumbTintColor={sc}
                                      onValueChange={(val) => {
                                        const n = {
                                          ...subTagBudgets,
                                          [sub]: val,
                                        };
                                        setSubTagBudgets(n);
                                        AsyncStorage.setItem(
                                          "subTagBudgetsData",
                                          JSON.stringify(n),
                                        );
                                      }}
                                    />
                                  </View>
                                );
                              })
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </ScrollView>
              )}
            </>
          )}
        </View>
      ) : (
        /* --- 日別詳細モード --- */
        <View style={styles.dailyContainer}>
          {/* 🌟 修正：左半分のコンテナに width を明示 */}
          <View style={[styles.dailyLeft, { width: "35%" }]}>
            <View style={styles.iconTextRowSmall}>
              <Ionicons name="receipt-outline" size={12} color={themeColor} />
              <Text style={[styles.dailyLabel, { color: themeColor }]}>
                {selectedDate.split("-")[2]}日支出
              </Text>
            </View>
            <Text style={styles.dailyTotalText}>
              ¥{mainStats.dailyTotal.toLocaleString()}
            </Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(scheduleData[selectedDate] || [])
                .filter((i) => getItemTotalExpense(i) > 0)
                .map((i) => {
                  const itemTag =
                    i.tags && i.tags.length > 0 ? i.tags[0] : i.tag || "";
                  const itemLayer = tagMaster[itemTag]?.layer || "共通";
                  if (activeTags.length > 0 && !activeTags.includes(itemLayer))
                    return null;
                  return (
                    <TouchableOpacity
                      key={i.id}
                      style={styles.dailyItemRow}
                      onPress={() => handleOpenEdit(i, selectedDate)}
                    >
                      <View style={styles.dailyItemInfo}>
                        <View
                          style={[
                            styles.dailyItemDot,
                            { backgroundColor: i.color },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontWeight: "bold",
                              fontSize: 11,
                              color: themeColor,
                            }}
                            numberOfLines={1}
                          >
                            {itemTag || i.category}
                          </Text>
                          <Text
                            style={{ fontSize: 9, color: "#888" }}
                            numberOfLines={1}
                          >
                            {i.title !== i.category && i.title}
                          </Text>
                        </View>
                        <Text style={styles.dailyItemAmount}>
                          ¥{i.amount.toLocaleString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>

          <View style={{ width: "3%" }} />

          <View style={[styles.dailyRight, { flex: 1 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={exactCardWidth + 10}
              decelerationRate="fast"
              contentContainerStyle={{ paddingRight: 10 }}
              keyboardShouldPersistTaps="handled"
            >
              {displayLayers.map((l) => {
                const c =
                  l === "ALL_LAYERS" ? "#8E8E93" : layerMaster[l] || themeColor;
                const isAll = l === "ALL_LAYERS";
                const qTags =
                  quickMainTags[l] || quickMainTags["ALL_LAYERS"] || [];
                const sTags = isAll
                  ? Object.keys(tagMaster).filter(
                      (t) => tagMaster[t].layer === "共通",
                    )
                  : Object.keys(tagMaster).filter(
                      (t) => tagMaster[t].layer === l,
                    );

                return (
                  <View
                    key={l}
                    style={[
                      styles.inputCard,
                      {
                        width: exactCardWidth,
                        backgroundColor: c + "15",
                        borderColor: c + "30",
                      },
                    ]}
                  >
                    <View style={styles.inputHeaderRow}>
                      <Text style={[styles.inputCardTitle, { color: c }]}>
                        {isAll ? "全体/共通" : l}
                      </Text>
                      {!isAll && (
                        <TouchableOpacity onPress={toggleManualMode}>
                          <Ionicons
                            name={isManualInput ? "flash" : "create-outline"}
                            size={16}
                            color={c}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View
                      style={[
                        styles.modernInputWrapper,
                        { borderColor: c + "30", backgroundColor: "#FFF" },
                      ]}
                    >
                      <Text style={[styles.modernCurrency, { color: c }]}>
                        ¥
                      </Text>
                      <TextInput
                        style={[styles.modernQuickInput, { color: c }]}
                        placeholder="0"
                        placeholderTextColor={c + "40"}
                        keyboardType="numeric"
                        value={inputAmount}
                        onChangeText={setInputAmount}
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: "space-between" }}>
                      <View>
                        {isAll || isManualInput ? (
                          <View style={{ gap: 4, marginTop: 4 }}>
                            <TextInput
                              style={[
                                styles.smallManualInput,
                                {
                                  color: c,
                                  borderColor: c + "30",
                                  borderWidth: 1,
                                },
                              ]}
                              placeholder={
                                isAll
                                  ? "属性(空欄でカテゴリ)"
                                  : "属性(空欄でレイヤー名)"
                              }
                              placeholderTextColor={c + "60"}
                              value={manualTag}
                              onChangeText={setManualTag}
                            />
                            <TextInput
                              style={[
                                styles.smallManualInput,
                                {
                                  color: c,
                                  borderColor: c + "30",
                                  borderWidth: 1,
                                },
                              ]}
                              placeholder="詳細メモ (任意)"
                              placeholderTextColor={c + "60"}
                              value={manualTitle}
                              onChangeText={setManualTitle}
                            />
                          </View>
                        ) : (
                          <>
                            <View style={styles.layerQuickChipsGrid}>
                              {qTags.map((tag, idx) => (
                                <TouchableOpacity
                                  key={tag}
                                  style={[
                                    styles.layerQuickChip3Col,
                                    {
                                      backgroundColor:
                                        selectedMainTag === tag ? c : "#FFF",
                                      borderColor:
                                        selectedMainTag === tag ? c : c + "30",
                                    },
                                  ]}
                                  onPress={() => setSelectedMainTag(tag)}
                                  onLongPress={() =>
                                    handleLongPressQuickTag(idx, tag, l)
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.layerQuickChipText,
                                      {
                                        color:
                                          selectedMainTag === tag ? "#FFF" : c,
                                      },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {tag}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            <View
                              style={[
                                styles.subTagSection,
                                { borderTopColor: c + "30" },
                              ]}
                            >
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.subTagScroll}
                                keyboardShouldPersistTaps="handled"
                              >
                                {sTags.length > 0 ? (
                                  sTags.map((sub) => (
                                    <TouchableOpacity
                                      key={sub}
                                      style={[
                                        styles.subChip,
                                        {
                                          backgroundColor:
                                            selectedSubTag === sub ? c : "#FFF",
                                          borderColor:
                                            selectedSubTag === sub
                                              ? c
                                              : c + "30",
                                        },
                                      ]}
                                      onPress={() => setSelectedSubTag(sub)}
                                    >
                                      <Text
                                        style={[
                                          styles.subChipText,
                                          {
                                            color:
                                              selectedSubTag === sub
                                                ? "#FFF"
                                                : c,
                                          },
                                        ]}
                                      >
                                        {sub}
                                      </Text>
                                    </TouchableOpacity>
                                  ))
                                ) : (
                                  <Text
                                    style={[
                                      styles.noSubTagText,
                                      { color: c + "80" },
                                    ]}
                                  >
                                    📝から属性追加
                                  </Text>
                                )}
                              </ScrollView>
                            </View>
                          </>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.addExecuteBtn, { backgroundColor: c }]}
                        onPress={() => handleAddExpense(l, c)}
                      >
                        <Ionicons
                          name="checkmark-done"
                          size={20}
                          color="#FFF"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* --- モーダル群 --- */}
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
              {/* 🌟 修正：データが2つ以上ある時だけグラフを描画し、クラッシュを防ぐ */}
              {lineChartData.datasets[0].data.length > 1 ? (
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
              ) : (
                <Text style={styles.noDataText}>データがありません</Text>
              )}
            </View>
            {/* 履歴リスト */}
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
                          <Text style={styles.historyTitle}>
                            {itemTag
                              ? `${itemTag} - ${item.category}`
                              : item.category}
                          </Text>
                          {item.title !== item.category && (
                            <Text style={styles.historyTag}>{item.title}</Text>
                          )}
                        </View>
                      </View>
                      <Text style={styles.historyAmount}>
                        ¥{getItemTotalExpense(item).toLocaleString()}{" "}
                        {/* 🌟 変更 */}
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
            <View
              style={[
                styles.editActionRow,
                { justifyContent: "center", marginTop: 10 },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: themeColor,
                    width: "100%",
                    alignItems: "center",
                  },
                ]}
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
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    flex: 1,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  paydayText: { fontSize: 14, fontWeight: "bold" },
  dashboardToggleRow: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    padding: 3,
    marginBottom: 15,
  },
  dashToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  dashToggleText: { fontSize: 12, fontWeight: "bold", color: "#8E8E93" },

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
  settingSwitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  settingSwitchLabel: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  settingHintText: {
    fontSize: 10,
    color: "#8E8E93",
    marginTop: -10,
    marginBottom: 15,
    marginLeft: 4,
  },

  masterBudgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  masterInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 120,
  },
  currencySymbol: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "bold",
    marginRight: 4,
  },
  masterTitle: { fontWeight: "bold", fontSize: 16, color: "#1C1C1E" },
  masterBudgetInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
    color: "#1C1C1E",
    textAlign: "right",
  },
  masterStackContainer: {
    height: 16,
    backgroundColor: "#E5E5EA",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    marginBottom: 10,
  },
  masterStackLayer: {
    flexDirection: "row",
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    width: "100%",
  },
  masterProgressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  sliderCard: { marginBottom: 15 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    alignItems: "center",
  },
  sliderSubText: { fontSize: 11, color: "#999" },
  absoluteScaleBar: {
    height: 12,
    width: "100%",
    backgroundColor: "#F8F8FA",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },

  // 🌟 width: "100%" を追加
  dailyContainer: {
    flexDirection: "row",
    height: 320,
    //gap: 10,
    width: "100%",
    justifyContent: "space-between",
  },

  dailyLeft: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    overflow: "hidden",
  },

  dailyRight: { backgroundColor: "transparent", overflow: "hidden" },

  // 🌟 justifyContent を追加
  inputCard: {
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    height: "100%",
    marginRight: 10,
    justifyContent: "space-between",
  },
  quickInput: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 8,
    fontSize: 18,
    textAlign: "center",
    marginVertical: 10,
    fontWeight: "bold",
  },
  addBtn: { paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  dailyItemDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  dailyItemRow: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F2F2F7",
  },
  dailyItemInfo: { flexDirection: "row", alignItems: "center" },

  subTagBudgetArea: {
    marginTop: 10,
    paddingLeft: 15,
    borderLeftWidth: 2,
    borderLeftColor: "#F2F2F7",
    marginLeft: 5,
  },
  subTagAdjustRow: { marginBottom: 10 },
  subTagHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  warningText: {
    fontSize: 12,
    color: "#FF3B30",
    fontWeight: "bold",
    marginLeft: 4,
  },
  iconTextRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  dailyLabel: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  dailyTotalText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  dailyItemText: { fontSize: 11, color: "#555", flex: 1 },
  dailyItemAmount: { fontSize: 11, color: "#333", fontWeight: "600" },
  inputHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  inputCardTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },

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
  iconTextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  divider: { height: 1, backgroundColor: "#F2F2F7", marginBottom: 15 },
  progressSection: { marginBottom: 15, marginTop: 10 },
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
  chartArea: { alignItems: "center", marginBottom: 10, marginTop: 10 },
  noDataText: {
    color: "#CCC",
    marginVertical: 30,
    fontSize: 12,
    textAlign: "center",
  },
  macroArea: { width: "100%" },
  microArea: { width: "100%" },
  layerQuickChipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },

  layerQuickChipText: { fontSize: 10, fontWeight: "bold" },
  subTagSection: { borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
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
  noSubTagText: { fontSize: 10, fontStyle: "italic", paddingTop: 5 },
  smallManualInput: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    marginBottom: 6,
    textAlign: "center",
    fontWeight: "600",
  },

  historyOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 15,
    marginTop: 5,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  historyOpenBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    marginLeft: 8,
  },
  modernInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    marginVertical: 10,
    height: 48,
  },
  modernCurrency: {
    fontSize: 18,
    fontWeight: "900",
    marginRight: 4,
  },
  modernQuickInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
  },

  // 🌟 実行ボタンをおしゃれに（少し浮かせる）
  addExecuteBtn: {
    marginTop: 8,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // 🌟 クイックチップのデザイン微調整
  layerQuickChip3Col: {
    width: "31.5%",
    height: 36, // 高さを揃える
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
