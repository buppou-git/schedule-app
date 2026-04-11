import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Dimensions, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";

// --- 型定義 ---
interface ScheduleItem {
  id: string; title: string; tag: string; amount: number;
  isDone: boolean; color: string; isEvent: boolean;
  isTodo: boolean; isExpense: boolean;
}

interface Props {
  scheduleData: { [key: string]: ScheduleItem[] };
  setScheduleData: (data: any) => void;
  selectedDate: string;
  tagMaster: { [key: string]: { layer: string; color: string } };
  layerMaster: { [key: string]: string };
  activeTags: string[];
}

export default function MoneyDashboard({ scheduleData, setScheduleData, selectedDate, tagMaster, layerMaster, activeTags }: Props) {
  const [isSummaryMode, setIsSummaryMode] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [currentModalMonth, setCurrentModalMonth] = useState(selectedDate.substring(0, 7));
  const [isSettingMode, setIsSettingMode] = useState(false);
  const [isManualInput, setIsManualInput] = useState(false);

  // --- 入力用State ---
  const [inputAmount, setInputAmount] = useState("");
  const [selectedMainTag, setSelectedMainTag] = useState(""); // 種類
  const [selectedSubTag, setSelectedSubTag] = useState("");   // 属性

  // --- 設定用State (既存ロジック維持) ---
  const [payday, setPayday] = useState(25);
  const [monthlyBudget, setMonthlyBudget] = useState(100000);
  const [layerBudgets, setLayerBudgets] = useState<{ [key: string]: number }>({});
  const [quickMainTags, setQuickMainTags] = useState(["趣味", "食費", "交通", "日用", "交際", "美容"]);
  const [subTagHistory, setSubTagHistory] = useState<string[]>(["チケット", "グッズ", "遠征費", "飲み代", "コンビニ", "スーパー"]);

  const screenWidth = Dimensions.get("window").width;
  const halfWidth = (screenWidth - 40) / 2;

  // テーマカラー決定
  const isSingleFilter = activeTags.length === 1;
  const currentLayer = activeTags[0] || "default";
  const themeColor = isSingleFilter ? (layerMaster[currentLayer] || "#007AFF") : "#007AFF";

  useEffect(() => { setIsSummaryMode(false); }, [selectedDate]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedBudget = await AsyncStorage.getItem("myMonthlyBudget");
        const savedPayday = await AsyncStorage.getItem("myPayday");
        const savedLayerBudgets = await AsyncStorage.getItem("layerBudgetsData");
        if (savedBudget !== null) setMonthlyBudget(parseInt(savedBudget));
        if (savedPayday !== null) setPayday(parseInt(savedPayday));
        if (savedLayerBudgets !== null) setLayerBudgets(JSON.parse(savedLayerBudgets));
      } catch (error) { console.error(error); }
    };
    loadSettings();
  }, []);

  // 🌟 修正：三要素バリデーション付き追加ロジック
  const handleAddExpense = () => {
    const amountNum = parseInt(inputAmount);
    // 金額・種類・属性が揃っているかチェック
    if (!selectedMainTag || !selectedSubTag || isNaN(amountNum) || amountNum <= 0) {
      return Alert.alert("入力不足", "金額・種類・属性のすべてを選択または入力してください。");
    }

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      title: selectedSubTag, // 属性（例：チケット代）をタイトルに
      tag: selectedMainTag,  // 種類（例：趣味）をタグに
      amount: amountNum,
      isDone: false,
      color: tagMaster[selectedSubTag]?.color || tagMaster[selectedMainTag]?.color || themeColor,
      isEvent: false, isTodo: false, isExpense: true
    };

    const newData = { ...scheduleData };
    newData[selectedDate] = [...(newData[selectedDate] || []), newItem];
    setScheduleData(newData);

    // クリア
    setInputAmount("");
    setSelectedSubTag("");
    Keyboard.dismiss();
  };

  // --- 統計・グラフ・履歴ロジック (提供されたコードを100%維持) ---
  const getStatsForMonth = (monthStr: string) => {
    let total = 0; const totals: { [key: string]: number } = {};
    Object.keys(scheduleData).filter(date => date.startsWith(monthStr)).forEach((date) => {
      scheduleData[date].forEach((item) => {
        if (!item.isExpense) return;
        const itemLayer = tagMaster[item.tag]?.layer || "生活";
        if (activeTags.length > 0 && !activeTags.includes(itemLayer)) return;
        total += item.amount;
        const groupKey = isSingleFilter ? item.tag : itemLayer;
        totals[groupKey] = (totals[groupKey] || 0) + item.amount;
      });
    });
    return { total, totals };
  };

  const lineChartData = useMemo(() => {
    const labels: string[] = []; const data: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      labels.push(`${d.getMonth() + 1}月`);
      data.push(getStatsForMonth(mStr).total || 0);
    }
    return { labels, datasets: [{ data }] };
  }, [scheduleData, activeTags]);

  const mainStats = useMemo(() => {
    const s = getStatsForMonth(selectedDate.substring(0, 7));
    let dTotal = 0; (scheduleData[selectedDate] || []).forEach(i => { if(i.isExpense) dTotal += i.amount; });
    return { ...s, dailyTotal: dTotal };
  }, [selectedDate, scheduleData, activeTags]);

  const stats = useMemo(() => {
    const currentMonth = selectedDate.substring(0, 7);
    let total = 0; let dTotal = 0; const totals: { [key: string]: number } = {};
    Object.keys(scheduleData).forEach((date) => {
      if (date.startsWith(currentMonth)) {
        scheduleData[date].forEach((item) => {
          if (!item.isExpense) return;
          const itemLayer = tagMaster[item.tag]?.layer || "生活";
          if (activeTags.length > 0 && !activeTags.includes(itemLayer)) return;
          total += item.amount;
          if (date === selectedDate) dTotal += item.amount;
          const groupKey = isSingleFilter ? item.tag : itemLayer;
          totals[groupKey] = (totals[groupKey] || 0) + item.amount;
        });
      }
    });
    return { monthlyTotal: total, dailyTotal: dTotal, categoryTotals: totals };
  }, [scheduleData, selectedDate, activeTags, tagMaster, isSingleFilter]);

  const filteredHistory = useMemo(() => {
    const days: { date: string, items: ScheduleItem[] }[] = [];
    Object.keys(scheduleData).filter(d => d.startsWith(currentModalMonth)).sort((a,b)=>b.localeCompare(a)).forEach(date => {
      const items = scheduleData[date].filter(i => i.isExpense && (activeTags.length === 0 || activeTags.includes(tagMaster[i.tag]?.layer || "生活")));
      if (items.length > 0) days.push({ date, items });
    });
    return days;
  }, [scheduleData, currentModalMonth, activeTags]);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<{item: ScheduleItem, date: string} | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const currentActiveLayer = isSingleFilter ? activeTags[0] : null; 
  const activeLimit = currentActiveLayer && layerBudgets[currentActiveLayer] ? layerBudgets[currentActiveLayer] : monthlyBudget;
  const progress = Math.min(stats.monthlyTotal / activeLimit, 1);
  const statusColor = stats.monthlyTotal > activeLimit ? "#FF3B30" : themeColor;

  return (
    <View style={styles.container}>
      {/* モード切替 */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity style={[styles.toggleBtn, !isSummaryMode && styles.toggleActive]} onPress={() => setIsSummaryMode(false)}>
          <View style={styles.toggleItem}><Ionicons name="list" size={16} color={!isSummaryMode ? "#1C1C1E" : "#8E8E93"} /><Text style={styles.toggleText}>日別詳細</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, isSummaryMode && styles.toggleActive]} onPress={() => setIsSummaryMode(true)}>
          <View style={styles.toggleItem}><Ionicons name="pie-chart" size={15} color={isSummaryMode ? "#1C1C1E" : "#8E8E93"} /><Text style={styles.toggleText}>予算統計</Text></View>
        </TouchableOpacity>
      </View>

      {isSummaryMode ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.iconTextRow}><MaterialCommunityIcons name="piggy-bank-outline" size={18} color={themeColor} /><Text style={[styles.paydayText, {color: themeColor}]}>給料日まで あと {Math.max(0, payday - new Date(selectedDate).getDate())} 日</Text></View>
            <TouchableOpacity onPress={() => setIsSettingMode(!isSettingMode)}><Ionicons name={isSettingMode ? "checkmark-circle" : "options-outline"} size={22} color={themeColor} /></TouchableOpacity>
          </View>
          {isSettingMode ? (
            <View style={styles.settingArea}>
              <Text style={styles.settingLabel}>月間予算設定</Text>
              <TextInput style={styles.settingInput} keyboardType="numeric" value={monthlyBudget.toString()} onChangeText={(t) => { setMonthlyBudget(parseInt(t) || 0); AsyncStorage.setItem("myMonthlyBudget", t); }} />
              <Text style={styles.settingLabel}>給料日指定</Text>
              <TextInput style={styles.settingInput} keyboardType="numeric" placeholder="25" value={payday.toString()} onChangeText={(t) => { setPayday(parseInt(t) || 25); AsyncStorage.setItem("myPayday", t); }} />
            </View>
          ) : (
            <>
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}><Text style={styles.progressLabel}>{currentLayer || "全体"}</Text><Text style={[styles.progressPercent, {color: statusColor}]}>{Math.round(progress * 100)}%</Text></View>
                <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: statusColor }]} /></View>
              </View>
              <View style={styles.chartArea}>
                <PieChart data={Object.keys(stats.categoryTotals).map(key => ({ name: key, population: stats.categoryTotals[key], color: isSingleFilter ? (tagMaster[key]?.color || "#E5E5EA") : (layerMaster[key] || "#E5E5EA"), legendFontColor: "#666", legendFontSize: 11 }))} width={screenWidth * 0.8} height={160} chartConfig={{ color: () => `black` }} accessor={"population"} backgroundColor={"transparent"} paddingLeft={"15"} absolute />
              </View>
              <TouchableOpacity style={styles.fullHistoryButton} onPress={() => setIsHistoryModalVisible(true)}>
                <Text style={[styles.fullHistoryButtonText, {color: themeColor}]}>全履歴と分析を確認</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.dailyContainer}>
          <View style={[styles.dailyHalf, { width: halfWidth }]}>
            <View style={styles.iconTextRowSmall}><Ionicons name="receipt-outline" size={12} color={themeColor} /><Text style={[styles.dailyLabel, {color: themeColor}]}>{selectedDate.split('-')[2]}日支出</Text></View>
            <Text style={styles.dailyTotalText}>¥{mainStats.dailyTotal.toLocaleString()}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(scheduleData[selectedDate] || []).filter(i => i.isExpense).map(item => (
                <TouchableOpacity key={item.id} style={styles.dailyItemRow} onPress={() => { setEditingItem({ item, date: selectedDate }); setEditAmount(item.amount.toString()); setEditModalVisible(true); }}>
                  <View style={[styles.dailyItemDot, { backgroundColor: item.color }]} />
                  <Text style={styles.dailyItemText} numberOfLines={1}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 🌟 修正：二段構え入力エリア */}
          <View style={[styles.dailyHalf, styles.dailyRightBg, { width: halfWidth, borderColor: `${themeColor}33` }]}>
            <View style={styles.inputHeaderRow}>
              <Text style={[styles.dailyLabel, {color: themeColor}]}>{isManualInput ? "詳細入力" : "クイック"}</Text>
              <TouchableOpacity onPress={() => setIsManualInput(!isManualInput)}><Ionicons name={isManualInput ? "flash" : "create-outline"} size={14} color={themeColor} /></TouchableOpacity>
            </View>

            <TextInput style={styles.quickInput} placeholder="¥ 0" keyboardType="numeric" value={inputAmount} onChangeText={setInputAmount} />

            {isManualInput ? (
              <View style={styles.manualInputArea}>
                <TextInput style={styles.smallManualInput} placeholder="内容" value={selectedSubTag} onChangeText={setSelectedSubTag} />
                <TextInput style={styles.smallManualInput} placeholder="種類" value={selectedMainTag} onChangeText={setSelectedMainTag} />
                <TouchableOpacity style={[styles.addExecuteBtn, {backgroundColor: themeColor}]} onPress={handleAddExpense}>
                  <Ionicons name="checkmark-done" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                {/* 1. 種類 (種類を選択) */}
                <View style={styles.quickGrid}>
                  {quickMainTags.map(tag => (
                    <TouchableOpacity 
                      key={tag} 
                      style={[styles.miniChip, selectedMainTag === tag && { backgroundColor: themeColor }]} 
                      onPress={() => setSelectedMainTag(tag)}
                    >
                      <Text style={[styles.miniChipText, selectedMainTag === tag && { color: '#fff' }]}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 2. 属性 (属性を横スクロール選択) */}
                <View style={styles.subTagSection}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTagScroll}>
                    {subTagHistory.map(sub => (
                      <TouchableOpacity 
                        key={sub} 
                        style={[styles.subChip, selectedSubTag === sub && { borderColor: themeColor, backgroundColor: `${themeColor}10` }]} 
                        onPress={() => setSelectedSubTag(sub)}
                      >
                        <Text style={[styles.subChipText, selectedSubTag === sub && { color: themeColor, fontWeight: 'bold' }]}>{sub}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <TouchableOpacity style={[styles.addExecuteBtn, {backgroundColor: themeColor}]} onPress={handleAddExpense}>
                  <Ionicons name="checkmark-done" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 履歴モーダル */}
      <Modal visible={isHistoryModalVisible} animationType="slide">
        <View style={styles.historyModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderText}>支出分析レポート</Text>
            <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}><Ionicons name="close-circle" size={32} color="#8E8E93" /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.analysisCard}>
              <Text style={styles.analysisTitle}>支出推移 (過去6ヶ月)</Text>
              <LineChart data={lineChartData} width={screenWidth - 40} height={160} chartConfig={{ backgroundColor: "#fff", backgroundGradientFrom: "#fff", backgroundGradientTo: "#fff", decimalPlaces: 0, color: () => themeColor, labelColor: () => `#333`, propsForDots: { r: "5", strokeWidth: "2", stroke: themeColor } }} bezier style={styles.lineChartStyle} />
            </View>
            <View style={styles.monthNavigator}>
              <TouchableOpacity onPress={() => { const [y, m] = currentModalMonth.split('-').map(Number); const d = new Date(y, m - 2, 1); setCurrentModalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }} style={styles.navBtn}><Ionicons name="chevron-back" size={24} color={themeColor} /></TouchableOpacity>
              <View style={styles.monthDisplay}><Text style={styles.monthDisplayText}>{currentModalMonth.replace('-', '年')}月</Text></View>
              <TouchableOpacity onPress={() => { const [y, m] = currentModalMonth.split('-').map(Number); const d = new Date(y, m, 1); setCurrentModalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }} style={styles.navBtn}><Ionicons name="chevron-forward" size={24} color={themeColor} /></TouchableOpacity>
            </View>
            {filteredHistory.map(dayGroup => (
              <View key={dayGroup.date} style={styles.dayGroup}>
                <View style={styles.dayHeader}><Text style={[styles.dayHeaderText, {color: themeColor}]}>{dayGroup.date.substring(8, 10)}日</Text><View style={[styles.dayLine, {backgroundColor: `${themeColor}33`}]} /></View>
                {dayGroup.items.map(item => (
                  <TouchableOpacity key={item.id} style={styles.historyRow} onPress={() => { setEditingItem({ item, date: dayGroup.date }); setEditAmount(item.amount.toString()); setEditModalVisible(true); }}>
                    <View style={styles.historyLeft}><View style={[styles.historyDot, { backgroundColor: item.color }]} /><View><Text style={styles.historyTitle}>{item.title}</Text><Text style={styles.historyTag}>{item.tag}</Text></View></View>
                    <Text style={styles.historyAmount}>¥{item.amount.toLocaleString()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* 編集モーダル */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModalVisible(false)}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>{editingItem?.item.title} の編集</Text>
            <TextInput style={styles.editInput} keyboardType="numeric" value={editAmount} onChangeText={setEditAmount} autoFocus />
            <View style={styles.editActionRow}>
              <TouchableOpacity onPress={() => { const newData = { ...scheduleData }; newData[editingItem!.date] = newData[editingItem!.date].filter(i => i.id !== editingItem!.item.id); setScheduleData(newData); setEditModalVisible(false); }}><Text style={{color: "#FF3B30", fontWeight: "bold"}}>削除</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, {backgroundColor: themeColor}]} onPress={() => { const newData = { ...scheduleData }; newData[editingItem!.date] = newData[editingItem!.date].map(i => i.id === editingItem!.item.id ? { ...i, amount: parseInt(editAmount) || 0 } : i); setScheduleData(newData); setEditModalVisible(false); }}><Text style={styles.saveText}>保存</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', paddingHorizontal: 15 },
  toggleContainer: { flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: 12, padding: 3, marginBottom: 15 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleActive: { backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3 },
  toggleText: { color: "#8E8E93", fontWeight: "bold", fontSize: 13 },
  summaryCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#E5E5EA" },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  paydayText: { fontSize: 14, fontWeight: "bold" },
  progressSection: { marginBottom: 15 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 },
  progressLabel: { fontSize: 11, color: "#999", fontWeight: "bold" },
  progressPercent: { fontSize: 24, fontWeight: "900" },
  progressBarBg: { height: 10, backgroundColor: "#F2F2F7", borderRadius: 5, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 5 },
  chartArea: { alignItems: "center", marginBottom: 10 },
  noDataText: { color: "#CCC", marginVertical: 30, fontSize: 12 },
  fullHistoryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F2F2F7', marginTop: 10 },
  fullHistoryButtonText: { fontWeight: 'bold', fontSize: 14 },
  settingArea: { paddingVertical: 5 },
  settingLabel: { fontSize: 12, fontWeight: "bold", color: "#666", marginBottom: 8, marginTop: 10 },
  settingInput: { backgroundColor: "#F9F9F9", borderWidth: 1, borderColor: "#EEE", borderRadius: 10, padding: 12, marginBottom: 15, fontSize: 16 },
  
  dailyContainer: { flexDirection: "row", justifyContent: "space-between", width: '100%', height: 280 }, 
  dailyHalf: { backgroundColor: "#fff", padding: 12, borderRadius: 20, borderWidth: 1, borderColor: "#E5E5EA", overflow: 'hidden' },
  dailyRightBg: { backgroundColor: "#F8FFF9" },
  dailyTotalText: { fontSize: 22, fontWeight: "bold", color: "#333", marginBottom: 5 },
  dailyItemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#F2F2F7' },
  dailyItemDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  dailyItemText: { fontSize: 12, color: "#555", flex: 1 },

  quickInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDD", borderRadius: 10, padding: 8, fontSize: 18, marginBottom: 10, textAlign: 'center', fontWeight: 'bold' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  miniChip: { width: '31%', backgroundColor: '#F2F2F7', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  miniChipText: { fontSize: 9, fontWeight: 'bold', color: '#666' },

  subTagSection: { borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 8 },
  subTagScroll: { flexDirection: 'row', marginBottom: 8 },
  subChip: { borderWidth: 1, borderColor: '#EEE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 6, backgroundColor: '#fff' },
  subChipText: { fontSize: 10, color: '#999' },
  
  manualInputArea: { marginTop: 2 },
  smallManualInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DDD", borderRadius: 8, padding: 6, fontSize: 12, marginBottom: 6, textAlign: 'center' },
  addExecuteBtn: { marginTop: 5, paddingVertical: 8, borderRadius: 10, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  
  inputHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dailyLabel: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  iconTextRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  iconTextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  
  historyModalContainer: { flex: 1, backgroundColor: "#F2F2F7", paddingTop: 50 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 15 },
  modalHeaderText: { fontSize: 22, fontWeight: "bold", color: "#1C1C1E" },
  modalScroll: { flex: 1, paddingHorizontal: 15 },
  analysisCard: { backgroundColor: "#fff", borderRadius: 20, padding: 15, marginBottom: 15 },
  analysisTitle: { fontSize: 13, fontWeight: "bold", color: "#8E8E93", marginBottom: 10 },
  lineChartStyle: { marginVertical: 8, borderRadius: 16, paddingRight: 40 },
  monthNavigator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15, gap: 15 },
  monthDisplay: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 25 },
  monthDisplayText: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E' },
  navBtn: { backgroundColor: '#fff', padding: 10, borderRadius: 20 },
  dayGroup: { marginBottom: 20 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dayHeaderText: { fontSize: 16, fontWeight: 'bold', marginRight: 10 },
  dayLine: { flex: 1, height: 1 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderRadius: 15, marginBottom: 8 },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyTitle: { fontSize: 14, fontWeight: "600", color: "#333" },
  historyTag: { fontSize: 10, color: "#999", marginTop: 2 },
  historyAmount: { fontSize: 14, fontWeight: "bold", color: "#1C1C1E" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  editCard: { width: "85%", backgroundColor: "#fff", borderRadius: 25, padding: 25 },
  editTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 15, textAlign: "center", color: "#666" },
  editInput: { backgroundColor: "#F2F2F7", padding: 15, borderRadius: 15, fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  editActionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saveBtn: { paddingHorizontal: 25, paddingVertical: 12, borderRadius: 15 },
  saveText: { color: "#fff", fontWeight: "bold" },
});