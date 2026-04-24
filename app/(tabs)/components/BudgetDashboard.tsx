import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import { useAppStore } from "../store/useAppStore";
import { ScheduleItem } from "../types";
import { CHART_PALETTE, getItemTotalExpense, getItemTotalIncome, PRESET_COLORS } from "../utils/helpers";

interface BudgetDashboardProps {
  selectedDate: string;
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
}

export default function BudgetDashboard({
  selectedDate,
  activeTags,
  setHasUnsavedChanges,
}: BudgetDashboardProps) {
  const { scheduleData, setScheduleData, layerMaster, tagMaster, setTagMaster } = useAppStore();

  const [isSettingMode, setIsSettingMode] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<"macro" | "micro">("macro");
  const [expandedLayers, setExpandedLayers] = useState<{ [key: string]: boolean }>({});

  const [payday, setPayday] = useState(25);
  const [monthlyBudget, setMonthlyBudget] = useState(100000);
  const [layerBudgets, setLayerBudgets] = useState<{ [key: string]: number }>({});
  const [subTagBudgets, setSubTagBudgets] = useState<{ [key: string]: number }>({});
  const [layerBudgetEnabled, setLayerBudgetEnabled] = useState<{ [key: string]: boolean }>({});

  const [isSavingsHidden, setIsSavingsHidden] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [chartGroupBy, setChartGroupBy] = useState<"layer" | "category" | "tag">("layer");

  const [isSalaryModalVisible, setIsSalaryModalVisible] = useState(false);
  const [salaryInputAmount, setSalaryInputAmount] = useState("");

  const [addSubTagModalVisible, setAddSubTagModalVisible] = useState(false);
  const [targetLayerForSubTag, setTargetLayerForSubTag] = useState("");
  const [newSubTagName, setNewSubTagName] = useState("");
  const [newSubTagColor, setNewSubTagColor] = useState("");

  const screenWidth = Dimensions.get("window").width;
  
  // 🌟 条件① 単一カテゴリが選択されているかを厳密に判定
  const currentActiveLayer = activeTags.length === 1 ? activeTags[0] : null;
  const themeColor = currentActiveLayer ? layerMaster[currentActiveLayer] : "#1C1C1E";

  useEffect(() => {
    const load = async () => {
      const [b, p, lb, sb, le, hidden] = await Promise.all([
        AsyncStorage.getItem("myMonthlyBudget"),
        AsyncStorage.getItem("myPayday"),
        AsyncStorage.getItem("layerBudgetsData"),
        AsyncStorage.getItem("subTagBudgetsData"),
        AsyncStorage.getItem("layerBudgetEnabledData"),
        AsyncStorage.getItem("isSavingsHidden"),
      ]);
      if (b) setMonthlyBudget(parseInt(b));
      if (p) setPayday(parseInt(p));
      if (lb) setLayerBudgets(JSON.parse(lb || "{}"));
      if (sb) setSubTagBudgets(JSON.parse(sb || "{}"));
      if (le) setLayerBudgetEnabled(JSON.parse(le || "{}"));
      if (hidden !== null) setIsSavingsHidden(JSON.parse(hidden));
    };
    load();
  }, []);

  const toggleLayerExpansion = (layer: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const toggleSavingsVisibility = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !isSavingsHidden;
    setIsSavingsHidden(newValue);
    AsyncStorage.setItem("isSavingsHidden", JSON.stringify(newValue));
  };

  const getCycleRange = (dateStr: string, pDay: number) => {
    const date = new Date(dateStr);
    let startYear = date.getFullYear();
    let startMonth = date.getMonth();
    if (date.getDate() < pDay) {
      startMonth -= 1;
      if (startMonth < 0) { startMonth = 11; startYear -= 1; }
    }
    const startDate = new Date(startYear, startMonth, pDay);
    const endDate = new Date(startYear, startMonth + 1, pDay - 1);
    const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { start: formatDate(startDate), end: formatDate(endDate) };
  };

  const cycleRange = useMemo(() => getCycleRange(selectedDate, payday), [selectedDate, payday]);

  const getDatesInRange = (startStr: string, endStr: string) => {
    const dates = [];
    let curr = new Date(startStr);
    const end = new Date(endStr);
    while (curr <= end) {
      dates.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}-${String(curr.getDate()).padStart(2, "0")}`);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const { layerActuals, subTagActuals, cycleStats } = useMemo(() => {
    const lActuals: Record<string, number> = {};
    const sActuals: Record<string, number> = {};
    let tIncome = 0; let tExpense = 0;
    const cycleDates = getDatesInRange(cycleRange.start, cycleRange.end);

    cycleDates.forEach((date) => {
      const items = scheduleData[date] || [];
      items.forEach((item) => {
        const eTotal = getItemTotalExpense(item);
        const iTotal = getItemTotalIncome(item);
        if (iTotal > 0) tIncome += iTotal;
        if (eTotal > 0) {
          const itemTag = item.tags?.[0] || item.tag || "未分類";
          const itemLayer = tagMaster[itemTag]?.layer || itemTag;
          lActuals[itemLayer] = (lActuals[itemLayer] || 0) + eTotal;
          sActuals[itemTag] = (sActuals[itemTag] || 0) + eTotal;
          tExpense += eTotal;
        }
      });
    });

    return { layerActuals: lActuals, subTagActuals: sActuals, cycleStats: { tIncome, tExpense } };
  }, [scheduleData, cycleRange, tagMaster]);

  const baseIncome = cycleStats.tIncome > 0 ? cycleStats.tIncome : monthlyBudget;
  const isGlobalDeficit = cycleStats.tExpense > baseIncome;

  const executeSalaryRecord = () => {
    const amount = parseInt(salaryInputAmount);
    if (isNaN(amount) || amount <= 0) return Alert.alert("エラー", "正しい金額を入力してください");
    const targetDateStr = cycleRange.start;
    const newItem: ScheduleItem = {
      id: Date.now().toString(), category: "収入", tag: "給料", tags: ["給料"], title: "給料", amount: amount,
      isDone: false, color: "#8E8E93", isEvent: false, isTodo: false, isExpense: false, isIncome: true,
    };
    const newData = { ...scheduleData, [targetDateStr]: [...(scheduleData[targetDateStr] || []), newItem] };
    setScheduleData(newData);
    setTimeout(() => setHasUnsavedChanges(true), 100);
    setIsSalaryModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const executeAddSubTag = () => {
    const trimmed = newSubTagName.trim();
    if (!trimmed) return;
    if (tagMaster[trimmed]) { Alert.alert("エラー", "既に同じ名前の属性が存在します"); return; }
    const newColor = newSubTagColor || layerMaster[targetLayerForSubTag] || "#8E8E93";
    const newTagMaster = { ...tagMaster, [trimmed]: { layer: targetLayerForSubTag, color: newColor } };
    setTagMaster(newTagMaster);
    AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
    setNewSubTagName(""); setNewSubTagColor(""); setAddSubTagModalVisible(false);
    setExpandedLayers((prev) => ({ ...prev, [targetLayerForSubTag]: true }));
  };

  const globalBudgetCalc = useMemo(() => {
    const totalAllocated = Object.keys(layerMaster).reduce((sum, l) => {
      if (layerBudgetEnabled[l] === false) return sum;
      return sum + (layerBudgets[l] || 0);
    }, 0);
    return { totalAllocated, unallocatedBuffer: baseIncome - totalAllocated, isOverflow: baseIncome - totalAllocated < 0 };
  }, [baseIncome, layerBudgets, layerMaster, layerBudgetEnabled]);

  const singleLayerBudgetCalc = useMemo(() => {
    if (!currentActiveLayer) return { totalAllocated: 0, unallocatedBuffer: 0, isOverflow: false };
    const budget = layerBudgets[currentActiveLayer] || 0;
    const subTags = Object.keys(tagMaster).filter((t) => tagMaster[t].layer === currentActiveLayer);
    const total = subTags.reduce((sum, s) => sum + (subTagBudgets[s] || 0), 0);
    return { totalAllocated: total, unallocatedBuffer: budget - total, isOverflow: budget < total };
  }, [currentActiveLayer, layerBudgets, subTagBudgets, tagMaster]);

  // 🌟 条件② バーのセグメントに「その他」を合成する処理
  const barSegments = useMemo(() => {
    const segments: { color: string; actual: number; budget: number }[] = [];
    let otherActual = 0; let otherBudget = 0;

    const layers = [...Object.keys(layerMaster), "共通"];
    layers.forEach((l) => {
      if (layerBudgetEnabled[l] === false) return;
      const actual = layerActuals[l] || 0;
      const budget = l === "共通" ? 0 : layerBudgets[l] || 0;
      const isMatched = activeTags.length === 0 || activeTags.includes(l);

      if (isMatched) {
        segments.push({ color: l === "共通" ? "#8E8E93" : layerMaster[l], actual, budget });
      } else if (activeTags.length > 1) {
        otherActual += actual;
        otherBudget += budget;
      }
    });

    if (activeTags.length > 1 && (otherActual > 0 || otherBudget > 0)) {
      segments.push({ color: "#C7C7CC", actual: otherActual, budget: otherBudget });
    }
    return segments;
  }, [layerMaster, layerActuals, layerBudgets, activeTags, layerBudgetEnabled]);

  // 🌟 条件①＆② グラフや全体の合計値の計算ロジック
  const getStatsForCycle = (startStr: string, endStr: string) => {
    let total = 0;
    const totals: Record<string, number> = {};
    const dates = getDatesInRange(startStr, endStr);
    const isSingle = activeTags.length === 1;

    dates.forEach((date) => {
      const items = scheduleData[date] || [];
      items.forEach((item) => {
        const itemTotal = getItemTotalExpense(item);
        if (itemTotal === 0) return;
        const itemTag = item.tags?.[0] || item.tag || "";
        const itemLayer = tagMaster[itemTag]?.layer || "共通";
        const isMatch = activeTags.length === 0 || activeTags.includes(itemLayer);

        if (!isMatch) {
          if (!isSingle) { // 複数選択時は「その他」として合算
            total += itemTotal;
            totals["その他"] = (totals["その他"] || 0) + itemTotal;
          }
          return; // 単一選択時は関係ないデータは完全に無視
        }

        total += itemTotal;
        if (isSingle) { // 単一選択時は強制的に属性（サブカテゴリ）でグループ化
          totals[itemTag] = (totals[itemTag] || 0) + itemTotal;
        } else {
          let groupKey = itemTag;
          if (chartGroupBy === "layer") groupKey = itemLayer;
          else if (chartGroupBy === "category") groupKey = item.category || itemTag;
          if (!groupKey) groupKey = item.category || "未分類";
          totals[groupKey] = (totals[groupKey] || 0) + itemTotal;
        }
      });
    });
    return { total, totals };
  };

  const stats = useMemo(() => getStatsForCycle(cycleRange.start, cycleRange.end), [scheduleData, cycleRange, activeTags, tagMaster, chartGroupBy]);

  const lineChartData = useMemo(() => {
    const labels: string[] = []; const data: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedDate); d.setMonth(d.getMonth() - i);
      const pastCycle = getCycleRange(d.toISOString().split("T")[0], payday);
      labels.push(`${pastCycle.start.split("-")[1]}月度`);
      data.push(getStatsForCycle(pastCycle.start, pastCycle.end).total || 0);
    }
    return { labels, datasets: [{ data }] };
  }, [scheduleData, selectedDate, payday, activeTags, chartGroupBy]);

  const activeLimit = currentActiveLayer ? (layerBudgets[currentActiveLayer] || 1) : baseIncome;
  const progress = Math.min(stats.total / activeLimit, 1);
  const statusColor = stats.total > activeLimit ? "#FF3B30" : themeColor;

  const currentUsable = baseIncome - cycleStats.tExpense;
  const expectedSavings = baseIncome - globalBudgetCalc.totalAllocated;
  const daysToPayday = Math.max(0, payday - new Date(selectedDate).getDate());

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.iconTextRow}>
          <MaterialCommunityIcons name="piggy-bank-outline" size={18} color={themeColor} />
          <Text style={[styles.paydayText, { color: themeColor }]}>給料日まで あと {daysToPayday} 日</Text>
        </View>
        <TouchableOpacity onPress={() => setIsSettingMode(!isSettingMode)}>
          <Ionicons name={isSettingMode ? "checkmark-circle" : "options-outline"} size={22} color={themeColor} />
        </TouchableOpacity>
      </View>

      {isSettingMode ? (
        <ScrollView style={styles.settingArea} showsVerticalScrollIndicator={false}>
          <Text style={styles.settingLabel}>給料日指定</Text>
          <TextInput style={styles.settingInput} keyboardType="numeric" value={payday.toString()} onChangeText={(t) => { setPayday(parseInt(t) || 25); AsyncStorage.setItem("myPayday", t); }} />
          
          <Text style={[styles.settingLabel, { marginTop: 10 }]}>予算スライダーの表示切替</Text>
          {[...Object.keys(layerMaster), "共通"].map((l) => (
            <View key={l} style={styles.settingSwitchRow}>
              <Text style={styles.settingSwitchLabel}>{l}</Text>
              <Switch value={layerBudgetEnabled[l] !== false} onValueChange={(v) => { const n = { ...layerBudgetEnabled, [l]: v }; setLayerBudgetEnabled(n); AsyncStorage.setItem("layerBudgetEnabledData", JSON.stringify(n)); }} trackColor={{ false: "#E5E5EA", true: layerMaster[l] || "#8E8E93" }} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <>
          <View style={styles.savingsCard}>
            <View style={styles.savingsHeader}>
              <Text style={styles.savingsLabel}>現在の使える金額</Text>
              <Text style={styles.cyclePeriod}>{cycleRange.start.replace(/-/g, "/")} ~ {cycleRange.end.replace(/-/g, "/")}</Text>
            </View>
            <View style={styles.savingsAmountRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={[styles.savingsAmount, { color: currentUsable >= 0 ? "#1C1C1E" : "#FF3B30" }]}>
                  ¥{isSavingsHidden ? "****" : currentUsable.toLocaleString()}
                </Text>
                <TouchableOpacity onPress={toggleSavingsVisibility} style={{ padding: 4 }}>
                  <Ionicons name={isSavingsHidden ? "eye-off" : "eye"} size={22} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.hugeSalaryBtn} onPress={() => { setSalaryInputAmount(monthlyBudget.toString()); setIsSalaryModalVisible(true); }}>
                <Ionicons name="wallet" size={18} color="#FFF" />
                <Text style={styles.hugeSalaryBtnText}>収入を記録</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.expectedSavingsText}>予想貯金額: ¥{isSavingsHidden ? "****" : expectedSavings.toLocaleString()}</Text>
          </View>

          <View style={styles.dashboardToggleRow}>
            <TouchableOpacity style={[styles.dashToggleBtn, dashboardMode === "macro" && { backgroundColor: themeColor }]} onPress={() => setDashboardMode("macro")}><Text style={[styles.dashToggleText, dashboardMode === "macro" && { color: "#FFF" }]}>実績俯瞰</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.dashToggleBtn, dashboardMode === "micro" && { backgroundColor: themeColor }]} onPress={() => setDashboardMode("micro")}><Text style={[styles.dashToggleText, dashboardMode === "micro" && { color: "#FFF" }]}>予算調整</Text></TouchableOpacity>
          </View>

          {dashboardMode === "macro" ? (
            <ScrollView style={styles.macroArea} showsVerticalScrollIndicator={false}>
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>{currentActiveLayer ? `${currentActiveLayer}の進捗` : "全体の進捗"}</Text>
                  <Text style={[styles.progressPercent, { color: statusColor }]}>{Math.round(progress * 100)}%</Text>
                </View>
                <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: statusColor }]} /></View>
              </View>

              {/* 単一カテゴリ選択時は切り替えボタンを隠し、属性別に固定 */}
              {!currentActiveLayer && (
                <View style={styles.chartToggleRow}>
                  {["layer", "category", "tag"].map((type) => (
                    <TouchableOpacity key={type} style={[styles.chartToggleBtn, chartGroupBy === type && { backgroundColor: themeColor }]} onPress={() => setChartGroupBy(type as any)}>
                      <Text style={[styles.chartToggleText, chartGroupBy === type && { color: "#fff" }]}>{type === "layer" ? "レイヤー別" : type === "category" ? "項目別" : "属性別"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              <View style={styles.chartArea}>
                {Object.keys(stats.totals).length > 0 ? (
                  <PieChart
                    data={Object.keys(stats.totals).map((key, index) => ({
                      name: key, population: stats.totals[key],
                      color: key === "その他" ? "#C7C7CC" : (!currentActiveLayer && chartGroupBy === "layer") ? (key === "共通" ? "#8E8E93" : layerMaster[key] || CHART_PALETTE[index % CHART_PALETTE.length]) : tagMaster[key]?.color || CHART_PALETTE[index % CHART_PALETTE.length],
                      legendFontColor: "#666", legendFontSize: 11,
                    }))}
                    width={screenWidth * 0.8} height={160} chartConfig={{ color: () => `black` }} accessor={"population"} backgroundColor={"transparent"} paddingLeft={"15"} absolute
                  />
                ) : (
                  <Text style={styles.noDataText}>データがありません</Text>
                )}
              </View>
            </ScrollView>
          ) : (
            <ScrollView style={styles.microArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {!currentActiveLayer ? (
                <>
                  <View style={styles.masterBudgetHeader}>
                    <Text style={styles.masterTitle}>全体収入・予算枠</Text>
                    <Text style={{ fontSize: 16, fontWeight: "bold", color: "#1C1C1E" }}>¥{baseIncome.toLocaleString()}</Text>
                  </View>

                  <View style={styles.masterStackContainer}>
                    <View style={[styles.masterStackLayer, { opacity: 0.2 }]}>
                      {barSegments.map((seg, idx) => (<View key={`bg-${idx}`} style={{ width: `${(seg.budget / baseIncome) * 100}%`, height: "100%", backgroundColor: seg.color }} />))}
                    </View>
                    <View style={styles.masterStackLayer}>
                      {isGlobalDeficit ? (
                        <View style={{ width: "100%", height: "100%", backgroundColor: "#FF3B30" }} />
                      ) : (
                        barSegments.map((seg, idx) => (<View key={`fg-${idx}`} style={{ width: `${(seg.actual / baseIncome) * 100}%`, height: "100%", backgroundColor: seg.color, borderRightWidth: 1, borderColor: "#FFF" }} />))
                      )}
                    </View>
                  </View>

                  <View style={styles.masterProgressLabelRow}>
                    <Text style={{ fontSize: 11, color: "#666" }}>割当: ¥{globalBudgetCalc.totalAllocated.toLocaleString()}</Text>
                    {isGlobalDeficit ? (
                      <View style={styles.warningBadge}><Ionicons name="alert-circle" size={14} color="#FF3B30" /><Text style={styles.warningText}>赤字: ¥{Math.abs(currentUsable).toLocaleString()}</Text></View>
                    ) : (
                      <Text style={{ fontSize: 12, color: "#34C759", fontWeight: "bold" }}>残り枠: ¥{currentUsable.toLocaleString()}</Text>
                    )}
                  </View>
                  <View style={styles.divider} />

                  {/* 選択されたカテゴリのスライダー */}
                  {Object.keys(layerMaster).map((l) => {
                    if (layerBudgetEnabled[l] === false) return null;
                    if (activeTags.length > 0 && !activeTags.includes(l)) return null;

                    const b = layerBudgets[l] || 0; const a = layerActuals[l] || 0; const color = layerMaster[l];
                    const limit = b + Math.max(0, globalBudgetCalc.unallocatedBuffer);
                    const layerSubTags = Object.keys(tagMaster).filter((t) => tagMaster[t].layer === l);

                    return (
                      <View key={l} style={styles.sliderCard}>
                        <TouchableOpacity style={styles.sliderHeader} onPress={() => toggleLayerExpansion(l)} activeOpacity={0.7}>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Text style={{ fontWeight: "bold", color, fontSize: 16 }}>{l}</Text>
                            <Ionicons name={expandedLayers[l] ? "chevron-down" : "chevron-forward"} size={16} color={color} style={{ marginLeft: 4 }} />
                          </View>
                          <Text style={styles.sliderSubText}>実績 ¥{a.toLocaleString()} / 予算 ¥{b.toLocaleString()}</Text>
                        </TouchableOpacity>

                        <View style={styles.absoluteScaleBar}>
                          <View style={{ position: "absolute", width: `${Math.min(limit / baseIncome, 1) * 100}%`, height: "100%", backgroundColor: color + "1A" }} />
                          <View style={{ position: "absolute", width: `${Math.min(b / baseIncome, 1) * 100}%`, height: "100%", backgroundColor: color + "3A" }} />
                          <View style={{ position: "absolute", width: `${Math.min(a / baseIncome, 1) * 100}%`, height: "100%", backgroundColor: a > b ? "#FF3B30" : color }} />
                        </View>
                        <Slider style={{ height: 40 }} minimumValue={0} maximumValue={baseIncome} step={1000} value={b} thumbTintColor={color} minimumTrackTintColor="transparent" maximumTrackTintColor="transparent" onValueChange={(val) => { const n = { ...layerBudgets, [l]: val }; setLayerBudgets(n); AsyncStorage.setItem("layerBudgetsData", JSON.stringify(n)); }} />

                        {expandedLayers[l] && (
                          <View style={{ marginTop: 5 }}>
                            {layerSubTags.map((sub) => {
                              const sb = subTagBudgets[sub] || 0; const sa = subTagActuals[sub] || 0; const sc = tagMaster[sub]?.color || color;
                              const validLayerB = b || 1;
                              const layerUnallocated = b - layerSubTags.reduce((s, t) => s + (subTagBudgets[t] || 0), 0);
                              const slimit = sb + Math.max(0, layerUnallocated);

                              return (
                                <View key={sub} style={styles.subTagAdjustRow}>
                                  <View style={styles.subTagHeader}>
                                    <Text style={{ fontSize: 13, color: "#555", fontWeight: "bold" }}>↳ {sub}</Text>
                                    <Text style={{ fontSize: 10, color: "#888" }}>¥{sa.toLocaleString()} / ¥{sb.toLocaleString()}</Text>
                                  </View>
                                  <View style={[styles.absoluteScaleBar, { height: 8, borderRadius: 4 }]}>
                                    <View style={{ position: "absolute", width: `${Math.min(slimit / validLayerB, 1) * 100}%`, height: "100%", backgroundColor: sc + "1A" }} />
                                    <View style={{ position: "absolute", width: `${Math.min(sb / validLayerB, 1) * 100}%`, height: "100%", backgroundColor: sc + "3A" }} />
                                    <View style={{ position: "absolute", width: `${Math.min(sa / validLayerB, 1) * 100}%`, height: "100%", backgroundColor: sa > sb ? "#FF3B30" : sc }} />
                                  </View>
                                  <Slider style={{ width: "100%", height: 25, marginTop: 2 }} minimumValue={0} maximumValue={validLayerB} step={500} value={sb} minimumTrackTintColor="transparent" maximumTrackTintColor="transparent" thumbTintColor={sc} onValueChange={(val) => { const n = { ...subTagBudgets, [sub]: val }; setSubTagBudgets(n); AsyncStorage.setItem("subTagBudgetsData", JSON.stringify(n)); }} />
                                </View>
                              );
                            })}
                            <TouchableOpacity style={styles.addSubTagBtn} onPress={() => { setTargetLayerForSubTag(l); setAddSubTagModalVisible(true); }}>
                              <Ionicons name="add" size={16} color={color} />
                              <Text style={{ fontSize: 12, fontWeight: "bold", color: color }}>サブカテゴリを追加</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* 🌟 条件② 複数カテゴリ選択時の「その他」カード */}
                  {activeTags.length > 1 && (() => {
                    let otherB = 0; let otherA = 0;
                    [...Object.keys(layerMaster), "共通"].forEach(l => {
                      if (!activeTags.includes(l) && layerBudgetEnabled[l] !== false) {
                        otherB += l === "共通" ? 0 : (layerBudgets[l] || 0);
                        otherA += layerActuals[l] || 0;
                      }
                    });
                    if (otherB === 0 && otherA === 0) return null;
                    return (
                      <View style={styles.sliderCard}>
                        <View style={styles.sliderHeader}>
                          <Text style={{ fontWeight: "bold", color: "#8E8E93", fontSize: 16 }}>その他 (未選択)</Text>
                          <Text style={styles.sliderSubText}>実績 ¥{otherA.toLocaleString()} / 予算 ¥{otherB.toLocaleString()}</Text>
                        </View>
                        <View style={[styles.absoluteScaleBar, { height: 10, borderRadius: 5 }]}>
                          <View style={{ position: "absolute", width: `${Math.min(otherB / baseIncome, 1) * 100}%`, height: "100%", backgroundColor: "#C7C7CC3A" }} />
                          <View style={{ position: "absolute", width: `${Math.min(otherA / baseIncome, 1) * 100}%`, height: "100%", backgroundColor: otherA > otherB && otherB > 0 ? "#FF3B30" : "#C7C7CC" }} />
                        </View>
                      </View>
                    );
                  })()}
                </>
              ) : (
                /* 🌟 条件① 単一カテゴリ選択時のUI */
                <>
                  <View style={styles.masterBudgetHeader}>
                    <Text style={styles.masterTitle}>{currentActiveLayer} の予算設定</Text>
                    <View style={styles.masterInputWrapper}>
                      <Text style={styles.currencySymbol}>¥</Text>
                      <TextInput style={styles.masterBudgetInput} keyboardType="numeric" value={(layerBudgets[currentActiveLayer] || 0).toString()} onChangeText={(t) => { const n = { ...layerBudgets, [currentActiveLayer]: parseInt(t) || 0 }; setLayerBudgets(n); AsyncStorage.setItem("layerBudgetsData", JSON.stringify(n)); }} />
                    </View>
                  </View>

                  {(() => {
                    const layerSubTags = Object.keys(tagMaster).filter((t) => tagMaster[t].layer === currentActiveLayer);
                    const layerBudget = layerBudgets[currentActiveLayer] || 0; const validB = layerBudget || 1;
                    const layerActualTotal = layerActuals[currentActiveLayer] || 0;
                    const isLayerDeficit = layerActualTotal > layerBudget;

                    return (
                      <>
                        <View style={styles.masterStackContainer}>
                          <View style={[styles.masterStackLayer, { opacity: 0.2 }]}>
                            {layerSubTags.map((sub) => (<View key={`bg-${sub}`} style={{ width: `${((subTagBudgets[sub] || 0) / validB) * 100}%`, height: "100%", backgroundColor: tagMaster[sub]?.color || themeColor }} />))}
                          </View>
                          <View style={styles.masterStackLayer}>
                            {isLayerDeficit ? (
                              <View style={{ width: "100%", height: "100%", backgroundColor: "#FF3B30" }} />
                            ) : (
                              layerSubTags.map((sub) => (<View key={`fg-${sub}`} style={{ width: `${((subTagActuals[sub] || 0) / validB) * 100}%`, height: "100%", backgroundColor: tagMaster[sub]?.color || themeColor, borderRightWidth: 1, borderColor: "#FFF" }} />))
                            )}
                          </View>
                        </View>

                        <View style={styles.masterProgressLabelRow}>
                          <Text style={{ fontSize: 11, color: "#666" }}>割当済み: ¥{singleLayerBudgetCalc.totalAllocated.toLocaleString()}</Text>
                          {singleLayerBudgetCalc.isOverflow ? (
                            <View style={styles.warningBadge}><Ionicons name="alert-circle" size={14} color="#FF3B30" /><Text style={styles.warningText}>超過: ¥{Math.abs(singleLayerBudgetCalc.unallocatedBuffer).toLocaleString()}</Text></View>
                          ) : (
                            <Text style={{ fontSize: 12, color: themeColor, fontWeight: "bold" }}>残り枠: ¥{singleLayerBudgetCalc.unallocatedBuffer.toLocaleString()}</Text>
                          )}
                        </View>
                        <View style={styles.divider} />

                        {layerSubTags.map((sub) => {
                          const sb = subTagBudgets[sub] || 0; const sa = subTagActuals[sub] || 0; const sc = tagMaster[sub]?.color || themeColor;
                          const slimit = sb + Math.max(0, singleLayerBudgetCalc.unallocatedBuffer); const isOver = sa > sb;

                          return (
                            <View key={sub} style={styles.sliderCard}>
                              <View style={styles.sliderHeader}>
                                <Text style={{ fontWeight: "bold", color: "#333", fontSize: 15 }}>{sub}</Text>
                                <Text style={styles.sliderSubText}>実績 ¥{sa.toLocaleString()} / 予算 ¥{sb.toLocaleString()}</Text>
                              </View>
                              <View style={[styles.absoluteScaleBar, { height: 10, borderRadius: 5 }]}>
                                <View style={{ position: "absolute", width: `${Math.min(slimit / validB, 1) * 100}%`, height: "100%", backgroundColor: sc + "1A" }} />
                                <View style={{ position: "absolute", width: `${Math.min(sb / validB, 1) * 100}%`, height: "100%", backgroundColor: sc + "3A" }} />
                                <View style={{ position: "absolute", width: `${Math.min(sa / validB, 1) * 100}%`, height: "100%", backgroundColor: isOver ? "#FF3B30" : sc }} />
                              </View>
                              <Slider style={{ width: "100%", height: 35, marginTop: 5 }} minimumValue={0} maximumValue={layerBudget} step={500} value={sb} minimumTrackTintColor="transparent" maximumTrackTintColor="transparent" thumbTintColor={sc} onValueChange={(val) => { const n = { ...subTagBudgets, [sub]: val }; setSubTagBudgets(n); AsyncStorage.setItem("subTagBudgetsData", JSON.stringify(n)); }} />
                            </View>
                          );
                        })}
                        <TouchableOpacity style={[styles.addSubTagBtn, { marginTop: 10 }]} onPress={() => { setTargetLayerForSubTag(currentActiveLayer); setAddSubTagModalVisible(true); }}>
                          <Ionicons name="add" size={16} color={themeColor} />
                          <Text style={{ fontSize: 12, fontWeight: "bold", color: themeColor }}>サブカテゴリを新規追加</Text>
                        </TouchableOpacity>
                      </>
                    );
                  })()}
                </>
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* サブカテゴリ追加モーダル */}
      <Modal visible={addSubTagModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAddSubTagModalVisible(false)}>
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>[{targetLayerForSubTag}] に追加</Text>
            <Text style={styles.settingLabel}>サブカテゴリ名</Text>
            <TextInput style={styles.editInputAmount} value={newSubTagName} onChangeText={setNewSubTagName} autoFocus />

            <Text style={styles.settingLabel}>カラーを選択（任意）</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity key={color} style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, marginRight: 10 }, newSubTagColor === color && { borderWidth: 3, borderColor: "#1C1C1E" }]} onPress={() => setNewSubTagColor(color)} />
              ))}
            </ScrollView>

            <View style={[styles.editActionRow, { justifyContent: "space-between" }]}>
              <TouchableOpacity onPress={() => setAddSubTagModalVisible(false)} style={{ padding: 10 }}><Text style={{ color: "#8E8E93", fontWeight: "bold" }}>キャンセル</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: layerMaster[targetLayerForSubTag] || themeColor }]} onPress={executeAddSubTag}><Text style={styles.saveText}>追加</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 給料入力モーダル */}
      <Modal visible={isSalaryModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsSalaryModalVisible(false)}>
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>収入の記録</Text>
            <Text style={styles.settingLabel}>金額を入力</Text>
            <TextInput style={styles.editInputAmount} keyboardType="numeric" value={salaryInputAmount} onChangeText={setSalaryInputAmount} autoFocus />
            <View style={[styles.editActionRow, { justifyContent: "space-between" }]}>
              <TouchableOpacity onPress={() => setIsSalaryModalVisible(false)} style={{ padding: 10 }}><Text style={{ color: "#8E8E93", fontWeight: "bold" }}>キャンセル</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: themeColor }]} onPress={executeSalaryRecord}><Text style={styles.saveText}>記録する</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#E5E5EA", flex: 1 },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  iconTextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  paydayText: { fontSize: 14, fontWeight: "bold" },
  savingsCard: { backgroundColor: "#F8F8FA", borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: "#E5E5EA" },
  savingsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  savingsLabel: { fontSize: 13, fontWeight: "bold", color: "#666" },
  cyclePeriod: { fontSize: 11, color: "#999", fontWeight: "600" },
  savingsAmountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  savingsAmount: { fontSize: 30, fontWeight: "900", letterSpacing: 0.5 },
  expectedSavingsText: { fontSize: 11, fontWeight: "bold", color: "#999", marginTop: 8 },
  hugeSalaryBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1C1C1E", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5, gap: 6 },
  hugeSalaryBtnText: { fontSize: 14, fontWeight: "bold", color: "#FFF" },
  addSubTagBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#F2F2F7", borderRadius: 8, alignSelf: "flex-start", marginLeft: 15, marginTop: 5 },
  dashboardToggleRow: { flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: 8, padding: 3, marginBottom: 15 },
  dashToggleBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  dashToggleText: { fontSize: 12, fontWeight: "bold", color: "#8E8E93" },
  settingArea: { paddingVertical: 5 },
  settingLabel: { fontSize: 12, fontWeight: "bold", color: "#666", marginBottom: 8, marginTop: 10 },
  settingInput: { backgroundColor: "#F9F9F9", borderWidth: 1, borderColor: "#EEE", borderRadius: 10, padding: 12, marginBottom: 15, fontSize: 16 },
  settingSwitchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F2F2F7" },
  settingSwitchLabel: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  progressSection: { marginBottom: 15, marginTop: 10 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 },
  progressLabel: { fontSize: 11, color: "#999", fontWeight: "bold" },
  progressPercent: { fontSize: 24, fontWeight: "900" },
  progressBarBg: { height: 10, backgroundColor: "#F2F2F7", borderRadius: 5, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 5 },
  chartToggleRow: { flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: 8, padding: 2, marginBottom: 10 },
  chartToggleBtn: { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 6 },
  chartToggleText: { fontSize: 11, fontWeight: "bold", color: "#666" },
  chartArea: { alignItems: "center", marginBottom: 10, marginTop: 10 },
  noDataText: { color: "#CCC", marginVertical: 30, fontSize: 12, textAlign: "center" },
  macroArea: { width: "100%" },
  microArea: { width: "100%" },
  masterBudgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  masterInputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 120 },
  currencySymbol: { fontSize: 14, color: "#8E8E93", fontWeight: "bold", marginRight: 4 },
  masterTitle: { fontWeight: "bold", fontSize: 16, color: "#1C1C1E" },
  masterBudgetInput: { flex: 1, fontSize: 16, fontWeight: "bold", color: "#1C1C1E", textAlign: "right" },
  masterStackContainer: { height: 16, backgroundColor: "#E5E5EA", borderRadius: 8, overflow: "hidden", position: "relative", marginBottom: 10 },
  masterStackLayer: { flexDirection: "row", position: "absolute", top: 0, left: 0, height: "100%", width: "100%" },
  masterProgressLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  warningBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFEBEA", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  warningText: { fontSize: 12, color: "#FF3B30", fontWeight: "bold", marginLeft: 4 },
  divider: { height: 1, backgroundColor: "#F2F2F7", marginVertical: 15 },
  sliderCard: { marginBottom: 15 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5, alignItems: "center" },
  sliderSubText: { fontSize: 11, color: "#999" },
  absoluteScaleBar: { height: 12, width: "100%", backgroundColor: "#F8F8FA", borderRadius: 6, overflow: "hidden", position: "relative" },
  subTagAdjustRow: { marginBottom: 10, marginLeft: 15, borderLeftWidth: 2, borderLeftColor: "#F2F2F7", paddingLeft: 10 },
  subTagHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  editCardModal: { width: "85%", backgroundColor: "#fff", borderRadius: 25, padding: 25 },
  editTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 15, textAlign: "center", color: "#333" },
  editInputAmount: { backgroundColor: "#F2F2F7", padding: 15, borderRadius: 15, fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  editActionRow: { flexDirection: "row" },
  saveBtn: { paddingHorizontal: 25, paddingVertical: 12, borderRadius: 15 },
  saveText: { color: "#fff", fontWeight: "bold" },
});