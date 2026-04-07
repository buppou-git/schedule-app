import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react"; // 状態を管理する機能を追加
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

//カレンダー部品の挿入
import { CalendarList } from "react-native-calendars";
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
  const [scheduleData, setScheduleData] = useState<{ [key: string]: ScheduleItem[] }>({});

  //ロードとセーブ機能を追加
  // 1. アプリ起動時にスマホの奥底からデータを「ロード（読み込み）」する
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('myScheduleData');
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
        await AsyncStorage.setItem('myScheduleData', JSON.stringify(scheduleData));
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
          {/* 魔法の部品を置くだけ！ */}
          <CalendarList
            markingType={"multi-dot"}
            //空白のマスを先月・来月の日付で埋める
            hideExtraDays={false}
            showDaysFromOtherMonths={true}
            //上部に表示する月にカスタマイズ(フォント＋数字のみが表示されるように変更)
            renderHeader={(date) => {
              const displayMonth = date.getMonth() + 1;

              return (
                <View style={styles.monthHeaderContainer}>
                  <Text style={styles.monthformat}>{displayMonth}</Text>
                </View>
              );
            }}
            horizontal={true} // 横スクロールにする
            pagingEnabled={true} // ピタッと1ヶ月ごとに止まるようにする
            // カレンダーの見た目を少し調整
            theme={{
              todayTextColor: "#ffffff", // 今日の日付を白くする
              todayBackgroundColor: "#ADE0EE",
              arrowColor: "#007AFF", // 月の切り替え矢印を青くする

              // @ts-ignore
              textDayOtherMonthColor: "#d3d3d3", //来月・先月の分の日付の表示(灰色で)
            }}
            //　ここでどのタグを用いるかの自動計算
            markedDates={getMarkedDates()} // ← ここで自動計算！
            // 日付をタップしたときの処理（今はとりあえずログを出すだけ）
            onDayPress={(day) => {
              console.log("選択された日付:", day.dateString);

              //選択した日付を const [selectedDate, setSelectedDate]　に格納
              setSelectedDate(day.dateString);
            }}
          />

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
});