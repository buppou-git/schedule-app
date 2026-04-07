import { StatusBar } from "expo-status-bar";
import React, { useState } from "react"; // 状態を管理する機能を追加
import {
  Alert,
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

//カレンダー部品の挿入
import { CalendarList } from "react-native-calendars";
//todo用の追加機能を実装するためのパーツ
import DateTimePicker from '@react-native-community/datetimepicker';
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

  //スイッチ用のStateを宣言
  const [isEvent, setIsEvent] = useState(true);
  const [isTodo, setIsTodo] = useState(false);
  const [isExpense, setIsExpense] = useState(false);

  //状況に応じて初期状態を変更するシステムの構築(スイッチ)
  const handleOpenNewModal = () => {
    closeModal(); // 一旦お掃除
    // 今いるタブ（activeMode）に合わせて初期値をセット！
    setIsEvent(activeMode === "calendar");
    setIsTodo(activeMode === "todo");
    setIsExpense(activeMode === "money");
    setModalVisible(true);
  };

  // 実際の予定の管理 (scheduleDataをuseStateに変更)
  const [scheduleData, setScheduleData] = useState<{
    [key: string]: ScheduleItem[];
  }>({
    "2026-03-12": [
      {
        id: "1",
        title: "お台場デート",
        tag: "遊び", // 用途別のタグ
        amount: 10000, // 支出（なければ 0 や null）
        isDone: false, // 完了したか
        color: "#FF3B30", // タグの色（遊び＝赤、学校＝青など）
        isEvent: true, // カレンダーに表示
        isTodo: false, // ToDoではない
        isExpense: true, // 支出あり
      },
    ],

    "2026-03-15": [
      {
        id: "2",
        title: "会費徴収",
        tag: "学校", // 用途別のタグ
        amount: 8000, // 支出（なければ 0 や null）
        isDone: false, // 完了したか
        color: "#007AFF", // タグの色（遊び＝赤、学校＝青など）
        isEvent: true,
        isTodo: true, // ToDoとして管理
        isExpense: true, // 支出あり
      },
    ],

    "2026-03-25": [
      {
        id: "3",
        title: "ずっと真夜中でいいのに。ライブ",
        tag: "遊び", // 用途別のタグ
        amount: 8000, // 支出（なければ 0 や null）
        isDone: false, // 完了したか
        color: "#FF3B30", // タグの色（遊び＝赤、学校＝青など）
        isEvent: true,
        isTodo: true,
        isExpense: true,
      },
      {
        id: "4",
        title: "情報工学 課題提出",
        tag: "学校",
        amount: 0,
        isDone: true,
        color: "#007AFF",
        isEvent: true,
        isTodo: true,
        isExpense: false, // 支出なし
      },
    ],
  });

  //モーダルと入力用のstate
  const [modalVisible, setModalVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [inputAmount, setInputAmount] = useState("");

  //カラーパレットの設定
  const [selectedColor, setSelectedColor] = useState("#007AFF");
  const COLOR_PALETTE = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF3B30"];

  //todo関連のstate
  const [subTasks, setSubTasks] = useState([
    { id: Date.now(), title: "", date: new Date(), amount: 0, showPicker: false }
  ]);

  //特定のtodoを削除するための関数
  const removeSubTaskField = (id: any) => {
    // 指定されたID以外のアイテムだけを残す
    setSubTasks(subTasks.filter(task => task.id !== id));
  };

  // ToDo入力欄を増やす関数
  const addSubTaskField = () => {
    setSubTasks([
      ...subTasks,
      { id: Date.now(), title: "", date: new Date(), amount: 0, showPicker: false }
    ]);
  };

  // データを保存する関数
  // データを保存する関数
  const handleSave = () => {
    if (!inputText) return Alert.alert("エラー", "タイトルを入力してください");

    // 何も入力しないまま保存することを防ぐ
    if (!isEvent && !isTodo && !isExpense)
      return Alert.alert("エラー", "登録先を最低1つ設定してください");

    const newData = { ...scheduleData };
    if (!newData[selectedDate]) newData[selectedDate] = [];

    if (selectedItem) {
      // 【更新モード】
      newData[selectedDate] = newData[selectedDate].map((item) =>
        item.id === selectedItem.id
          ? {
            ...item,
            title: inputText,
            amount: parseInt(inputAmount) || 0,
            isEvent,
            isTodo,
            isExpense,
            color: selectedColor,
          }
          : item,
      );
    } else {
      // 【新規追加モード】
      const baseId = Date.now().toString();

      // 空欄のタスクを無視して、ちゃんと入力されたタスクだけを抽出する
      const validSubTasks = subTasks.filter(task => task.title.trim() !== "");

      // メイン予定を保存するかの判定
      // カレンダーか支出がON、または「ToDoはONだけどリストが1個も書かれていない」場合はメインを作る
      const shouldSaveMain = isEvent || isExpense || (isTodo && validSubTasks.length === 0);

      if (shouldSaveMain) {
        const mainItem: ScheduleItem = {
          id: baseId,
          title: inputText,
          tag: activeMode === "money" ? "出費" : "予定",
          amount: parseInt(inputAmount) || 0,
          isDone: false,
          isEvent: isEvent,
          isTodo: (isTodo && validSubTasks.length === 0), // リストがない時だけメインをToDo扱いにする
          isExpense: isExpense,
          color: selectedColor,
        };
        newData[selectedDate] = [...(newData[selectedDate] || []), mainItem];
      }

      // 🌟 複数ToDoリストの保存（リストが1個以上ある場合）
      if (isTodo && validSubTasks.length > 0) {
        validSubTasks.forEach((task, index) => {
          const subDateStr = task.date.toISOString().split('T')[0];

          const subItem: ScheduleItem = {
            id: `${baseId}_sub_${index}`,
            title: `${task.title} (${inputText})`, // 例: グッズ代 (ずっと真夜中でいいのに。ライブ)
            tag: task.amount > 0 ? "出費" : "予定",
            amount: task.amount, // 各タスクの金額を保存！
            isDone: false,
            isEvent: false, // 関連ToDoはカレンダーには出さない
            isTodo: true,
            isExpense: task.amount > 0, // 金額が1円以上なら、自動的に家計簿にも出す！
            color: selectedColor,
          };

          newData[subDateStr] = [...(newData[subDateStr] || []), subItem];
        });
      }
    }

    setScheduleData(newData); // 状態を更新
    closeModal(); // お掃除して閉じる
  };

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

  // 2. 既存の予定をタップした時に、その情報をモーダルにセットして開く関数
  const openEditModal = (item: ScheduleItem) => {
    setSelectedItem(item);
    setInputText(item.title);
    setInputAmount(item.amount.toString());
    setIsEvent(item.isEvent);
    setIsTodo(item.isTodo);
    setIsExpense(item.isExpense);
    setSelectedColor(item.color);
    setModalVisible(true);
  };
  // 3. 削除ボタンが押された時の処理
  const handleDelete = () => {
    if (!selectedItem) return;

    // A. 今のデータをコピー
    const newData = { ...scheduleData };

    // B. filterを使って、選択中のID「以外」のリストを作り直す
    newData[selectedDate] = newData[selectedDate].filter(
      (item) => item.id !== selectedItem.id,
    );

    // C. データを更新して、お片付け
    setScheduleData(newData);
    closeModal();
  };

  // モーダルを閉じる時のお掃除関数（新規追加時と共通で使うと便利）
  const closeModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
    setInputText("");
    setInputAmount("");
    setSelectedColor("#007AFF"); //色を青色にリセット
    setSubTasks([{ id: Date.now(), title: "", date: new Date(), amount: 0, showPicker: false }]);
  };

  //本当に削除するのかの確認を行うための処理
  const checkDelete = () => {
    Alert.alert(
      "本当に削除しますか？", // 1. タイトル 🏷️
      "この予定を削除してもよろしいですか？", // 2. メッセージ 💬（空でもOK）
      [
        // 3. ボタンの配列 🔘
        { text: "はい", onPress: handleDelete, style: "destructive" },
        {
          text: "いいえ",
          onPress: () => console.log("キャンセルされました"),
          style: "cancel",
        },
      ],
    );
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

      {/* 追加！：モード切り替えタブ領域 */}
      <View style={styles.tabContainer}>
        {/* カレンダータブ */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeMode === "calendar" && styles.activeTab,
          ]}
          onPress={() => setActiveMode("calendar")}
        >
          <Text
            style={[
              styles.tabText,
              activeMode === "calendar" && styles.activeTabText,
            ]}
          >
            📅 カレンダー
          </Text>
        </TouchableOpacity>

        {/* ToDoタブ */}
        <TouchableOpacity
          style={[styles.tabButton, activeMode === "todo" && styles.activeTab]}
          onPress={() => setActiveMode("todo")}
        >
          <Text
            style={[
              styles.tabText,
              activeMode === "todo" && styles.activeTabText,
            ]}
          >
            ✅ ToDo
          </Text>
        </TouchableOpacity>

        {/* 家計簿タブ */}
        <TouchableOpacity
          style={[styles.tabButton, activeMode === "money" && styles.activeTab]}
          onPress={() => setActiveMode("money")}
        >
          <Text
            style={[
              styles.tabText,
              activeMode === "money" && styles.activeTabText,
            ]}
          >
            💰 家計簿
          </Text>
        </TouchableOpacity>
      </View>

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
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>

            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <ScrollView showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  <Text style={styles.modalTitle}>
                    {selectedItem ? "予定を編集" : `${selectedDate} に追加`}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="タイトル（例：情報工学 課題）"
                    value={inputText}
                    onChangeText={setInputText}
                  />
                  {/* ② 追加：カラーパレット */}
                  <Text style={styles.label}>ラベルの色</Text>
                  <View style={styles.colorContainer}>
                    {COLOR_PALETTE.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: color },
                          selectedColor === color && styles.selectedCircle, // 選ばれている色に枠線をつける
                        ]}
                        onPress={() => setSelectedColor(color)}
                      />
                    ))}
                  </View>

                  {/* 1. カレンダー表示スイッチ */}
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>📅 カレンダーに表示</Text>
                    <Switch value={isEvent} onValueChange={setIsEvent} />
                  </View>

                  {/* 2. 支出スイッチ */}
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>💰 支出も記録する</Text>
                    <Switch value={isExpense} onValueChange={setIsExpense} />
                  </View>

                  {/* 支出がONの時だけ現れる入力エリア */}
                  {isExpense && (
                    <TextInput
                      style={styles.input}
                      placeholder="金額（例：8000）"
                      keyboardType="numeric"
                      value={inputAmount}
                      onChangeText={setInputAmount}
                    />
                  )}

                  {/* 3. ToDoスイッチ */}
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>✅ ToDo（やること）に追加</Text>
                    <Switch value={isTodo} onValueChange={setIsTodo} />
                  </View>

                  {/* ToDoがONの時だけ現れる入力エリア */}
                  {isTodo && (
                    <View style={{ backgroundColor: '#F8FFF9', padding: 10, borderRadius: 8, marginBottom: 15 }}>

                      {/* 追加されたタスクの数だけループして表示 */}
                      {subTasks.map((task, index) => (
                        <View key={task.id} style={{ marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#D1E8D5' }}>


                          {/*削除するためのボタン*/}
                          <TouchableOpacity
                            onPress={() => removeSubTaskField(task.id)}
                            style={{ alignSelf: 'flex-end', padding: 5 }}
                          >
                            <Text style={{ color: '#FF3B30', fontWeight: 'bold' }}>✕ 削除</Text>
                          </TouchableOpacity>



                          <TextInput
                            style={styles.input}
                            placeholder={`やる事 ${index + 1} (例: グッズ代支払い)`}
                            value={task.title}
                            onChangeText={(text) => {
                              const newTasks = [...subTasks];
                              newTasks[index].title = text;
                              setSubTasks(newTasks); // 自分の行のタイトルだけ更新
                            }}

                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            onBlur={Keyboard.dismiss}
                          />

                          <TextInput
                            style={styles.input}
                            placeholder="このタスクの金額 (なければ空欄)"
                            keyboardType="numeric"
                            value={task.amount > 0 ? task.amount.toString() : ""}
                            onChangeText={(val) => {
                              const newTasks = [...subTasks];
                              newTasks[index].amount = parseInt(val) || 0;
                              setSubTasks(newTasks); // 自分の行の金額だけ更新
                            }}
                          />

                          {/* iOS/Androidの1タップ分岐（リスト対応） */}
                          {Platform.OS === 'ios' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 5 }}>
                              <Text style={{ fontSize: 16, color: '#333' }}>📅 期限を選択</Text>
                              <DateTimePicker
                                value={task.date}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                  if (selectedDate) {
                                    const newTasks = [...subTasks];
                                    newTasks[index].date = selectedDate;
                                    setSubTasks(newTasks);
                                  }
                                }}
                              />
                            </View>
                          ) : (
                            <View>
                              <TouchableOpacity
                                style={[styles.input, { justifyContent: 'center', backgroundColor: '#fff', marginBottom: 0 }]}
                                onPress={() => {
                                  const newTasks = [...subTasks];
                                  newTasks[index].showPicker = true; // 自分の行のカレンダーだけ開く！
                                  setSubTasks(newTasks);
                                }}
                              >
                                <Text style={{ color: '#333' }}>
                                  📅 期限: {task.date.toISOString().split('T')[0]}
                                </Text>
                              </TouchableOpacity>

                              {task.showPicker && (
                                <DateTimePicker
                                  value={task.date}
                                  mode="date"
                                  display="default"
                                  onChange={(event, selectedDate) => {
                                    const newTasks = [...subTasks];
                                    newTasks[index].showPicker = false; // 閉じる
                                    if (selectedDate) newTasks[index].date = selectedDate;
                                    setSubTasks(newTasks);
                                  }}
                                />
                              )}
                            </View>
                          )}
                        </View>
                      ))}

                      {/* 🌟 リストを追加するボタン */}
                      <TouchableOpacity onPress={addSubTaskField} style={{ padding: 10, alignItems: 'center' }}>
                        <Text style={{ color: '#007AFF', fontWeight: 'bold', fontSize: 16 }}>＋ やる事をさらに追加</Text>
                      </TouchableOpacity>

                    </View>
                  )}





                  <View style={styles.modalButtons}>
                    {/* 追加：編集モードの時だけ削除ボタンを表示 */}
                    {selectedItem && (
                      <TouchableOpacity
                        onPress={checkDelete}
                        style={styles.deleteBtn}
                      >
                        <Text style={{ color: "#FF3B30", fontWeight: "bold" }}>
                          削除
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={closeModal} style={styles.cancelBtn}>
                      <Text>キャンセル</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                      <Text style={{ color: "#fff", fontWeight: "bold" }}>
                        {selectedItem ? "更新" : "保存"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>

          </View>
        </TouchableWithoutFeedback>
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
  /* タブ全体を横並びにする設定 */
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  /* タブボタン1つ1つの設定 */
  tabButton: {
    flex: 1, // 3つのボタンを均等な幅にする
    paddingVertical: 15,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent", // 普段は透明な線
  },
  /* 選ばれているタブの設定 */
  activeTab: {
    borderBottomColor: "#007AFF", // 青い線を表示
  },
  tabText: {
    fontSize: 14,
    color: "#666666",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#007AFF", // 文字も青くする
    fontWeight: "bold",
  },
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarContainer: {
    flex: 1,
    width: "100%", // 横幅を画面いっぱいに広げる
    backgroundColor: "#FFFFFF",
  },
  monthHeaderContainer: {
    width: "100%",
    alignItems: "flex-start", // 左寄せにする！
  },
  monthformat: {
    fontSize: 28,
    paddingLeft: 10,
    paddingBottom: 5,
    fontWeight: "bold",
    color: "#333333",
  },
  mainText: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
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
  typeBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
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

  //モーダル関係のスタイル
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  cancelBtn: {
    padding: 10,
    marginRight: 10,
  },

  saveBtn: {
    padding: 10,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },

  deleteBtn: {
    padding: 10,
    marginRight: "auto",
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

  //カラーパレット、スイッチ関係の装飾
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
    marginTop: 10,
  },
  colorContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15, // 丸くする
  },
  selectedCircle: {
    borderWidth: 3,
    borderColor: "#333", // 選ばれている色は黒い枠線をつける
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  switchLabel: {
    fontSize: 16,
    color: "#333",
  },
});
