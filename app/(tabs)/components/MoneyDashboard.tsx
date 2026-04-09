import React, { useEffect, useState } from "react";
import { Alert, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { PieChart } from "react-native-chart-kit";

//データを保存するために挿入
import AsyncStorage from "@react-native-async-storage/async-storage";

// Index.tsxと同じ型（ルールブック）を用意
interface ScheduleItem {
  id: string;
  title: string;
  tag: string;
  amount: number;
  isDone: boolean;
  color: string;
  isEvent: boolean;
  isTodo: boolean;
  isExpense: boolean;
}

// 司令塔（Index.tsx）から受け取るデータのルール
interface Props {
  scheduleData: { [key: string]: ScheduleItem[] };
  setScheduleData: (data: any) => void;
  selectedDate: string;
}

export default function MoneyDashboard({ scheduleData, setScheduleData, selectedDate }: Props) {
  // 🌟 1. 家計簿専用のState（状態管理）
  const [isSummaryMode, setIsSummaryMode] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(100000);
  const [isSettingMode, setIsSettingMode] = useState(false);
  const [quickAmount, setQuickAmount] = useState("");
  const [payday, setPayday] = useState(25);

  useEffect(() => {
    setIsSummaryMode(false);
  }, [selectedDate]);


  // 1. 【ロード】アプリ起動時に、スマホの奥底から設定を「思い出す」
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedBudget = await AsyncStorage.getItem("myMonthlyBudget");
        const savedPayday = await AsyncStorage.getItem("myPayday");
        
        // もし保存されたデータがあれば、それをセットする
        if (savedBudget !== null) setMonthlyBudget(parseInt(savedBudget));
        if (savedPayday !== null) setPayday(parseInt(savedPayday));
      } catch (error) {
        console.error("設定の読み込みに失敗しました", error);
      }
    };
    loadSettings();
  }, []);

  // 2. 【セーブ】予算か給料日が変更されたら、自動で「覚える（上書き保存）」
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await AsyncStorage.setItem("myMonthlyBudget", monthlyBudget.toString());
        await AsyncStorage.setItem("myPayday", payday.toString());
      } catch (error) {
        console.error("設定の保存に失敗しました", error);
      }
    };
    saveSettings();
  }, [monthlyBudget, payday]); // 👈 この2つの数字が変わった時だけ実行される

  // 🌟 2. 計算ロジック
  const dailyTotal = (scheduleData[selectedDate] || [])
    .filter((item) => item.isExpense)
    .reduce((sum, item) => sum + item.amount, 0);

  const currentMonth = selectedDate.substring(0, 7);
  let monthlyTotal = 0;
  const categoryTotals: { [key: string]: number } = {};

  const calculateDailyAllowance = () => {
    const todayDate = new Date(selectedDate);
    const currentYear = todayDate.getFullYear();
    const currentMonthNum = todayDate.getMonth();
    const currentDay = todayDate.getDate();

    let nextPayday;
    if (currentDay < payday) {
      nextPayday = new Date(currentYear, currentMonthNum, payday);
    } else {
      nextPayday = new Date(currentYear, currentMonthNum + 1, payday);
    }

    const diffTime = nextPayday.getTime() - todayDate.getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const safeRemainingDays = remainingDays === 0 ? 1 : remainingDays;
    const balance = monthlyBudget - monthlyTotal;
    const dailyAvailable = Math.max(0, Math.floor(balance / safeRemainingDays));

    return { remainingDays: safeRemainingDays, dailyAvailable };
  };

  const { remainingDays, dailyAvailable } = calculateDailyAllowance();

  Object.keys(scheduleData).forEach((date) => {
    if (date.startsWith(currentMonth)) {
      scheduleData[date].forEach((item) => {
        if (item.isExpense) {
          monthlyTotal += item.amount;
          categoryTotals[item.tag] = (categoryTotals[item.tag] || 0) + item.amount;
        }
      });
    }
  });

  const screenWidth = Dimensions.get("window").width;
  const chartColors: { [key: string]: string } = {
    "食費": "#FF9500", "交通費": "#007AFF", "趣味": "#FF3B30", "日用": "#34C759"
  };

  const pieData = Object.keys(categoryTotals).map((key) => ({
    name: key,
    population: categoryTotals[key],
    color: chartColors[key] || "#888888",
    legendFontColor: "#7F7F7F",
    legendFontSize: 11,
  }));

  // 🌟 3. クイック入力機能
  const handleQuickAdd = (category: string) => {
    const amountNum = parseInt(quickAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return Alert.alert("エラー", "正しい金額を入力してください");
    }

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      title: category,
      tag: category,
      amount: amountNum,
      isDone: false,
      color: category === "食費" ? "#FF9500" : category === "交通費" ? "#007AFF" : "#34C759",
      isEvent: false,
      isTodo: false,
      isExpense: true,
    };

    const newData = { ...scheduleData };
    newData[selectedDate] = [...(newData[selectedDate] || []), newItem];
    setScheduleData(newData);
    setQuickAmount("");
  };

  // 🌟 4. 見た目（UI）
  return (
    <View style={{ width: '100%', paddingBottom: 40 }}>
      {/* トグルスイッチ */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, !isSummaryMode && styles.toggleActive]}
          onPress={() => setIsSummaryMode(false)}
        >
          <Text style={[styles.toggleText, !isSummaryMode && styles.toggleTextActive]}>📅 日別詳細</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, isSummaryMode && styles.toggleActive]}
          onPress={() => {
            setIsSummaryMode(true);
            setIsSettingMode(false);
          }}
        >
          <Text style={[styles.toggleText, isSummaryMode && styles.toggleTextActive]}>📊 予算確認</Text>
        </TouchableOpacity>
      </View>

      {isSummaryMode ? (
        /* 月間総評モード */
        <View style={[styles.dashLeft, { width: '100%', marginRight: 0 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 14, color: '#007AFF', fontWeight: 'bold' }}>
              📅 給料日まで あと {remainingDays} 日
            </Text>
            <TouchableOpacity onPress={() => setIsSettingMode(!isSettingMode)}>
              <Text style={{ color: '#007AFF', fontSize: 13, fontWeight: 'bold' }}>
                {isSettingMode ? '戻る' : '⚙️ 詳細設定'}
              </Text>
            </TouchableOpacity>
          </View>

          {isSettingMode ? (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.dashLabel}>今月の予算設定</Text>
              <TextInput style={styles.quickInput} placeholder="予算金額" keyboardType="numeric" value={monthlyBudget.toString()} onChangeText={(text) => setMonthlyBudget(parseInt(text) || 0)} />
              <Text style={[styles.dashLabel, { marginTop: 15 }]}>毎月の給料日（日）</Text>
              <TextInput style={styles.quickInput} placeholder="例: 25" keyboardType="numeric" value={payday.toString()} onChangeText={(text) => { const day = parseInt(text) || 1; setPayday(day > 31 ? 31 : day); }} />
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: "center" }}>
              <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-around", marginBottom: 20, backgroundColor: '#F8F9FA', paddingVertical: 15, borderRadius: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.dashLabel}>合計出費</Text>
                  <Text style={styles.dashTotal}>¥{monthlyTotal.toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.dashLabel}>今月の残高</Text>
                  <Text style={[styles.dashTotal, { color: monthlyBudget - monthlyTotal < 0 ? "#FF3B30" : "#2E7D32" }]}>¥{(monthlyBudget - monthlyTotal).toLocaleString()}</Text>
                </View>
              </View>
              {pieData.length > 0 ? (
                <PieChart data={pieData} width={screenWidth * 0.85} height={200} chartConfig={{ color: () => `black` }} accessor={"population"} backgroundColor={"transparent"} paddingLeft={"15"} absolute hasLegend={true} />
              ) : (
                <Text style={{ color: "#999", marginVertical: 40 }}>まだデータがありません</Text>
              )}
            </View>
          )}
        </View>
      ) : (
        /* 日別詳細モード */
        <View style={styles.dashboardSplit}>
          <View style={styles.dashLeft}>
            <Text style={styles.dashLabel}>{selectedDate} の出費</Text>
            <Text style={styles.dashTotal}>¥{dailyTotal.toLocaleString()}</Text>
            {scheduleData[selectedDate] && (
              <View style={{ marginTop: 10 }}>
                {scheduleData[selectedDate].filter((i) => i.isExpense).map((item) => (
                  <Text key={item.id} style={{ fontSize: 13, color: "#555", marginBottom: 4 }} numberOfLines={1}>・{item.title} (¥{item.amount})</Text>
                ))}
              </View>
            )}
          </View>
          <View style={styles.dashRight}>
            <Text style={styles.dashLabel}>金額</Text>
            <TextInput style={styles.quickInput} placeholder="例: 800" keyboardType="numeric" value={quickAmount} onChangeText={setQuickAmount} />
            <Text style={[styles.dashLabel, { marginTop: 10 }]}>カテゴリで追加</Text>
            <View style={styles.chipContainer}>
              {["食費", "交通費", "趣味", "日用"].map((cat) => (
                <TouchableOpacity key={cat} style={styles.quickChip} onPress={() => handleQuickAdd(cat)}>
                  <Text style={styles.quickChipText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// 🌟 5. 家計簿専用のデザイン
const styles = StyleSheet.create({
  toggleContainer: { flexDirection: "row", backgroundColor: "#EFEFF4", borderRadius: 8, padding: 3, marginBottom: 15 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  toggleActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleText: { color: "#8E8E93", fontWeight: "bold" },
  toggleTextActive: { color: "#333", fontWeight: "bold" },
  dashboardSplit: { flexDirection: "row", justifyContent: "space-between" },
  dashLeft: { width: "48%", backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E5E5EA" },
  dashRight: { width: "49%", backgroundColor: "#F8FFF9", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#D1E8D5" },
  dashLabel: { fontSize: 11, color: "#666", fontWeight: "bold", marginBottom: 5 },
  dashTotal: { fontSize: 20, fontWeight: "bold", color: "#333" },
  quickInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, height: 40, fontSize: 16, marginBottom: 10 },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  quickChip: { backgroundColor: "#fff", paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: "#ccc", width: "48%", marginBottom: 8, alignItems: "center" },
  quickChipText: { fontSize: 11, color: "#333", fontWeight: "bold" },
});