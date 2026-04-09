import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react"; // 状態を管理する機能を追加


import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
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

//MoneyDashboardを呼び出すために挿入
import MoneyDashboard from "./components/MoneyDashboard";

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



  //モーダルと入力用のstate
  const [modalVisible, setModalVisible] = useState(false);

  //　チェックボタンを動かすための関数
  const toggleTodo = (date: any, id: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  //タグ別カレンダーの実装
  // 1. 今「ON」になっているタグを記憶する箱（空っぽなら『すべて表示』という意味）
  const [activeTags, setActiveTags] = useState<string[]>([]);

  //フィルター画面を開いているかどうかを判定
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // 2. 賢いアルゴリズム：今あるすべての予定から、重複なく「タグ」だけを抜き出す！
  const allTags = Array.from(
    new Set(
      Object.values(scheduleData)
        .flat()
        .map((item) => item.tag)
        .filter((tag) => tag) // 空っぽのタグを除外
    )
  );

  // 3. ボタンを押した時にON/OFFを切り替える関数
  const toggleTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // ここでもブルッ！
    if (activeTags.includes(tag)) {
      // すでにONなら、リストから外す（OFFにする）
      setActiveTags(activeTags.filter((t) => t !== tag));
    } else {
      // OFFなら、リストに追加する（ONにする）
      setActiveTags([...activeTags, tag]);
    }
  };

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
      <TouchableOpacity
        style={styles.header}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setFilterModalVisible(true);
        }}
      >
        <Text style={styles.headerText}>
          ≡ {activeTags.length === 0 ? "日常（すべて）" : activeTags.join(", ")}
        </Text>
      </TouchableOpacity>

      <TabBar activeMode={activeMode} setActiveMode={setActiveMode} />


      {/* 画面中央：メイン領域（モードによって文字が変わる！） */}
      <View style={styles.main}>
        <View style={styles.calendarContainer}>
          {activeMode === "money" ? (
            <View style={{ height: 130 }}>

              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 20, marginTop: 10, marginBottom: 5 }}>
                {parseInt(selectedDate.split('-')[1])}
              </Text>

              <CalendarProvider
                date={selectedDate}
                onDateChanged={(date) => {
                  setSelectedDate(date);
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

              // --- 【家計簿モード】新しく作った専用の部屋（MoneyDashboard）を表示する！ ---
              else if (activeMode === "money") {
                return (
                  <MoneyDashboard
                    scheduleData={scheduleData}
                    setScheduleData={setScheduleData}
                    selectedDate={selectedDate}
                  />
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

      <Modal visible={filterModalVisible} transparent={true} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)} // 余白を押したら閉じる
        >
          <View style={styles.filterModalContent}>
            <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 15 }}>
              表示するレイヤーを選択
            </Text>

            <View style={styles.chipContainer}>
              {/* 「すべて」ボタン */}
              <TouchableOpacity
                style={[styles.filterChip, activeTags.length === 0 && styles.filterChipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTags([]);
                  setFilterModalVisible(false); // 選んだら自動で閉じる！
                }}
              >
                <Text style={[styles.filterChipText, activeTags.length === 0 && styles.filterChipTextActive]}>
                  すべて表示
                </Text>
              </TouchableOpacity>

              {/* 存在するタグの数だけボタンを自動生成 */}
              {allTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.filterChip, activeTags.includes(tag) && styles.filterChipActive]}
                  onPress={() => {
                    toggleTag(tag);
                    // 複数選びたい場合は下を消す。1つ選んで閉じるなら活かす！
                    // setFilterModalVisible(false); 
                  }}
                >
                  <Text style={[styles.filterChipText, activeTags.includes(tag) && styles.filterChipTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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


  //タグ切り替えボタン周りのデザイン
  filterContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F5",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#E3F2FD",
    borderColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "bold",
  },
  filterChipTextActive: {
    color: "#007AFF",
  },

  // 🌟 追加：フィルターモーダル用のデザイン
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)", // 背景を少し暗くする
    justifyContent: "flex-start",
    paddingTop: 100, // ヘッダーの少し下に出す
  },
  filterModalContent: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10, // チップ同士の隙間
  },

});
