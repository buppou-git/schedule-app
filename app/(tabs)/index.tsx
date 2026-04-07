import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react"; // 状態を管理する機能を追加
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

//カレンダー部品の挿入
import {
  CalendarList,
  CalendarProvider,
  WeekCalendar,
} from "react-native-calendars";
//todo用の追加機能を実装するためのパーツ
// neverエラーを防ぐ
interface ScheduleItem {
  id: string;
  title: string;
  tag: string;
  amount: number;
  isDone: boolean;
  color: string;

  //スイッチの実装
  isEvent: boolean;
  isTodo: boolean;
  isExpense: boolean;
}

//TabBarを呼び出すために挿入
import TabBar from "./components/TabBar";

//ScheduleModalを呼び出すために挿入
import ScheduleModal from "./components/ScheduleModal";

//　今日の日付を確保するための関数
const getTodayString = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = ("0" + (date.getMonth() + 1)).slice(-2); // 1月を01にする工夫
  const d = ("0" + date.getDate()).slice(-2); // 1日を01にする工夫
  return `${y}-${m}-${d}`;
};

export default function Index() {
  //　日付を保存するための変数を宣言
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const handleOpenNewModal = () => {
    setSelectedItem(null); // 空っぽにする
    setModalVisible(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setSelectedItem(item); // 選んだアイテムだけ覚えさせておく
    setModalVisible(true);
  };

  // 実際の予定の管理 (scheduleDataをuseStateに変更)
  const [scheduleData, setScheduleData] = useState<{
    [key: string]: ScheduleItem[];
  }>({});

  //ロードとセーブ機能を追加
  // 1. アプリ起動時にスマホの奥底からデータを「ロード（読み込み）」する
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await AsyncStorage.getItem("myScheduleData");
        if (savedData !== null) {
          // 保存されていたら、文字(JSON)からデータに戻してセットする
          setScheduleData(JSON.parse(savedData));
        }
      } catch (error) {
        console.error("データの読み込みに失敗しました", error);
      }
    };
    loadData();
  }, []); // [] は「アプリ起動時に1回だけ実行する」という合図

  // 2. scheduleData の中身が変わるたびに、自動でスマホに「セーブ」する
  useEffect(() => {
    const saveData = async () => {
      try {
        // データを文字(JSON)に変換して保存する
        await AsyncStorage.setItem(
          "myScheduleData",
          JSON.stringify(scheduleData),
        );
      } catch (error) {
        console.error("データの保存に失敗しました", error);
      }
    };

    // 初期状態（空っぽ）の時は、間違えて空のデータを上書き保存しないようにする工夫
    if (Object.keys(scheduleData).length > 0) {
      saveData();
    }
  }, [scheduleData]); // [scheduleData] は「このデータが変化した時だけ実行する」という合図

  //{家計簿のための計算ロジック}
  //家計簿用の新しいState（状態管理）
  const [isSummaryMode, setIsSummaryMode] = useState(false); // 日別か、月間か
  const [monthlyBudget, setMonthlyBudget] = useState(100000); // 今月の予算
  const [quickAmount, setQuickAmount] = useState(""); // クイック入力の金額

  // 今日の合計出費を自動計算
  const dailyTotal = (scheduleData[selectedDate] || [])
    .filter((item) => item.isExpense)
    .reduce((sum, item) => sum + item.amount, 0);

  // 今月の合計出費を自動計算
  const currentMonth = selectedDate.substring(0, 7); // "2026-03" を切り出す
  let monthlyTotal = 0;
  Object.keys(scheduleData).forEach((date) => {
    if (date.startsWith(currentMonth)) {
      scheduleData[date].forEach((item) => {
        if (item.isExpense) monthlyTotal += item.amount;
      });
    }
  });

  // クイック入力の保存機能
  const handleQuickAdd = (category: string) => {
    const amountNum = parseInt(quickAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return Alert.alert("エラー", "正しい金額を入力してください");
    }

    const newItem = {
      id: Date.now().toString(),
      title: category, // タイトルは「食費」などになる
      tag: category,
      amount: amountNum,
      isDone: false,
      // カテゴリによって色を自動で分ける工夫
      color:
        category === "食費"
          ? "#FF9500"
          : category === "交通費"
            ? "#007AFF"
            : "#34C759",
      isEvent: false,
      isTodo: false,
      isExpense: true,
    };

    // 保存処理（お馴染みのやつ）
    const newData = { ...scheduleData };
    newData[selectedDate] = [...(newData[selectedDate] || []), newItem];
    setScheduleData(newData);
    setQuickAmount(""); // 入力が終わったら欄を空にする
  };

  //モーダルと入力用のstate
  const [modalVisible, setModalVisible] = useState(false);

  //　チェックボタンを動かすための関数
  const toggleTodo = (date: any, id: any) => {
    const newData = { ...scheduleData };
    newData[date] = newData[date].map((item) =>
      item.id === id ? { ...item, isDone: !item.isDone } : item,
    );
    setScheduleData(newData);
  };

  //　ToDoの1行分を表示するためのパーツ
  const renderTodoItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={styles.listItem}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.itemMain}>
        <Text
          style={[
            styles.itemTitle,
            item.isDone && {
              color: "#ccc",
              textDecorationLine: "line-through",
            },
          ]}
        >
          {item.title}
        </Text>
      </View>
      {/* チェックボタンはそのまま */}
      <TouchableOpacity onPress={() => toggleTodo(selectedDate, item.id)}>
        <Text style={{ fontSize: 24 }}>{item.isDone ? "✅" : "⬜️"}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // 予定を編集、削除するためのパーツ
  // 1. 「どのアイテムを編集・削除中か」を覚えるための箱
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);

  // モーダルを閉じる時のお掃除関数（新規追加時と共通で使うと便利）
  const closeModal = () => {
    setModalVisible(false);
  };

  // 「今どのモードか」を記憶する箱（初期値は 'calendar'）
  const [activeMode, setActiveMode] = useState("calendar");

  //　各モードに対応するドットを出力する関数
  const getMarkedDates = () => {
    let marked: any = {}; //空の最終結果リストを準備
    Object.keys(scheduleData).forEach((date) => {
      const items = scheduleData[date];
      let dots: any[] = [];

      items.forEach((item) => {
        // モード別のフィルター
        if (activeMode === "calendar" && item.isEvent)
          dots.push({ key: item.id, color: item.color });
        else if (activeMode === "todo" && item.isTodo)
          dots.push({ key: item.id, color: item.color });
        else if (activeMode === "money" && item.isExpense)
          dots.push({ key: item.id, color: item.color });
      });

      if (dots.length > 0) marked[date] = { dots: dots };
    });

    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: "#ADE0EE",
    };
    return marked;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 画面上部：ヘッダー領域 */}
      <View style={styles.header}>
        <Text style={styles.headerText}>≡ 日常（すべて）</Text>
      </View>

      <TabBar activeMode={activeMode} setActiveMode={setActiveMode} />

      {/* 画面中央：メイン領域（モードによって文字が変わる！） */}
      <View style={styles.main}>
        <View style={styles.calendarContainer}>
          {activeMode === "money" ? (
            <View style={{ height: 100 }}>
              <CalendarProvider
                date={selectedDate}
                onDateChanged={(date) => {
                  setSelectedDate(date);
                  setIsSummaryMode(false); // 日付を触ったら自動で「日別詳細」に切り替える神UX！
                }}
              >
                <WeekCalendar
                  firstDay={1}
                  markedDates={getMarkedDates()}
                  theme={{
                    todayTextColor: "#007AFF",
                    selectedDayBackgroundColor: "#ADE0EE",
                    selectedDayTextColor: "#ffffff",
                    dotColor: "#007AFF",
                  }}
                />
              </CalendarProvider>
            </View>
          ) : (
            /* 🌟 それ以外のモード（カレンダー・ToDo）は今までの「月間カレンダー」 */
            <CalendarList
              markingType={"multi-dot"}
              hideExtraDays={false}
              showDaysFromOtherMonths={true}
              renderHeader={(date) => {
                const displayMonth = date.getMonth() + 1;
                return (
                  <View style={styles.monthHeaderContainer}>
                    <Text style={styles.monthformat}>{displayMonth}</Text>
                  </View>
                );
              }}
              horizontal={true}
              pagingEnabled={true}
              theme={{
                todayTextColor: "#ffffff",
                todayBackgroundColor: "#ADE0EE",
                arrowColor: "#007AFF",

                // @ts-ignore
                textDayOtherMonthColor: "#d3d3d3",
              }}
              markedDates={getMarkedDates()}
              onDayPress={(day) => {
                setSelectedDate(day.dateString);
              }}
            />
          )}

          {/*下部に予定リストを表示するためのエリア*/}
          <ScrollView style={styles.scheduleList}>
            {(() => {
              const today = getTodayString();

              // --- 【ToDoモード】点（当日）と線（未来）の管理 ---
              if (activeMode === "todo") {
                const mainTasks =
                  scheduleData[selectedDate]?.filter((item) => item.isTodo) ||
                  [];
                const upcomingTasks = Object.keys(scheduleData)
                  .filter((date) => date > selectedDate)
                  .sort()
                  .flatMap((date) =>
                    scheduleData[date].map((task) => ({ ...task, date })),
                  )
                  .filter((task) => task.isTodo && !task.isDone)
                  .slice(0, 3); // 未来の未完了タスクを3件だけ

                return (
                  <View>
                    <Text style={styles.sectionTitle}>
                      {selectedDate === today
                        ? "🔥 今日が締め切り"
                        : `📅 ${selectedDate} 締め切り`}
                    </Text>
                    {mainTasks.length > 0 ? (
                      mainTasks.map(renderTodoItem)
                    ) : (
                      <Text style={styles.emptyText}>
                        この日の締め切りはありません
                      </Text>
                    )}

                    {upcomingTasks.length > 0 && (
                      <View style={styles.upcomingContainer}>
                        <View style={styles.divider} />
                        <Text style={styles.subSectionTitle}>
                          ⏳ その先のやること（余裕あり）
                        </Text>
                        {upcomingTasks.map((task) => (
                          <View key={task.id} style={styles.compactListItem}>
                            <Text style={styles.compactDate}>
                              {task.date.split("-").slice(1).join("/")}
                            </Text>
                            <Text style={styles.compactTitle} numberOfLines={1}>
                              {task.title}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              }

              // 家計簿モード
              else if (activeMode === "money") {
                return (
                  <View style={{ flex: 1 }}>
                    {/* トグルスイッチ（日別 / 月間） */}
                    <View style={styles.toggleContainer}>
                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          !isSummaryMode && styles.toggleActive,
                        ]}
                        onPress={() => setIsSummaryMode(false)}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            !isSummaryMode && styles.toggleTextActive,
                          ]}
                        >
                          📅 日別詳細
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          isSummaryMode && styles.toggleActive,
                        ]}
                        onPress={() => setIsSummaryMode(true)}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            isSummaryMode && styles.toggleTextActive,
                          ]}
                        >
                          📊 月間総評
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* 左右分割コックピット */}
                    <View style={styles.dashboardSplit}>
                      {/* 👈 左側：確認エリア */}
                      <View style={styles.dashLeft}>
                        <Text style={styles.dashLabel}>
                          {isSummaryMode
                            ? `${currentMonth} の合計`
                            : `${selectedDate} の出費`}
                        </Text>
                        <Text style={styles.dashTotal}>
                          ¥
                          {isSummaryMode
                            ? monthlyTotal.toLocaleString()
                            : dailyTotal.toLocaleString()}
                        </Text>

                        {/* 月間モードなら残高も表示 */}
                        {isSummaryMode && (
                          <View style={{ marginTop: 15 }}>
                            <Text style={styles.dashLabel}>今月の残高</Text>
                            <Text
                              style={[
                                styles.dashTotal,
                                {
                                  color:
                                    monthlyBudget - monthlyTotal < 0
                                      ? "#FF3B30"
                                      : "#2E7D32",
                                },
                              ]}
                            >
                              ¥{(monthlyBudget - monthlyTotal).toLocaleString()}
                            </Text>
                          </View>
                        )}

                        {/* 日別モードなら今日の履歴をチラ見せ */}
                        {!isSummaryMode && scheduleData[selectedDate] && (
                          <View style={{ marginTop: 10 }}>
                            {scheduleData[selectedDate]
                              .filter((i) => i.isExpense)
                              .map((item) => (
                                <Text
                                  key={item.id}
                                  style={{
                                    fontSize: 13,
                                    color: "#555",
                                    marginBottom: 4,
                                  }}
                                  numberOfLines={1}
                                >
                                  ・{item.title} (¥{item.amount})
                                </Text>
                              ))}
                          </View>
                        )}
                      </View>

                      {/* 👉 右側：入力・設定エリア */}
                      <View style={styles.dashRight}>
                        {isSummaryMode ? (
                          <View>
                            <Text style={styles.dashLabel}>予算の設定</Text>
                            <TextInput
                              style={styles.quickInput}
                              placeholder="予算金額"
                              keyboardType="numeric"
                              value={monthlyBudget.toString()}
                              onChangeText={(text) =>
                                setMonthlyBudget(parseInt(text) || 0)
                              }
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                color: "#888",
                                marginTop: 5,
                              }}
                            >
                              ※入力すると即座に左の残高に反映されます
                            </Text>
                          </View>
                        ) : (
                          <View>
                            <Text style={styles.dashLabel}>金額</Text>
                            <TextInput
                              style={styles.quickInput}
                              placeholder="例: 800"
                              keyboardType="numeric"
                              value={quickAmount}
                              onChangeText={setQuickAmount}
                            />
                            <Text style={[styles.dashLabel, { marginTop: 10 }]}>
                              カテゴリを選んで追加
                            </Text>
                            <View style={styles.chipContainer}>
                              {["食費", "交通費", "趣味", "日用"].map((cat) => (
                                <TouchableOpacity
                                  key={cat}
                                  style={styles.quickChip}
                                  onPress={() => handleQuickAdd(cat)}
                                >
                                  <Text style={styles.quickChipText}>
                                    {cat}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }

              // --- 【通常・家計簿モード】これまでの表示 ---
              else {
                return (
                  <View>
                    <Text style={styles.dateTitle}>
                      {activeMode === "calendar"
                        ? `${selectedDate} の予定`
                        : `${selectedDate} の収支`}
                    </Text>
                    {scheduleData[selectedDate] ? (
                      scheduleData[selectedDate]
                        .filter((item) =>
                          activeMode === "calendar"
                            ? item.isEvent
                            : item.isExpense,
                        )
                        .map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.listItem}
                            onPress={() => openEditModal(item)}
                          >
                            <View
                              style={[
                                styles.tagBadge,
                                { backgroundColor: item.color },
                              ]}
                            >
                              <Text style={styles.tagText}>{item.tag}</Text>
                            </View>
                            <View style={styles.itemMain}>
                              <Text style={styles.itemTitle}>{item.title}</Text>
                              {activeMode === "money" && (
                                <Text style={styles.itemAmount}>
                                  ￥{item.amount.toLocaleString()}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))
                    ) : (
                      <Text style={styles.emptyText}>予定はありません</Text>
                    )}
                  </View>
                );
              }
            })()}
          </ScrollView>
        </View>
      </View>
      <StatusBar style="auto" />

      {/*入力用モーダル*/}
      <ScheduleModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedDate={selectedDate}
        selectedItem={selectedItem}
        activeMode={activeMode}
        scheduleData={scheduleData}
        setScheduleData={setScheduleData}
      />

      {/* --- 追加：右下のプラスボタン --- */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          closeModal();
          setModalVisible(true);
        }}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// デザイン（見た目）の設定
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
  },
  headerText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333333",
  },
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  monthHeaderContainer: {
    width: "100%",
    alignItems: "flex-start",
  },
  monthformat: {
    fontSize: 28,
    paddingLeft: 10,
    paddingBottom: 5,
    fontWeight: "bold",
    color: "#333333",
  },

  //下部にある表示欄
  scheduleList: {
    flex: 1,
    width: "100%",
    padding: 20,
    backgroundColor: "#F8F9FA",
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#666",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  itemAmount: {
    fontSize: 14,
    color: "#666",
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    color: "#999",
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginRight: 10,
  },
  tagText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  itemMain: { flex: 1 },

  // 右下のプラスボタン
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  fabText: {
    fontSize: 30,
    color: "#fff",
  },

  //ToDo周りのデザイン
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  upcomingContainer: {
    marginTop: 20,
    paddingBottom: 40,
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginBottom: 15,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 10,
  },
  compactListItem: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#ADE0EE",
  },
  compactDate: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "bold",
    width: 50,
  },
  compactTitle: {
    fontSize: 14,
    color: "#444",
    flex: 1,
  },

  //ダッシュボード用
  // --- ダッシュボード用デザイン ---
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#EFEFF4",
    borderRadius: 8,
    padding: 3,
    marginBottom: 15,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleText: { color: "#8E8E93", fontWeight: "bold" },
  toggleTextActive: { color: "#333", fontWeight: "bold" },

  dashboardSplit: {
    flexDirection: "row",
    flex: 1,
  },
  dashLeft: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginRight: 5,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  dashRight: {
    flex: 1.2,
    backgroundColor: "#F8FFF9",
    padding: 15,
    borderRadius: 12,
    marginLeft: 5,
    borderWidth: 1,
    borderColor: "#D1E8D5",
  },
  dashLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "bold",
    marginBottom: 5,
  },
  dashTotal: { fontSize: 22, fontWeight: "bold", color: "#333" },
  quickInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickChip: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    width: "48%",
    marginBottom: 8,
    alignItems: "center",
  },
  quickChipText: { fontSize: 12, color: "#333", fontWeight: "bold" },
});
