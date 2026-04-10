import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";

import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import {
  CalendarList,
  CalendarProvider,
  WeekCalendar,
} from "react-native-calendars";

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

import LayerManagementModal from "./components/LayerManagementModal";
import MoneyDashboard from "./components/MoneyDashboard";
import ScheduleModal from "./components/ScheduleModal";
import TabBar from "./components/TabBar";

const getTodayString = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = ("0" + (date.getMonth() + 1)).slice(-2);
  const d = ("0" + date.getDate()).slice(-2);
  return `${y}-${m}-${d}`;
};

// 色を「白で薄めて」綺麗なパステルカラーを作る魔法の関数
const getPastelColor = (hex: string) => {
  if (!hex || hex.length !== 7) return "#F8F9FA"; // 色がない時は通常の白グレー

  // 16進数の色（#34C759）をRGB（赤・緑・青）に分解する
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // 🎨 元の色を8%、白(255)を92%混ぜる（mixの数字を変えれば濃さを調整できます！）
  const mix = 0.08;
  const rLight = Math.round(r * mix + 255 * (1 - mix));
  const gLight = Math.round(g * mix + 255 * (1 - mix));
  const bLight = Math.round(b * mix + 255 * (1 - mix));

  return `rgb(${rLight}, ${gLight}, ${bLight})`;
};



