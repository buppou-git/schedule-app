import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useAppStore } from "../../../store/useAppStore";
import { ScheduleItem } from "../../../types";
import {
  getItemTotalExpense,
  getItemTotalIncome,
} from "../../../utils/helpers";

const screenWidth = Dimensions.get("window").width;

type ViewMode = "year" | "month" | "week";

interface WishItem {
  savedAmount: number;
}

export default function HistoryAnalytics({
  onClose,
}: {
  onClose?: () => void;
}) {
  const { scheduleData, tagMaster, layerMaster } = useAppStore();

  const [totalSavings, setTotalSavings] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [referenceDate, setReferenceDate] = useState(new Date());

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">(
    "all",
  );

  const [layerFilters, setLayerFilters] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);

  // 🌟 追加：支出カテゴリ（項目）のマスタも読み込むためのState
  const [quickMainTags, setQuickMainTags] = useState<{
    [key: string]: string[];
  }>({
    ALL_LAYERS: ["食費", "交通", "日用品", "交際費", "趣味", "その他"],
  });

  useEffect(() => {
    const loadData = async () => {
      // 貯金額の読み込み
      const u = await AsyncStorage.getItem("unallocatedSavingsData");
      const w = await AsyncStorage.getItem("wishlistData");
      const unallocated = u ? parseInt(u) : 0;
      const wishlist: WishItem[] = w ? JSON.parse(w) : [];
      const wishReserved = wishlist.reduce(
        (sum, item) => sum + (item.savedAmount || 0),
        0,
      );
      setTotalSavings(unallocated + wishReserved);

      // 支出カテゴリ（クイックタグ）の読み込み
      const q = await AsyncStorage.getItem("quickMainTagsData");
      if (q) setQuickMainTags(JSON.parse(q));
    };
    loadData();
  }, []);

  const periodLabel = useMemo(() => {
    const y = referenceDate.getFullYear();
    const m = referenceDate.getMonth() + 1;
    if (viewMode === "year") return `${y}年`;
    if (viewMode === "month") return `${y}年 ${m}月`;
    if (viewMode === "week") {
      const start = new Date(referenceDate);
      start.setDate(referenceDate.getDate() - referenceDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getMonth() + 1}/${start.getDate()} 〜 ${end.getMonth() + 1}/${end.getDate()}`;
    }
    return "";
  }, [referenceDate, viewMode]);

  const { filteredItems, chartData, summary } = useMemo(() => {
    let items: (ScheduleItem & { date: string })[] = [];
    const labels: string[] = [];
    const incomeData: number[] = [];
    const expenseData: number[] = [];

    const y = referenceDate.getFullYear();
    const m = referenceDate.getMonth();

    if (viewMode === "year") {
      for (let i = 0; i < 12; i++) {
        labels.push(`${i + 1}月`);
        let mInc = 0;
        let mExp = 0;
        const prefix = `${y}-${String(i + 1).padStart(2, "0")}`;
        Object.keys(scheduleData).forEach((date) => {
          if (date.startsWith(prefix)) {
            (scheduleData[date] || []).forEach((item) => {
              mInc += getItemTotalIncome(item);
              mExp += getItemTotalExpense(item);
              items.push({ ...item, date });
            });
          }
        });
        incomeData.push(mInc);
        expenseData.push(mExp);
      }
    } else if (viewMode === "month") {
      const lastDay = new Date(y, m + 1, 0).getDate();
      for (let i = 1; i <= lastDay; i++) {
        if (i % 5 === 0 || i === 1 || i === lastDay) labels.push(`${i}`);
        else labels.push("");

        let dInc = 0;
        let dExp = 0;
        const dateKey = `${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
        (scheduleData[dateKey] || []).forEach((item) => {
          dInc += getItemTotalIncome(item);
          dExp += getItemTotalExpense(item);
          items.push({ ...item, date: dateKey });
        });
        incomeData.push(dInc);
        expenseData.push(dExp);
      }
    } else {
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const start = new Date(referenceDate);
      start.setDate(referenceDate.getDate() - referenceDate.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        labels.push(dayNames[i]);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        let wInc = 0;
        let wExp = 0;
        (scheduleData[dateKey] || []).forEach((item) => {
          wInc += getItemTotalIncome(item);
          wExp += getItemTotalExpense(item);
          items.push({ ...item, date: dateKey });
        });
        incomeData.push(wInc);
        expenseData.push(wExp);
      }
    }

    const finalItems = items
      .filter((item) => {
        const inc = getItemTotalIncome(item);
        const exp = getItemTotalExpense(item);
        if (typeFilter === "expense" && exp === 0) return false;
        if (typeFilter === "income" && inc === 0) return false;

        const tag = item.tags?.[0] || item.tag || "未分類";
        const layer = tagMaster[tag]?.layer || "共通";
        const category = item.category || "未分類";

        if (layerFilters.length > 0 && !layerFilters.includes(layer))
          return false;
        if (tagFilters.length > 0 && !tagFilters.includes(tag)) return false;
        if (categoryFilters.length > 0 && !categoryFilters.includes(category))
          return false;

        return inc > 0 || exp > 0;
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const totalInc = incomeData.reduce((a, b) => a + b, 0);
    const totalExp = expenseData.reduce((a, b) => a + b, 0);

    return {
      filteredItems: finalItems,
      chartData: {
        labels,
        datasets: [
          {
            data: incomeData.length ? incomeData : [0],
            color: () => "#34C759",
            strokeWidth: 2,
          },
          {
            data: expenseData.length ? expenseData : [0],
            color: () => "#FF3B30",
            strokeWidth: 2,
          },
        ],
        legend: ["収入", "支出"],
      },
      summary: {
        income: totalInc,
        expense: totalExp,
        balance: totalInc - totalExp,
      },
    };
  }, [
    scheduleData,
    referenceDate,
    viewMode,
    typeFilter,
    layerFilters,
    tagFilters,
    categoryFilters,
  ]);

  // 🌟 変更：期間内のデータではなく、マスタ全体から直接フィルター項目を生成
  const availableLayers = useMemo(() => {
    return Object.keys(layerMaster);
  }, [layerMaster]);

  // 🌟 変更：選択されたカレンダーの種類（レイヤー）に属する属性（タグ）だけをマスタから抽出
  const availableTags = useMemo(() => {
    if (layerFilters.length === 0) return []; // レイヤーが選ばれていない時は属性を出さない（多すぎるため）
    return Object.keys(tagMaster).filter((tag) =>
      layerFilters.includes(tagMaster[tag].layer),
    );
  }, [layerFilters, tagMaster]);

  // 🌟 変更：マスタ（quickMainTags）から支出カテゴリを抽出
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    if (layerFilters.length === 0) {
      (quickMainTags["ALL_LAYERS"] || []).forEach((c) => cats.add(c));
    } else {
      layerFilters.forEach((l) => {
        (quickMainTags[l] || quickMainTags["ALL_LAYERS"] || []).forEach((c) =>
          cats.add(c),
        );
      });
    }
    return Array.from(cats);
  }, [layerFilters, quickMainTags]);

  // 複数選択用の汎用トグル
  const toggleFilter = (
    setFilterState: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilterState((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  // カレンダーの種類（レイヤー）を切り替える時は、不整合を防ぐため属性をリセットする
  const toggleLayerFilter = (layer: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLayerFilters((prev) => {
      const next = prev.includes(layer)
        ? prev.filter((v) => v !== layer)
        : [...prev, layer];
      setTagFilters([]); // 属性フィルターを一旦リセット
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.backBtn, { zIndex: 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#1C1C1E" />
          <Text style={styles.backText}>カレンダー</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={styles.headerTitle}>収支統計レポート</Text>
        </View>

        <TouchableOpacity
          onPress={() => setIsFilterVisible(true)}
          style={[styles.filterTrigger, { zIndex: 1 }]}
        >
          <Ionicons
            name="filter"
            size={22}
            color={
              typeFilter !== "all" ||
              layerFilters.length > 0 ||
              tagFilters.length > 0 ||
              categoryFilters.length > 0
                ? "#007AFF"
                : "#8E8E93"
            }
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.assetCard}>
          <Text style={styles.assetLabel}>現在の貯金総額（資産）</Text>
          <Text style={styles.assetAmount}>
            ¥{totalSavings.toLocaleString()}
          </Text>
        </View>

        <View style={styles.viewModeTabs}>
          {(["year", "month", "week"] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeTab,
                viewMode === mode && styles.modeTabActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setViewMode(mode);
              }}
            >
              <Text
                style={[
                  styles.modeTabText,
                  viewMode === mode && styles.modeTabTextActive,
                ]}
              >
                {mode === "year" ? "年" : mode === "month" ? "月" : "週"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.periodNav}>
          <TouchableOpacity
            onPress={() => {
              const d = new Date(referenceDate);
              if (viewMode === "year") d.setFullYear(d.getFullYear() - 1);
              else if (viewMode === "month") d.setMonth(d.getMonth() - 1);
              else d.setDate(d.getDate() - 7);
              setReferenceDate(d);
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#8E8E93" />
          </TouchableOpacity>
          <Text style={styles.periodLabelText}>{periodLabel}</Text>
          <TouchableOpacity
            onPress={() => {
              const d = new Date(referenceDate);
              if (viewMode === "year") d.setFullYear(d.getFullYear() + 1);
              else if (viewMode === "month") d.setMonth(d.getMonth() + 1);
              else d.setDate(d.getDate() + 7);
              setReferenceDate(d);
            }}
          >
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <View style={styles.chartCard}>
          <LineChart
            data={chartData}
            width={screenWidth - 40}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: 16, paddingRight: 40, marginLeft: -15 }}
            withInnerLines={false}
            withOuterLines={false}
          />
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>収入</Text>
            <Text style={[styles.summaryValue, { color: "#34C759" }]}>
              +¥{summary.income.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>支出</Text>
            <Text style={[styles.summaryValue, { color: "#FF3B30" }]}>
              -¥{summary.expense.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>収支</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: summary.balance >= 0 ? "#007AFF" : "#FF3B30" },
              ]}
            >
              ¥{summary.balance.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>期間内の明細</Text>
          {filteredItems.length === 0 ? (
            <Text style={styles.noDataText}>該当するデータはありません</Text>
          ) : (
            filteredItems.map((item, idx) => {
              const tag = item.tags?.[0] || item.tag || "";
              const color = item.color || tagMaster[tag]?.color || "#8E8E93";
              return (
                <View key={idx} style={styles.historyRow}>
                  <View
                    style={[styles.tagIndicator, { backgroundColor: color }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemSub}>
                      {item.date.replace(/-/g, "/")} | {tag}{" "}
                      {item.category ? `(${item.category})` : ""}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.itemAmount,
                      {
                        color:
                          getItemTotalIncome(item) > 0 ? "#34C759" : "#1C1C1E",
                      },
                    ]}
                  >
                    {getItemTotalIncome(item) > 0 ? "+" : "-"}¥
                    {(
                      getItemTotalIncome(item) || getItemTotalExpense(item)
                    ).toLocaleString()}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={isFilterVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsFilterVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.filterModal}>
              {/* 🌟 変更：モーダル内もスクロールできるようにして、溢れるのを防ぐ */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <View style={styles.filterHeader}>
                  <Text style={styles.filterTitle}>フィルター</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setTypeFilter("all");
                      setLayerFilters([]);
                      setTagFilters([]);
                      setCategoryFilters([]);
                    }}
                  >
                    <Text style={{ color: "#007AFF", fontWeight: "bold" }}>
                      リセット
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.filterSubTitle}>収支種別</Text>
                <View style={styles.filterGroup}>
                  {(["all", "expense", "income"] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterBtn,
                        typeFilter === type && styles.filterBtnActive,
                      ]}
                      onPress={() => setTypeFilter(type)}
                    >
                      <Text
                        style={[
                          styles.filterBtnText,
                          typeFilter === type && styles.filterBtnTextActive,
                        ]}
                      >
                        {type === "all"
                          ? "すべて"
                          : type === "expense"
                            ? "支出"
                            : "収入"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 🌟 変更：一覧性を高めるため、Wrap（折り返し）表示に変更 */}
                <Text style={styles.filterSubTitle}>
                  カレンダーの種類（複数選択可）
                </Text>
                <View style={styles.wrapContainer}>
                  <TouchableOpacity
                    style={[
                      styles.tagBtn,
                      layerFilters.length === 0 && styles.tagBtnActive,
                    ]}
                    onPress={() => {
                      setLayerFilters([]);
                      setTagFilters([]);
                    }}
                  >
                    <Text
                      style={
                        layerFilters.length === 0
                          ? styles.tagBtnTextActive
                          : styles.tagBtnText
                      }
                    >
                      すべて
                    </Text>
                  </TouchableOpacity>
                  {availableLayers.map((layer) => {
                    const color = layerMaster[layer] || "#8E8E93";
                    const isActive = layerFilters.includes(layer);
                    return (
                      <TouchableOpacity
                        key={layer}
                        style={[
                          styles.tagBtn,
                          isActive && {
                            backgroundColor: color,
                            borderColor: color,
                          },
                        ]}
                        onPress={() => toggleLayerFilter(layer)}
                      >
                        <Text
                          style={
                            isActive
                              ? styles.tagBtnTextActive
                              : styles.tagBtnText
                          }
                        >
                          {layer}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.filterSubTitle}>属性（複数選択可）</Text>
                {availableTags.length === 0 ? (
                  <Text style={styles.guideText}>
                    ※カレンダーの種類を選択すると、関連する属性が表示されます。
                  </Text>
                ) : (
                  <View style={styles.wrapContainer}>
                    <TouchableOpacity
                      style={[
                        styles.tagBtn,
                        tagFilters.length === 0 && styles.tagBtnActive,
                      ]}
                      onPress={() => setTagFilters([])}
                    >
                      <Text
                        style={
                          tagFilters.length === 0
                            ? styles.tagBtnTextActive
                            : styles.tagBtnText
                        }
                      >
                        すべて
                      </Text>
                    </TouchableOpacity>
                    {availableTags.map((tag) => {
                      const color = tagMaster[tag]?.color || "#8E8E93";
                      const isActive = tagFilters.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagBtn,
                            isActive && {
                              backgroundColor: color,
                              borderColor: color,
                            },
                          ]}
                          onPress={() => toggleFilter(setTagFilters, tag)}
                        >
                          <Text
                            style={
                              isActive
                                ? styles.tagBtnTextActive
                                : styles.tagBtnText
                            }
                          >
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {availableCategories.length > 0 && (
                  <>
                    <Text style={styles.filterSubTitle}>
                      支出カテゴリ（複数選択可）
                    </Text>
                    <View style={styles.wrapContainer}>
                      <TouchableOpacity
                        style={[
                          styles.tagBtn,
                          categoryFilters.length === 0 && styles.tagBtnActive,
                        ]}
                        onPress={() => setCategoryFilters([])}
                      >
                        <Text
                          style={
                            categoryFilters.length === 0
                              ? styles.tagBtnTextActive
                              : styles.tagBtnText
                          }
                        >
                          すべて
                        </Text>
                      </TouchableOpacity>
                      {availableCategories.map((cat) => {
                        const isActive = categoryFilters.includes(cat);
                        return (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.tagBtn,
                              isActive && {
                                backgroundColor: "#1C1C1E",
                                borderColor: "#1C1C1E",
                              },
                            ]}
                            onPress={() =>
                              toggleFilter(setCategoryFilters, cat)
                            }
                          >
                            <Text
                              style={
                                isActive
                                  ? styles.tagBtnTextActive
                                  : styles.tagBtnText
                              }
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={styles.closeFilterBtn}
                  onPress={() => setIsFilterVisible(false)}
                >
                  <Text style={styles.closeFilterBtnText}>適用して閉じる</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const chartConfig = {
  backgroundColor: "#FFF",
  backgroundGradientFrom: "#FFF",
  backgroundGradientTo: "#FFF",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(28, 28, 30, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(142, 142, 147, ${opacity})`,
  propsForLabels: { fontSize: 10, fontWeight: "bold" },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F8FA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 75 : 40,
    paddingBottom: 15,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },

  backBtn: { flexDirection: "row", alignItems: "center", marginLeft: -5 },
  backText: { fontSize: 14, color: "#1C1C1E", fontWeight: "600" },

  headerTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: Platform.OS === "ios" ? 75 : 40,
    bottom: 15,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#1C1C1E" },

  filterTrigger: { padding: 4 },
  assetCard: {
    margin: 20,
    padding: 25,
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  assetLabel: {
    color: "#AEAEB2",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  assetAmount: {
    color: "#FFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 1,
  },
  viewModeTabs: {
    flexDirection: "row",
    backgroundColor: "#E5E5EA",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: { fontSize: 13, fontWeight: "bold", color: "#8E8E93" },
  modeTabTextActive: { color: "#1C1C1E" },
  periodNav: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    gap: 20,
  },
  periodLabelText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1C1C1E",
    minWidth: 120,
    textAlign: "center",
  },

  chartCard: {
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 15,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },

  summaryGrid: {
    flexDirection: "row",
    marginHorizontal: 20,
    gap: 10,
    marginBottom: 25,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#8E8E93",
    fontWeight: "bold",
    marginBottom: 4,
  },
  summaryValue: { fontSize: 14, fontWeight: "900" },
  historySection: { marginHorizontal: 20, marginBottom: 40 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 15,
    color: "#1C1C1E",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  tagIndicator: { width: 4, height: 24, borderRadius: 2, marginRight: 12 },
  itemTitle: { fontSize: 15, fontWeight: "bold", color: "#1C1C1E" },
  itemSub: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  itemAmount: { fontSize: 16, fontWeight: "900" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  // モーダルが大きくなりすぎないように高さを制限（80%）
  filterModal: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 25,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  filterTitle: { fontSize: 20, fontWeight: "900", color: "#1C1C1E" },
  filterSubTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#8E8E93",
    marginBottom: 12,
  },
  filterGroup: { flexDirection: "row", gap: 10, marginBottom: 20 },
  filterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  filterBtnActive: { backgroundColor: "#1C1C1E" },
  filterBtnText: { fontSize: 14, fontWeight: "bold", color: "#8E8E93" },
  filterBtnTextActive: { color: "#FFF" },

  // 🌟 追加：Wrap用のスタイル
  wrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  guideText: {
    fontSize: 12,
    color: "#AEAEB2",
    marginBottom: 20,
    fontWeight: "bold",
    backgroundColor: "#F8F8FA",
    padding: 10,
    borderRadius: 8,
    overflow: "hidden",
  },

  tagBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tagBtnActive: { backgroundColor: "#1C1C1E", borderColor: "#1C1C1E" },
  tagBtnText: { color: "#8E8E93", fontWeight: "bold", fontSize: 13 },
  tagBtnTextActive: { color: "#FFF", fontWeight: "bold", fontSize: 13 },

  closeFilterBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#007AFF",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 10,
  },
  closeFilterBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 16,
  },
  noDataText: {
    textAlign: "center",
    color: "#AEAEB2",
    marginTop: 40,
    fontWeight: "600",
  },
});
