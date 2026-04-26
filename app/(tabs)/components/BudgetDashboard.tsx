import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
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
import { PieChart } from "react-native-chart-kit";
import { useAppStore } from "../store/useAppStore";
import { ScheduleItem } from "../types";
import { CHART_PALETTE, getItemTotalExpense, getItemTotalIncome, PRESET_COLORS } from "../utils/helpers";

import HistoryAnalytics from "./HistoryAnalytics";

interface BudgetDashboardProps {
  selectedDate: string;
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
}

export interface WishItem {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  icon: string;
  color: string;
  autoDepositEnabled?: boolean;
  autoDepositAmount?: number;
}

export default function BudgetDashboard({
  activeTags,
  setHasUnsavedChanges,
}: BudgetDashboardProps) {
  const { scheduleData, setScheduleData, layerMaster, tagMaster, setTagMaster } = useAppStore();

  const [isSettingMode, setIsSettingMode] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<"macro" | "micro">("macro");
  const [expandedLayers, setExpandedLayers] = useState<{ [key: string]: boolean }>({});

  const [payday, setPayday] = useState(25);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [layerBudgets, setLayerBudgets] = useState<{ [key: string]: number }>({});
  const [subTagBudgets, setSubTagBudgets] = useState<{ [key: string]: number }>({});
  const [layerBudgetEnabled, setLayerBudgetEnabled] = useState<{ [key: string]: boolean }>({});

  const [isSavingsHidden, setIsSavingsHidden] = useState(false);
  const [chartGroupBy, setChartGroupBy] = useState<"layer" | "category" | "tag">("layer");

  const [isSalaryModalVisible, setIsSalaryModalVisible] = useState(false);
  const [salaryInputAmount, setSalaryInputAmount] = useState("");

  const [addSubTagModalVisible, setAddSubTagModalVisible] = useState(false);
  const [targetLayerForSubTag, setTargetLayerForSubTag] = useState("");
  const [newSubTagName, setNewSubTagName] = useState("");
  const [newSubTagColor, setNewSubTagColor] = useState("");

  const [wishlist, setWishlist] = useState<WishItem[]>([]);
  const [isAddWishModalVisible, setIsAddWishModalVisible] = useState(false);

  const [editingWishId, setEditingWishId] = useState<string | null>(null);
  const [newWishName, setNewWishName] = useState("");
  const [newWishTarget, setNewWishTarget] = useState("");
  const [newWishIcon, setNewWishIcon] = useState("musical-notes");
  const [newWishColor, setNewWishColor] = useState("#FF2D55");
  const [newWishAutoDeposit, setNewWishAutoDeposit] = useState(false);
  const [newWishAutoAmount, setNewWishAutoAmount] = useState("");

  const [isDepositModalVisible, setIsDepositModalVisible] = useState(false);
  const [isCompleteModalVisible, setIsCompleteModalVisible] = useState(false);
  const [selectedWish, setSelectedWish] = useState<WishItem | null>(null);
  const [depositAmount, setDepositAmount] = useState("");

  const [unallocatedSavings, setUnallocatedSavings] = useState(0);
  const [isSweeperModalVisible, setIsSweeperModalVisible] = useState(false);

  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);

  const [sweeperAllocations, setSweeperAllocations] = useState<Record<string, number>>({});

  const screenWidth = Dimensions.get("window").width;
  const currentActiveLayer = activeTags.length === 1 ? activeTags[0] : null;
  const themeColor = currentActiveLayer ? layerMaster[currentActiveLayer] : "#1C1C1E";

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const presetIcons = ["musical-notes", "headset", "airplane", "footsteps", "laptop-outline", "game-controller", "book", "gift", "shirt", "car"];
  const WISH_COLORS = ["#FF2D55", "#FF9500", "#FFCC00", "#34C759", "#00C7BE", "#32ADE6", "#007AFF", "#AF52DE"];

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

  useEffect(() => {
    const load = async () => {
      const [b, p, lb, sb, le, hidden, w, lastAuto, u] = await Promise.all([
        AsyncStorage.getItem("myMonthlyBudget"),
        AsyncStorage.getItem("myPayday"),
        AsyncStorage.getItem("layerBudgetsData"),
        AsyncStorage.getItem("subTagBudgetsData"),
        AsyncStorage.getItem("layerBudgetEnabledData"),
        AsyncStorage.getItem("isSavingsHidden"),
        AsyncStorage.getItem("wishlistData"),
        AsyncStorage.getItem("lastAutoDepositCycle"),
        AsyncStorage.getItem("unallocatedSavingsData"),
      ]);

      const loadedMonthlyBudget = b ? parseInt(b) : 0;
      setMonthlyBudget(loadedMonthlyBudget);
      const loadedPayday = p ? parseInt(p) : 25;
      setPayday(loadedPayday);

      if (lb) setLayerBudgets(JSON.parse(lb || "{}"));
      if (sb) setSubTagBudgets(JSON.parse(sb || "{}"));
      if (le) setLayerBudgetEnabled(JSON.parse(le || "{}"));
      if (hidden !== null) setIsSavingsHidden(JSON.parse(hidden));

      let parsedWishlist: WishItem[] = w ? JSON.parse(w) : [];
      let currentUnallocated = u ? parseInt(u) : 0;

      const realCycleStart = getCycleRange(todayStr, loadedPayday).start;
      const currentSchedule = useAppStore.getState().scheduleData;

      if (lastAuto !== realCycleStart) {
        const prevDate = new Date(realCycleStart);
        prevDate.setDate(0);
        const prevCycleRange = getCycleRange(prevDate.toISOString().split("T")[0], loadedPayday);

        let prevIncome = 0; let prevExpense = 0;
        const prevDates = getDatesInRange(prevCycleRange.start, prevCycleRange.end);
        prevDates.forEach(d => {
          (currentSchedule[d] || []).forEach(item => {
            const e = getItemTotalExpense(item);
            const i = getItemTotalIncome(item);
            if (i > 0) prevIncome += i;
            if (e > 0) prevExpense += e;
          });
        });
        const prevBaseIncome = prevIncome > 0 ? prevIncome : loadedMonthlyBudget;
        const prevSurplus = prevBaseIncome - prevExpense;

        if (prevSurplus > 0) {
          currentUnallocated += prevSurplus;
          await AsyncStorage.setItem("unallocatedSavingsData", currentUnallocated.toString());
        }

        let hasAutoDeposits = false;
        let autoDepositTotal = 0;
        let newScheduleData = { ...currentSchedule };

        parsedWishlist = parsedWishlist.map(wish => {
          if (wish.autoDepositEnabled && wish.autoDepositAmount && wish.autoDepositAmount > 0) {
            if (wish.savedAmount < wish.targetAmount) {
              const amountToAdd = Math.min(wish.targetAmount - wish.savedAmount, wish.autoDepositAmount);
              hasAutoDeposits = true;
              autoDepositTotal += amountToAdd;

              const newItem: ScheduleItem = {
                id: Date.now().toString() + Math.random().toString(),
                category: "貯金", tag: wish.name, tags: ["貯金"], title: `${wish.name}へ自動積立`,
                amount: amountToAdd, color: wish.color,
                isDone: true, isEvent: false, isTodo: false, isExpense: true, isIncome: false,
              };
              newScheduleData[realCycleStart] = [...(newScheduleData[realCycleStart] || []), newItem];

              return { ...wish, savedAmount: wish.savedAmount + amountToAdd };
            }
          }
          return wish;
        });

        if (hasAutoDeposits) {
          setScheduleData(newScheduleData);
          setHasUnsavedChanges(true);
          await AsyncStorage.setItem("wishlistData", JSON.stringify(parsedWishlist));
          const msg = `先月の余り ¥${Math.max(0, prevSurplus).toLocaleString()} を未配分プールに追加し、今月の自動積立（¥${autoDepositTotal.toLocaleString()}）を実行しました！`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert("月替わり処理 💰", msg);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (prevSurplus > 0) {
          const msg = `先月の余り ¥${prevSurplus.toLocaleString()} を未配分プールに追加しました！`;
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert("月替わり処理 💰", msg);
        }

        await AsyncStorage.setItem("lastAutoDepositCycle", realCycleStart);
      }

      setUnallocatedSavings(currentUnallocated);
      setWishlist(parsedWishlist);
    };
    load();
  }, []);

  const toggleLayerExpansion = (layer: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // 🌟 追加：残高を隠す目のアイコンの処理
  const toggleSavingsVisibility = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !isSavingsHidden;
    setIsSavingsHidden(newValue);
    AsyncStorage.setItem("isSavingsHidden", JSON.stringify(newValue));
  };

  const cycleRange = useMemo(() => getCycleRange(todayStr, payday), [todayStr, payday]);

  const { layerActuals, subTagActuals, cycleStats, cycleItems } = useMemo(() => {
    const lActuals: Record<string, number> = {};
    const sActuals: Record<string, number> = {};
    const cItems: ScheduleItem[] = [];
    let tIncome = 0; let tExpense = 0;
    const cycleDates = getDatesInRange(cycleRange.start, cycleRange.end);

    cycleDates.forEach((date) => {
      const items = scheduleData[date] || [];
      items.forEach((item) => {
        const eTotal = getItemTotalExpense(item);
        const iTotal = getItemTotalIncome(item);

        if (iTotal > 0 || eTotal > 0) cItems.push(item);

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

    return { layerActuals: lActuals, subTagActuals: sActuals, cycleStats: { tIncome, tExpense }, cycleItems: cItems };
  }, [scheduleData, cycleRange, tagMaster]);

  const baseIncome = cycleStats.tIncome > 0 ? cycleStats.tIncome : monthlyBudget;
  const isGlobalDeficit = cycleStats.tExpense > baseIncome;
  const currentUsable = baseIncome - cycleStats.tExpense;

  const totalSweeperAllocation = Object.values(sweeperAllocations).reduce((a, b) => a + b, 0);
  const remainingToAllocate = unallocatedSavings - totalSweeperAllocation;
  const activeWishes = wishlist.filter(w => w.savedAmount < w.targetAmount);

  const daysToPayday = useMemo(() => {
    const today = new Date(todayStr);
    let nextPaydayDate = new Date(today.getFullYear(), today.getMonth(), payday);

    if (today.getDate() >= payday) {
      nextPaydayDate = new Date(today.getFullYear(), today.getMonth() + 1, payday);
    }

    const diffTime = nextPaydayDate.getTime() - today.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [todayStr, payday]);

  const executeSalaryRecord = () => {
    const amount = parseInt(salaryInputAmount);
    if (isNaN(amount) || amount <= 0) return Alert.alert("エラー", "正しい金額を入力してください");
    const newItem: ScheduleItem = {
      id: Date.now().toString(), category: "収入", tag: "給料", tags: ["給料"], title: "給料", amount: amount,
      isDone: false, color: "#8E8E93", isEvent: false, isTodo: false, isExpense: false, isIncome: true,
    };
    const newData = { ...scheduleData, [todayStr]: [...(scheduleData[todayStr] || []), newItem] };
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

  const executeAddWish = async () => {
    const cleanAmountStr = newWishTarget.replace(/[^0-9]/g, '');
    const targetAmount = parseInt(cleanAmountStr, 10);

    let autoAmount = 0;
    if (newWishAutoDeposit) {
      const cleanAutoStr = newWishAutoAmount.replace(/[^0-9]/g, '');
      autoAmount = parseInt(cleanAutoStr, 10);
    }

    if (!newWishName.trim() || isNaN(targetAmount) || targetAmount <= 0) {
      const msg = "名前と目標金額を正しく入力してください";
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert("エラー", msg);
      return;
    }

    let newList;
    if (editingWishId) {
      newList = wishlist.map(w =>
        w.id === editingWishId
          ? { ...w, name: newWishName.trim(), targetAmount, icon: newWishIcon, color: newWishColor, autoDepositEnabled: newWishAutoDeposit, autoDepositAmount: autoAmount }
          : w
      );
    } else {
      const newItem: WishItem = {
        id: Date.now().toString(), name: newWishName.trim(), targetAmount, savedAmount: 0, icon: newWishIcon, color: newWishColor, autoDepositEnabled: newWishAutoDeposit, autoDepositAmount: autoAmount,
      };
      newList = [...wishlist, newItem];
    }

    setWishlist(newList);
    await AsyncStorage.setItem("wishlistData", JSON.stringify(newList));
    setTimeout(() => setHasUnsavedChanges(true), 100);

    setIsAddWishModalVisible(false);
    setNewWishName(""); setNewWishTarget(""); setEditingWishId(null);
    setNewWishAutoDeposit(false); setNewWishAutoAmount("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const confirmDeleteWish = () => {
    const msg = "この目標を削除しますか？\n(入金済みの金額は残高に戻ります)";
    const deleteLogic = async () => {
      const newList = wishlist.filter(w => w.id !== editingWishId);
      setWishlist(newList);
      await AsyncStorage.setItem("wishlistData", JSON.stringify(newList));
      setTimeout(() => setHasUnsavedChanges(true), 100);
      setEditingWishId(null);
      setIsAddWishModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) deleteLogic();
    } else {
      setIsAddWishModalVisible(false);
      setTimeout(() => {
        Alert.alert("目標の削除", msg, [
          { text: "キャンセル", style: "cancel", onPress: () => setIsAddWishModalVisible(true) },
          { text: "削除", style: "destructive", onPress: deleteLogic }
        ]);
      }, 400);
    }
  };

  // 🌟 追加：目標への入金・戻入の実行処理
  const executeDeposit = async () => {
    const cleanAmountStr = depositAmount.replace(/[^0-9\-]/g, '');
    const amount = parseInt(cleanAmountStr, 10);

    if (!selectedWish || isNaN(amount)) {
      if (Platform.OS === 'web') window.alert("金額を正しく入力してください");
      else Alert.alert("エラー", "金額を正しく入力してください");
      return;
    }

    if (amount > currentUsable && amount > 0) {
      if (Platform.OS === 'web') {
        if (window.confirm("今使える金額を超えていますが、入金しますか？")) {
          processDeposit(amount);
        }
      } else {
        Alert.alert("確認", "今使える金額を超えていますが、入金しますか？", [
          { text: "キャンセル", style: "cancel" },
          { text: "入金する", onPress: () => processDeposit(amount) }
        ]);
      }
    } else {
      processDeposit(amount);
    }
  };

  const processDeposit = async (amount: number) => {
    if (!selectedWish) return;
    const updatedWishlist = wishlist.map(w =>
      w.id === selectedWish.id ? { ...w, savedAmount: Math.max(0, w.savedAmount + amount) } : w
    );
    setWishlist(updatedWishlist);
    await AsyncStorage.setItem("wishlistData", JSON.stringify(updatedWishlist));

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      category: "貯金", tag: selectedWish.name, tags: ["貯金"],
      title: amount >= 0 ? `${selectedWish.name}へチャージ` : `${selectedWish.name}から戻入`,
      amount: Math.abs(amount), color: selectedWish.color,
      isDone: true, isEvent: false, isTodo: false,
      isExpense: amount >= 0, isIncome: amount < 0,
    };
    const newScheduleData = { ...scheduleData, [todayStr]: [...(scheduleData[todayStr] || []), newItem] };
    setScheduleData(newScheduleData);

    setTimeout(() => setHasUnsavedChanges(true), 100);
    setIsDepositModalVisible(false);
    setDepositAmount("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const executeCompleteWish = async () => {
    if (!selectedWish) return;

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      category: "予定", tag: "達成", tags: ["達成"],
      title: `🎉 ${selectedWish.name} を実現する！`,
      amount: 0, color: selectedWish.color,
      isDone: false, isEvent: false, isTodo: true, isExpense: false, isIncome: false,
    };
    const newScheduleData = { ...scheduleData, [todayStr]: [...(scheduleData[todayStr] || []), newItem] };
    setScheduleData(newScheduleData);

    const updatedWishlist = wishlist.filter(w => w.id !== selectedWish.id);
    setWishlist(updatedWishlist);
    await AsyncStorage.setItem("wishlistData", JSON.stringify(updatedWishlist));

    setTimeout(() => setHasUnsavedChanges(true), 100);
    setIsCompleteModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === 'web') window.alert("カレンダーのToDoリストに予定を追加しました！");
    else Alert.alert("おめでとうございます！", "カレンダーのToDoリストに予定を追加しました！");
  };

  const executeSweeper = async () => {
    if (remainingToAllocate < 0) {
      if (Platform.OS === 'web') window.alert("振り分け金額が未配分プールを超えています");
      else Alert.alert("エラー", "振り分け金額が未配分プールを超えています");
      return;
    }

    let updatedWishlist = [...wishlist];
    let hasUpdates = false;

    Object.entries(sweeperAllocations).forEach(([id, amount]) => {
      if (amount > 0) {
        hasUpdates = true;
        updatedWishlist = updatedWishlist.map(w =>
          w.id === id ? { ...w, savedAmount: Math.min(w.targetAmount, w.savedAmount + amount) } : w
        );
      }
    });

    if (hasUpdates) {
      setWishlist(updatedWishlist);
      await AsyncStorage.setItem("wishlistData", JSON.stringify(updatedWishlist));

      const newUnallocated = unallocatedSavings - totalSweeperAllocation;
      setUnallocatedSavings(newUnallocated);
      await AsyncStorage.setItem("unallocatedSavingsData", newUnallocated.toString());

      setTimeout(() => setHasUnsavedChanges(true), 100);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setIsSweeperModalVisible(false);
    setSweeperAllocations({});
  };

  const executeAllToSavings = async () => {
    setUnallocatedSavings(0);
    await AsyncStorage.setItem("unallocatedSavingsData", "0");
    setTimeout(() => setHasUnsavedChanges(true), 100);

    setIsSweeperModalVisible(false);
    setSweeperAllocations({});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === 'web') window.alert("残金をすべて一般貯金（資産）として確定しました！");
    else Alert.alert("確定", "残金をすべて一般貯金（資産）として確定しました！");
  };

  const getStatsForCycle = (startStr: string, endStr: string) => {
    let total = 0;
    const totals: Record<string, number> = {};
    const isSingle = activeTags.length === 1;

    cycleItems.forEach((item) => {
      const itemTotal = getItemTotalExpense(item);
      if (itemTotal === 0) return;
      const itemTag = item.tags?.[0] || item.tag || "";
      const itemLayer = tagMaster[itemTag]?.layer || "共通";
      const isMatch = activeTags.length === 0 || activeTags.includes(itemLayer);

      if (!isMatch) {
        if (!isSingle) {
          total += itemTotal;
          totals["その他"] = (totals["その他"] || 0) + itemTotal;
        }
        return;
      }

      total += itemTotal;
      if (isSingle) {
        totals[itemTag] = (totals[itemTag] || 0) + itemTotal;
      } else {
        let groupKey = itemTag;
        if (chartGroupBy === "layer") groupKey = itemLayer;
        else if (chartGroupBy === "category") groupKey = item.category || itemTag;
        if (!groupKey) groupKey = item.category || "未分類";
        totals[groupKey] = (totals[groupKey] || 0) + itemTotal;
      }
    });
    return { total, totals };
  };

  const stats = useMemo(() => getStatsForCycle(cycleRange.start, cycleRange.end), [cycleItems, cycleRange, activeTags, tagMaster, chartGroupBy]);

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

  const activeLimit = currentActiveLayer ? (layerBudgets[currentActiveLayer] || 1) : baseIncome;
  const progress = activeLimit > 0 ? Math.min(stats.total / activeLimit, 1) : 0;
  const statusColor = stats.total > activeLimit ? "#FF3B30" : themeColor;

  const expectedSavings = baseIncome - globalBudgetCalc.totalAllocated;

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
            <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", marginTop: 8 }}>
              <Text style={styles.expectedSavingsText}>予想貯金額: ¥{isSavingsHidden ? "****" : expectedSavings.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.wishSection}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>夢・目標リスト (Wish)</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 5 }}>

              <TouchableOpacity style={styles.addWishPod} onPress={() => {
                setEditingWishId(null);
                setNewWishName("");
                setNewWishTarget("");
                setNewWishIcon("musical-notes");
                setNewWishColor("#FF2D55");
                setNewWishAutoDeposit(false);
                setNewWishAutoAmount("");
                setIsAddWishModalVisible(true);
              }}>
                <Ionicons name="add" size={28} color="#AEAEB2" />
                <Text style={styles.addWishText}>目標を追加</Text>
              </TouchableOpacity>

              {unallocatedSavings > 0 && (
                <TouchableOpacity style={styles.sweeperPod} onPress={() => {
                  setSweeperAllocations({});
                  setIsSweeperModalVisible(true);
                }}>
                  <View style={styles.sweeperIconBg}>
                    <Ionicons name="sparkles" size={20} color="#FF9500" />
                  </View>
                  <Text style={styles.wishName} numberOfLines={1}>残金振り分け</Text>
                  <Text style={styles.sweeperSubText}>余りを分配 ✨</Text>
                </TouchableOpacity>
              )}

              {wishlist.map(wish => {
                const progressVal = Math.min(100, (wish.savedAmount / wish.targetAmount) * 100);
                const isCompleted = progressVal >= 100;
                return (
                  <TouchableOpacity
                    key={wish.id}
                    style={[styles.wishPod, isCompleted && { borderColor: wish.color, borderWidth: 2 }]}
                    onPress={() => {
                      setSelectedWish(wish);
                      if (isCompleted) {
                        setIsCompleteModalVisible(true);
                      } else {
                        setDepositAmount("");
                        setIsDepositModalVisible(true);
                      }
                    }}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      setEditingWishId(wish.id);
                      setNewWishName(wish.name);
                      setNewWishTarget(wish.targetAmount.toString());
                      setNewWishIcon(wish.icon);
                      setNewWishColor(wish.color);
                      setNewWishAutoDeposit(wish.autoDepositEnabled || false);
                      setNewWishAutoAmount(wish.autoDepositAmount ? wish.autoDepositAmount.toString() : "");
                      setIsAddWishModalVisible(true);
                    }}
                    delayLongPress={400}
                  >
                    {wish.autoDepositEnabled && !isCompleted && (
                      <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: "#F2F2F7", borderRadius: 10, padding: 2, zIndex: 10 }}>
                        <Ionicons name="sync" size={12} color="#8E8E93" />
                      </View>
                    )}

                    <View style={[styles.wishIconBg, { backgroundColor: wish.color + "20" }]}>
                      <Ionicons name={wish.icon as any} size={20} color={wish.color} />
                    </View>
                    <Text style={styles.wishName} numberOfLines={1}>{wish.name}</Text>

                    <View style={styles.progressBarBgSub}>
                      <View style={[styles.progressBarFill, { width: `${progressVal}%`, backgroundColor: wish.color }]} />
                    </View>

                    <Text style={styles.wishProgressText}>
                      ¥{wish.savedAmount.toLocaleString()} <Text style={{ color: "#AEAEB2", fontSize: 9 }}>/ ¥{wish.targetAmount.toLocaleString()}</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
                  <Text style={activeLimit > 0 ? [styles.progressPercent, { color: statusColor }] : styles.noSettingText}>
                    {activeLimit > 0 ? `${Math.round(progress * 100)}%` : "設定なし"}
                  </Text>
                </View>
                <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: statusColor }]} /></View>
              </View>

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

              {/* 🌟 履歴リストを消して、別画面を開くための大きなボタンに変更 */}
              <View style={styles.historySection}>
                <TouchableOpacity
                  style={{
                    backgroundColor: themeColor + "1A",
                    padding: 24,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: themeColor + "33",
                    marginTop: 10
                  }}
                  onPress={() => setIsHistoryModalVisible(true)}
                >
                  <Ionicons name="analytics" size={22} color={themeColor} style={{ marginRight: 10 }} />
                  <Text style={{ color: themeColor, fontWeight: '800', fontSize: 16 }}>
                    収支履歴・詳細分析レポート
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={themeColor} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
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
          <TouchableWithoutFeedback>
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
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* 収入の記録モーダル */}
      <Modal visible={isSalaryModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsSalaryModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.editCardModal}>
              <Text style={styles.editTitle}>収入の記録</Text>
              <Text style={styles.settingLabel}>金額を入力</Text>
              <TextInput style={styles.editInputAmount} keyboardType="numeric" value={salaryInputAmount} onChangeText={setSalaryInputAmount} autoFocus />
              <View style={[styles.editActionRow, { justifyContent: "space-between" }]}>
                <TouchableOpacity onPress={() => setIsSalaryModalVisible(false)} style={{ padding: 10 }}><Text style={{ color: "#8E8E93", fontWeight: "bold" }}>キャンセル</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: themeColor }]} onPress={executeSalaryRecord}><Text style={styles.saveText}>記録する</Text></TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Wish作成・編集モーダル */}
      <Modal visible={isAddWishModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsAddWishModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.editCardModal}>
              <Text style={styles.editTitle}>{editingWishId ? "目標を編集" : "新しい目標を作成"}</Text>

              <Text style={styles.settingLabel}>欲しいもの・やりたいこと</Text>
              <TextInput
                style={styles.inputField}
                placeholder="例: ライブ遠征費用"
                placeholderTextColor="#C7C7CC"
                value={newWishName}
                onChangeText={setNewWishName}
              />

              <Text style={styles.settingLabel}>目標金額 (¥)</Text>
              <TextInput
                style={styles.inputField}
                keyboardType="numeric"
                placeholder="30000"
                placeholderTextColor="#C7C7CC"
                value={newWishTarget}
                onChangeText={setNewWishTarget}
              />

              <View style={styles.settingSwitchRow}>
                <Text style={styles.settingSwitchLabel}>毎月自動で積み立てる</Text>
                <Switch
                  value={newWishAutoDeposit}
                  onValueChange={setNewWishAutoDeposit}
                  trackColor={{ false: "#E5E5EA", true: newWishColor }}
                />
              </View>

              {newWishAutoDeposit && (
                <>
                  <Text style={styles.settingLabel}>毎月の積立額 (¥)</Text>
                  <TextInput
                    style={styles.inputField}
                    keyboardType="numeric"
                    placeholder="例: 5000"
                    placeholderTextColor="#C7C7CC"
                    value={newWishAutoAmount}
                    onChangeText={setNewWishAutoAmount}
                  />
                </>
              )}

              <Text style={styles.settingLabel}>アイコンを選択</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                {presetIcons.map(icon => (
                  <TouchableOpacity key={icon} onPress={() => setNewWishIcon(icon)} style={[styles.iconSelectBtn, newWishIcon === icon && { backgroundColor: "#F2F2F7", borderColor: "#C7C7CC" }]}>
                    <Ionicons name={icon as any} size={24} color={newWishIcon === icon ? "#1C1C1E" : "#8E8E93"} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.settingLabel}>テーマカラー</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {WISH_COLORS.map((color) => (
                  <TouchableOpacity key={color} onPress={() => setNewWishColor(color)} style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, marginRight: 10 }, newWishColor === color && { borderWidth: 3, borderColor: "#1C1C1E" }]} />
                ))}
              </ScrollView>

              <View style={[styles.editActionRow, { justifyContent: "space-between", marginTop: 10 }]}>
                <TouchableOpacity onPress={() => setIsAddWishModalVisible(false)} style={{ padding: 10 }}>
                  <Text style={{ color: "#8E8E93", fontWeight: "bold" }}>キャンセル</Text>
                </TouchableOpacity>

                {editingWishId && (
                  <TouchableOpacity onPress={confirmDeleteWish} style={{ padding: 10 }}>
                    <Text style={{ color: "#FF3B30", fontWeight: "bold" }}>削除</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: newWishColor }]} onPress={executeAddWish}>
                  <Text style={styles.saveText}>{editingWishId ? "保存" : "目標を設定"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* 残金一括振り分け（スウィーパー）モーダル */}
      <Modal visible={isSweeperModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsSweeperModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.editCardModal}>
              <View style={{ alignItems: "center", marginBottom: 15 }}>
                <View style={[styles.sweeperIconBg, { width: 50, height: 50, borderRadius: 25, marginBottom: 10 }]}>
                  <Ionicons name="sparkles" size={28} color="#FF9500" />
                </View>
                <Text style={styles.editTitle}>残金を一括振り分け</Text>
                <Text style={{ color: "#8E8E93", fontSize: 12, fontWeight: "bold", marginBottom: 5 }}>
                  先月の余り（未配分プール）
                </Text>
                <Text style={{ fontSize: 32, fontWeight: "900", color: remainingToAllocate < 0 ? "#FF3B30" : "#1C1C1E" }}>
                  ¥{remainingToAllocate.toLocaleString()}
                </Text>
              </View>

              {activeWishes.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#8E8E93', textAlign: 'center', lineHeight: 20 }}>
                    個別の目標がありません。{"\n"}下のボタンから全額を一般貯金に回せます。
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 200, marginVertical: 10 }} showsVerticalScrollIndicator={false}>
                  {activeWishes.map(wish => (
                    <View key={wish.id} style={styles.sweeperRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <View style={[styles.wishIconBg, { backgroundColor: wish.color + "20", width: 30, height: 30, marginBottom: 0 }]}>
                          <Ionicons name={wish.icon as any} size={16} color={wish.color} />
                        </View>
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={{ fontWeight: "bold", fontSize: 14 }} numberOfLines={1}>{wish.name}</Text>
                          <Text style={{ fontSize: 10, color: "#8E8E93" }}>
                            あと ¥{(wish.targetAmount - wish.savedAmount).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ fontWeight: "bold", color: "#8E8E93", marginRight: 5 }}>+</Text>
                        <TextInput
                          style={styles.sweeperInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#C7C7CC"
                          value={(sweeperAllocations[wish.id] || "").toString()}
                          onChangeText={(val) => {
                            const clean = val.replace(/[^0-9]/g, '');
                            setSweeperAllocations(prev => ({ ...prev, [wish.id]: clean ? parseInt(clean, 10) : 0 }));
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={styles.sweeperFooterRow}>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: "#8E8E93" }}>🏦 一般貯金に残す金額</Text>
                <Text style={{ fontSize: 14, fontWeight: "bold", color: "#34C759" }}>
                  ¥{Math.max(0, remainingToAllocate).toLocaleString()}
                </Text>
              </View>

              <View style={[styles.editActionRow, { justifyContent: "space-between", marginTop: 20, gap: 10 }]}>
                <TouchableOpacity onPress={() => setIsSweeperModalVisible(false)} style={{ padding: 10 }}>
                  <Text style={{ color: "#8E8E93", fontWeight: "bold" }}>キャンセル</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: "#34C759", paddingHorizontal: 15 }]} onPress={executeAllToSavings}>
                    <Text style={styles.saveText}>全額貯金</Text>
                  </TouchableOpacity>
                  {activeWishes.length > 0 && (
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: "#FF9500", paddingHorizontal: 15 }]} onPress={executeSweeper}>
                      <Text style={styles.saveText}>振り分け</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* 個別Wish入金（チャージ）モーダル */}
      <Modal visible={isDepositModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsDepositModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.editCardModal}>
              {selectedWish && (
                <>
                  <View style={{ alignItems: "center", marginBottom: 15 }}>
                    <Ionicons name={selectedWish.icon as any} size={36} color={selectedWish.color} />
                    <Text style={[styles.editTitle, { marginBottom: 5, marginTop: 5 }]}>{selectedWish.name} へ入金</Text>
                    <Text style={{ color: "#8E8E93", fontSize: 12, fontWeight: "bold" }}>
                      あと ¥{(selectedWish.targetAmount - selectedWish.savedAmount).toLocaleString()} で達成！
                    </Text>
                  </View>

                  <Text style={styles.settingLabel}>今月の使えるお金から入金 (¥)</Text>
                  <TextInput
                    style={styles.editInputAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#C7C7CC"
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    autoFocus
                  />
                  <Text style={{ fontSize: 11, color: "#AEAEB2", marginTop: 8, textAlign: "right" }}>
                    ※マイナス値を入れると残高に戻せます
                  </Text>

                  <View style={[styles.editActionRow, { justifyContent: "space-between" }]}>
                    <TouchableOpacity onPress={() => setIsDepositModalVisible(false)} style={{ padding: 10 }}><Text style={{ color: "#8E8E93", fontWeight: "bold" }}>キャンセル</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: selectedWish.color }]} onPress={executeDeposit}><Text style={styles.saveText}>チャージする</Text></TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* 目標達成処理モーダル */}
      <Modal visible={isCompleteModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsCompleteModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.editCardModal}>
              {selectedWish && (
                <>
                  <View style={{ alignItems: "center", marginBottom: 15 }}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
                    <Text style={[styles.editTitle, { marginBottom: 5, color: selectedWish.color }]}>目標達成！</Text>
                    <Text style={{ color: "#333", fontSize: 14, fontWeight: "bold", textAlign: "center", marginTop: 10, lineHeight: 20 }}>
                      「{selectedWish.name}」に必要な資金が{'\n'}すべて貯まりました！
                    </Text>
                  </View>

                  <View style={[styles.editActionRow, { justifyContent: "space-between", marginTop: 20 }]}>
                    <TouchableOpacity onPress={() => setIsCompleteModalVisible(false)} style={{ padding: 10 }}>
                      <Text style={{ color: "#8E8E93", fontWeight: "bold" }}>あとで</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: selectedWish.color, flexDirection: "row", alignItems: "center" }]} onPress={executeCompleteWish}>
                      <Ionicons name="calendar" size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.saveText}>予定に追加して完了</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
      <Modal visible={isHistoryModalVisible} transparent={false} animationType="slide">
        <HistoryAnalytics onClose={() => setIsHistoryModalVisible(false)} />
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
  expectedSavingsText: { fontSize: 11, fontWeight: "bold", color: "#999" },
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
  noSettingText: {
    fontSize: 12,      // 文字を小さく
    color: "#C7C7CC",  // 色を薄いグレーに
    fontWeight: "normal", // 太字を解除して柔らかく
  },
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

  breakdownText: { fontSize: 10, color: "#8E8E93", fontWeight: "600" },
  wishSection: { marginBottom: 20, marginTop: 5 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#1C1C1E" },
  wishPod: { width: 110, backgroundColor: "#FFF", borderRadius: 16, padding: 12, marginRight: 12, borderWidth: 1, borderColor: "#E5E5EA", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, position: "relative" },
  addWishPod: { width: 110, backgroundColor: "#F8F8FA", borderRadius: 16, padding: 12, marginRight: 12, borderWidth: 1, borderColor: "#E5E5EA", borderStyle: "dashed", justifyContent: "center", alignItems: "center" },

  sweeperPod: { width: 110, backgroundColor: "#FFFBF2", borderRadius: 16, padding: 12, marginRight: 12, borderWidth: 1, borderColor: "#FFCC00", shadowColor: "#FF9500", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3, justifyContent: "center" },
  sweeperIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF5D1", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  sweeperSubText: { fontSize: 10, fontWeight: "bold", color: "#FF9500", marginTop: 4 },
  sweeperRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F2F7" },
  sweeperInput: { backgroundColor: "#F2F2F7", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, fontSize: 16, fontWeight: "bold", textAlign: "right", width: 90 },
  sweeperFooterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 15, paddingVertical: 10, backgroundColor: "#F8F8FA", paddingHorizontal: 12, borderRadius: 10 },

  addWishText: { fontSize: 11, fontWeight: "bold", color: "#AEAEB2", marginTop: 8 },
  wishIconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  wishName: { fontSize: 12, fontWeight: "bold", color: "#333", marginBottom: 8 },
  progressBarBgSub: { height: 6, backgroundColor: "#F2F2F7", borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  wishProgressText: { fontSize: 11, fontWeight: "bold", color: "#1C1C1E" },
  inputField: { backgroundColor: "#F2F2F7", padding: 12, borderRadius: 12, fontSize: 16, fontWeight: "bold", marginBottom: 5 },
  iconSelectBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "transparent", justifyContent: "center", alignItems: "center", marginRight: 10 },

  // 🌟 追加：履歴用スタイル
  historySection: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#E5E5EA" },
  historyTitle: { fontSize: 14, fontWeight: "bold", color: "#1C1C1E", marginBottom: 10 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  noHistoryText: { color: '#999', textAlign: 'center', marginVertical: 20 },
});