export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [scheduleData, setScheduleData] = useState<{ [key: string]: ScheduleItem[] }>({});

  // 🌟 新機能：レイヤーとサブタグの「辞書」を管理するState
  const [layerMaster, setLayerMaster] = useState<{ [key: string]: string }>({});
  const [tagMaster, setTagMaster] = useState<{ [key: string]: { layer: string; color: string } }>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await AsyncStorage.getItem("myScheduleData");
        if (savedData !== null) setScheduleData(JSON.parse(savedData));

        // 🌟 辞書の読み込み（なければ初期値をセット）
        const savedLayers = await AsyncStorage.getItem("layerMasterData");
        if (savedLayers) {
          setLayerMaster(JSON.parse(savedLayers));
        } else {
          setLayerMaster({ "ライブ": "#34C759", "大学": "#007AFF", "生活": "#FF9500" });
        }

        const savedTags = await AsyncStorage.getItem("tagMasterData");
        if (savedTags) setTagMaster(JSON.parse(savedTags));
      } catch (error) {
        console.error("データの読み込みに失敗しました", error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem("myScheduleData", JSON.stringify(scheduleData));
      } catch (error) { }
    };
    if (Object.keys(scheduleData).length > 0) saveData();
  }, [scheduleData]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [activeMode, setActiveMode] = useState("calendar");
  const [activeTags, setActiveTags] = useState<string[]>([]); // ここには「選ばれたレイヤー名」が入る
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [layerModalVisible, setLayerModalVisible] = useState(false);

  const handleOpenNewModal = () => {
    setSelectedItem(null);
    setModalVisible(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const toggleTodo = (date: any, id: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newData = { ...scheduleData };
    newData[date] = newData[date].map((item) =>
      item.id === id ? { ...item, isDone: !item.isDone } : item,
    );
    setScheduleData(newData);
  };

  const toggleTag = (layer: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeTags.includes(layer)) {
      setActiveTags(activeTags.filter((t) => t !== layer));
    } else {
      setActiveTags([...activeTags, layer]);
    }
  };

  // 🌟 ヘルパー関数：タグから所属レイヤーと色を割り出す
  const getItemLayerInfo = (tag: string) => {
    if (tagMaster[tag]) return tagMaster[tag];
    return { layer: "生活", color: "#999999" }; // 辞書にない場合の保険
  };

  //背景色の計算
  // レイヤーカラーを取得
  const activeLayerColor = activeTags.length === 1 && layerMaster[activeTags[0]]
    ? layerMaster[activeTags[0]]
    : null;

  // ① 背景用
  const currentBgColor = activeLayerColor ? getPastelColor(activeLayerColor) : "#F8F9FA";

  // ② カレンダー文字/ボタン用：レイヤーそのままの濃い色（選択されてなければ青）
  const currentSolidColor = activeLayerColor ? activeLayerColor : "#007AFF";

  const getMarkedDates = () => {
    let marked: any = {};
    Object.keys(scheduleData).forEach((date) => {
      const items = scheduleData[date];
      let dots: any[] = [];

      items.forEach((item) => {
        const { layer, color: subColor } = getItemLayerInfo(item.tag);

        // 🌟 フィルター判定（タグ名ではなく「所属レイヤー」で判定する）
        if (activeTags.length > 0 && !activeTags.includes(layer)) return;

        // 🌟 二段階カラー切り替えの魔法
        const displayColor = activeTags.length === 0
          ? (layerMaster[layer] || "#999") // すべて表示：レイヤー色
          : subColor;                      // 個別表示：サブタグ色

        if (activeMode === "calendar" && item.isEvent) dots.push({ key: item.id, color: displayColor });
        else if (activeMode === "todo" && item.isTodo) dots.push({ key: item.id, color: displayColor });
        else if (activeMode === "money" && item.isExpense) dots.push({ key: item.id, color: displayColor });
      });

      if (dots.length > 0) marked[date] = { dots: dots };
    });

    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: currentSolidColor
    };
    return marked;
  };

  const renderTodoItem = (item: any) => {
    const { layer, color: subColor } = getItemLayerInfo(item.tag);
    const displayColor = activeTags.length === 0 ? (layerMaster[layer] || "#999") : subColor;

    return (
      <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => openEditModal(item)}>
        <View style={styles.itemMain}>
          <Text style={[styles.itemTitle, item.isDone && { color: "#ccc", textDecorationLine: "line-through" }]}>
            {item.title}
          </Text>
        </View>
        <TouchableOpacity onPress={() => toggleTodo(selectedDate, item.id)}>
          <Text style={{ fontSize: 24 }}>{item.isDone ? "✅" : "⬜️"}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    // 🌟 修正1：画面の一番の大元（下敷き）をテーマカラーで染める！
    <SafeAreaView style={[styles.container, { backgroundColor: currentBgColor }]}>

      {/* 🌟 修正2：ヘッダーの背景色もテーマカラーに合わせる！ */}
      <TouchableOpacity
        style={[styles.header, { backgroundColor: currentBgColor }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilterModalVisible(true); }}
      >
        <Text style={styles.headerText}>≡ {activeTags.length === 0 ? "日常（すべて）" : activeTags.join(", ")}</Text>
      </TouchableOpacity>

      <TabBar
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        themeColor={currentSolidColor}
      />

      {/*メイン領域の背景は「透明」にして、大元の色を透かす！ */}
      <View style={[styles.main, { backgroundColor: "transparent" }]}>
        <View style={[styles.calendarContainer, { backgroundColor: "transparent" }]}>
          {activeMode === "money" ? (
            <View style={{ height: 130 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 20, marginTop: 10, marginBottom: 5 }}>
                {parseInt(selectedDate.split('-')[1])}
              </Text>
              <CalendarProvider key={activeTags.join(',')} date={selectedDate} onDateChanged={(date) => setSelectedDate(date)}>
                <WeekCalendar firstDay={1} markedDates={getMarkedDates()}
                  theme={{
                    calendarBackground: currentBgColor,
                    todayTextColor: currentSolidColor,
                    selectedDayBackgroundColor: currentSolidColor,
                    selectedDayTextColor: "#ffffff",
                    dotColor: currentSolidColor
                  }} />
              </CalendarProvider>
            </View>
          ) : (
            <CalendarList
              key={currentSolidColor}
              markingType={"multi-dot"}
              renderHeader={(date) => (
                <View style={styles.monthHeaderContainer}>
                  <Text style={[styles.monthformat, { color: currentSolidColor }]}>
                    {date.getMonth() + 1}
                  </Text>
                </View>
              )}
              horizontal={true}
              pagingEnabled={true}
              markedDates={getMarkedDates()}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              theme={{
                calendarBackground: "transparent",
                todayTextColor: currentSolidColor,
                todayBackgroundColor: currentBgColor, // 今日は薄い色でハイライト
                selectedDayBackgroundColor: currentSolidColor, // 選んだ日は濃い色
                arrowColor: currentSolidColor,
              }}
            />
          )}
          <ScrollView style={[styles.scheduleList, { backgroundColor: "transparent" }]}>
            {(() => {
              const today = getTodayString();
              if (activeMode === "todo") {
                const mainTasks = scheduleData[selectedDate]?.filter((item) => {
                  const { layer } = getItemLayerInfo(item.tag);
                  const matchTag = activeTags.length === 0 || activeTags.includes(layer);
                  return item.isTodo && matchTag;
                }) || [];
                const upcomingTasks = Object.keys(scheduleData).filter((date) => date > selectedDate).sort().flatMap((date) => scheduleData[date].map((task) => ({ ...task, date }))).filter((task) => task.isTodo && !task.isDone).slice(0, 3);
                return (
                  <View>
                    <Text style={styles.sectionTitle}>{selectedDate === today ? "🔥 今日が締め切り" : `📅 ${selectedDate} 締め切り`}</Text>
                    {mainTasks.length > 0 ? mainTasks.map(renderTodoItem) : <Text style={styles.emptyText}>この日の締め切りはありません</Text>}
                  </View>
                );
              } else if (activeMode === "money") {
                return <MoneyDashboard scheduleData={scheduleData} setScheduleData={setScheduleData} selectedDate={selectedDate} />;
              } else {
                return (
                  <View>
                    <Text style={styles.dateTitle}>{selectedDate} の予定</Text>
                    {scheduleData[selectedDate] ? (
                      scheduleData[selectedDate]
                        .filter((item) => {
                          const { layer } = getItemLayerInfo(item.tag);
                          const matchMode = activeMode === "calendar" ? item.isEvent : item.isExpense;
                          const matchTag = activeTags.length === 0 || activeTags.includes(layer);
                          return matchMode && matchTag;
                        })
                        .map((item) => {
                          // 🌟 リストのバッジ色も2段階で切り替える！
                          const { layer, color: subColor } = getItemLayerInfo(item.tag);
                          const displayColor = activeTags.length === 0 ? (layerMaster[layer] || "#999") : subColor;

                          return (
                            <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => openEditModal(item)}>
                              <View style={[styles.tagBadge, { backgroundColor: displayColor }]}><Text style={styles.tagText}>{item.tag}</Text></View>
                              <View style={styles.itemMain}>
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                {activeMode === "money" && <Text style={styles.itemAmount}>￥{item.amount.toLocaleString()}</Text>}
                              </View>
                            </TouchableOpacity>
                          );
                        })
                    ) : <Text style={styles.emptyText}>予定はありません</Text>}
                  </View>
                );
              }
            })()}
          </ScrollView>
        </View>
      </View>
      <StatusBar style="auto" />

      {/* モーダルには最新の辞書データを渡す */}
      <ScheduleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedDate={selectedDate}
        selectedItem={selectedItem}
        activeMode={activeMode}
        scheduleData={scheduleData}
        setScheduleData={setScheduleData}
        layerMaster={layerMaster}
        tagMaster={tagMaster}
        setTagMaster={setTagMaster}
      // ここで tagMaster などを ScheduleModal に渡すようになると完璧ですが、
      // 今は ScheduleModal 側で AsyncStorage から直接読んでいるならそのままでOKです。
      />

      {/*レイヤー管理モーダル*/}
      <LayerManagementModal
        visible={layerModalVisible}
        onClose={() => setLayerModalVisible(false)}
        layerMaster={layerMaster}
        setLayerMaster={setLayerMaster}
      />

      <Modal visible={filterModalVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <View style={styles.filterModalContent}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
              <Text style={{ fontSize: 16, fontWeight: "bold" }}>表示するレイヤーを選択</Text>
              {/* 🌟 追加：将来レイヤーを追加・編集するためのボタン */}
              <TouchableOpacity onPress={() => {
                setFilterModalVisible(false); // フィルター画面は閉じる
                setLayerModalVisible(true);   // 管理画面を開く
              }}>
                <Text style={{ color: "#007AFF", fontWeight: "bold" }}>⚙️ 編集</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chipContainer}>
              <TouchableOpacity style={[styles.filterChip, activeTags.length === 0 && styles.filterChipActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTags([]); setFilterModalVisible(false); }}>
                <Text style={[styles.filterChipText, activeTags.length === 0 && styles.filterChipTextActive]}>すべて表示</Text>
              </TouchableOpacity>

              {/* 🌟 変更：生タグではなく、layerMaster にある「大枠のレイヤー」を表示する */}
              {Object.keys(layerMaster).map((layer) => (
                <TouchableOpacity
                  key={layer}
                  style={[styles.filterChip, activeTags.includes(layer) && styles.filterChipActive]}
                  onPress={() => { toggleTag(layer); setFilterModalVisible(false); }} // 1つ選んだら閉じる
                >
                  <Text style={[styles.filterChipText, activeTags.includes(layer) && styles.filterChipTextActive]}>
                    {layer}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: currentSolidColor }]}
        onPress={handleOpenNewModal}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: "#FFFFFF" },
  headerText: { fontSize: 22, fontWeight: "bold", color: "#333333" },
  main: { flex: 1, alignItems: "center", justifyContent: "center" },
  calendarContainer: { flex: 1, width: "100%", backgroundColor: "#FFFFFF" },
  monthHeaderContainer: { width: "100%", alignItems: "flex-start" },
  monthformat: { fontSize: 28, paddingLeft: 10, paddingBottom: 5, fontWeight: "bold", color: "#333333" },
  scheduleList: { flex: 1, width: "100%", padding: 20, backgroundColor: "#F8F9FA" },
  dateTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 15, color: "#666" },
  listItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 10, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  itemTitle: { flex: 1, fontSize: 16, color: "#333" },
  itemAmount: { fontSize: 14, color: "#666", fontWeight: "bold" },
  emptyText: { textAlign: "center", marginTop: 20, color: "#999" },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, marginRight: 10 },
  tagText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  itemMain: { flex: 1 },
  fab: { position: "absolute", right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: "#007AFF", justifyContent: "center", alignItems: "center", elevation: 5 },
  fabText: { fontSize: 30, color: "#fff" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 15, color: "#333" },
  upcomingContainer: { marginTop: 20, paddingBottom: 40 },
  divider: { height: 1, backgroundColor: "#E0E0E0", marginBottom: 15 },
  subSectionTitle: { fontSize: 14, fontWeight: "bold", color: "#666", marginBottom: 10 },
  compactListItem: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 15, backgroundColor: "#fff", borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#ADE0EE" },
  compactDate: { fontSize: 12, color: "#007AFF", fontWeight: "bold", width: 50 },
  compactTitle: { fontSize: 14, color: "#444", flex: 1 },
  filterContainer: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E5EA" },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F0F0F5", marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: "transparent" },
  filterChipActive: { backgroundColor: "#E3F2FD", borderColor: "#007AFF" },
  filterChipText: { fontSize: 12, color: "#666", fontWeight: "bold" },
  filterChipTextActive: { color: "#007AFF" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-start", paddingTop: 100 },
  filterModalContent: { backgroundColor: "#fff", marginHorizontal: 20, padding: 20, borderRadius: 15, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});