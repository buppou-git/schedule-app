import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Keyboard,
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

// 型定義（Indexと同じものを念のため用意）
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

// 🌟 親（Index）から受け取る「プロップス（引数）」の定義
interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
  selectedItem: ScheduleItem | null;
  activeMode: string;
  scheduleData: any;
  setScheduleData: (data: any) => void;
}

export default function ScheduleModal({
  visible,
  onClose,
  selectedDate,
  selectedItem,
  activeMode,
  scheduleData,
  setScheduleData,
}: ScheduleModalProps) {
  // 🌟 ここから下はすべて「モーダル専用のState」
  const [inputText, setInputText] = useState("");
  const [inputAmount, setInputAmount] = useState("");
  const [selectedColor, setSelectedColor] = useState("#007AFF");
  const [isEvent, setIsEvent] = useState(true);
  const [isTodo, setIsTodo] = useState(false);
  const [isExpense, setIsExpense] = useState(false);
  const [subTasks, setSubTasks] = useState([
    { id: Date.now(), title: "", date: new Date(), amount: 0, showPicker: false },
  ]);

  const COLOR_PALETTE = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF3B30"];

  // 🌟 魔法の処理：モーダルが開いた瞬間（visibleがtrueになった時）に、中身を自動セットする！
  useEffect(() => {
    if (visible) {
      if (selectedItem) {
        // 編集モード：選んだアイテムの情報をセット
        setInputText(selectedItem.title);
        setInputAmount(selectedItem.amount > 0 ? selectedItem.amount.toString() : "");
        setSelectedColor(selectedItem.color);
        setIsEvent(selectedItem.isEvent);
        setIsTodo(selectedItem.isTodo);
        setIsExpense(selectedItem.isExpense);
      } else {
        // 新規追加モード：今のタブに合わせて初期状態をセット
        setInputText("");
        setInputAmount("");
        setSelectedColor(activeMode === "money" ? "#FF9500" : "#007AFF");
        setIsEvent(activeMode === "calendar");
        setIsTodo(activeMode === "todo");
        setIsExpense(activeMode === "money");
      }
      // リストは常に1つにリセットしておく
      setSubTasks([{ id: Date.now(), title: "", date: new Date(), amount: 0, showPicker: false }]);
    }
  }, [visible, selectedItem, activeMode]);

  const removeSubTaskField = (id: any) => {
    setSubTasks(subTasks.filter((task) => task.id !== id));
  };

  const addSubTaskField = () => {
    setSubTasks([...subTasks, { id: Date.now(), title: "", date: new Date(), amount: 0, showPicker: false }]);
  };

  // 🌟 保存処理（今までIndexにあったものをそのままお引越し！）
  const handleSave = () => {
    if (!inputText) return Alert.alert("エラー", "タイトルを入力してください");
    if (!isEvent && !isTodo && !isExpense) return Alert.alert("エラー", "登録先を最低1つ設定してください");

    const newData = { ...scheduleData };
    if (!newData[selectedDate]) newData[selectedDate] = [];

    if (selectedItem) {
      newData[selectedDate] = newData[selectedDate].map((item: any) =>
        item.id === selectedItem.id
          ? { ...item, title: inputText, amount: parseInt(inputAmount) || 0, isEvent, isTodo, isExpense, color: selectedColor }
          : item
      );
    } else {
      const baseId = Date.now().toString();
      const validSubTasks = subTasks.filter((task) => task.title.trim() !== "");
      const shouldSaveMain = isEvent || isExpense || (isTodo && validSubTasks.length === 0);

      if (shouldSaveMain) {
        const mainItem = {
          id: baseId,
          title: inputText,
          tag: activeMode === "money" ? "出費" : "予定",
          amount: parseInt(inputAmount) || 0,
          isDone: false,
          isEvent: isEvent,
          isTodo: isTodo && validSubTasks.length === 0,
          isExpense: isExpense,
          color: selectedColor,
        };
        newData[selectedDate] = [...(newData[selectedDate] || []), mainItem];
      }

      if (isTodo && validSubTasks.length > 0) {
        validSubTasks.forEach((task, index) => {
          const subDateStr = task.date.toISOString().split("T")[0];
          const subItem = {
            id: `${baseId}_sub_${index}`,
            title: `${task.title} (${inputText})`,
            tag: task.amount > 0 ? "出費" : "予定",
            amount: task.amount,
            isDone: false,
            isEvent: false,
            isTodo: true,
            isExpense: task.amount > 0,
            color: selectedColor,
          };
          newData[subDateStr] = [...(newData[subDateStr] || []), subItem];
        });
      }
    }

    setScheduleData(newData); // 親のデータを更新！
    onClose(); // 親に「閉じていいよ」と伝える！
  };

  const handleDelete = () => {
    if (!selectedItem) return;
    const newData = { ...scheduleData };
    newData[selectedDate] = newData[selectedDate].filter((item: any) => item.id !== selectedItem.id);
    setScheduleData(newData);
    onClose();
  };

  const checkDelete = () => {
    Alert.alert("本当に削除しますか？", "この予定を削除してもよろしいですか？", [
      { text: "はい", onPress: handleDelete, style: "destructive" },
      { text: "いいえ", style: "cancel" },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { maxHeight: "80%" }]}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                
                <Text style={styles.modalTitle}>{selectedItem ? "予定を編集" : `${selectedDate} に追加`}</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="タイトル（例：情報工学 課題）"
                  value={inputText}
                  onChangeText={setInputText}
                />
                
                <Text style={styles.label}>ラベルの色</Text>
                <View style={styles.colorContainer}>
                  {COLOR_PALETTE.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.colorCircle, { backgroundColor: color }, selectedColor === color && styles.selectedCircle]}
                      onPress={() => setSelectedColor(color)}
                    />
                  ))}
                </View>

                {/* スイッチ類 */}
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>📅 カレンダーに表示</Text>
                  <Switch value={isEvent} onValueChange={setIsEvent} />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>💰 支出も記録する</Text>
                  <Switch value={isExpense} onValueChange={setIsExpense} />
                </View>
                {isExpense && (
                  <TextInput
                    style={styles.input}
                    placeholder="金額（例：8000）"
                    keyboardType="numeric"
                    value={inputAmount}
                    onChangeText={setInputAmount}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    onBlur={Keyboard.dismiss}
                  />
                )}

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>✅ ToDo（やること）に追加</Text>
                  <Switch value={isTodo} onValueChange={setIsTodo} />
                </View>

                {/* ToDoリスト */}
                {isTodo && (
                  <View style={{ backgroundColor: "#F0F8F5", padding: 15, borderRadius: 10, marginBottom: 15 }}>
                    {subTasks.map((task, index) => (
                      <View key={task.id} style={styles.taskCard}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <Text style={{ fontWeight: "bold", color: "#555", fontSize: 14 }}>📝 やる事 {index + 1}</Text>
                          <TouchableOpacity onPress={() => removeSubTaskField(task.id)} style={{ padding: 4 }}>
                            <Text style={{ color: "#FF3B30", fontWeight: "bold", fontSize: 12 }}>✕ 削除</Text>
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={styles.input}
                          placeholder="タスク名 (例: グッズ代支払い)"
                          value={task.title}
                          onChangeText={(text) => {
                            const newTasks = [...subTasks];
                            newTasks[index].title = text;
                            setSubTasks(newTasks);
                          }}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                          onBlur={Keyboard.dismiss}
                        />

                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <TextInput
                            style={[styles.input, { flex: 1, marginRight: 10, marginBottom: 0 }]}
                            placeholder="金額 (任意)"
                            keyboardType="numeric"
                            value={task.amount > 0 ? task.amount.toString() : ""}
                            onChangeText={(val) => {
                              const newTasks = [...subTasks];
                              newTasks[index].amount = parseInt(val) || 0;
                              setSubTasks(newTasks);
                            }}
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            onBlur={Keyboard.dismiss}
                          />
                          <View style={{ flex: 1 }}>
                            {Platform.OS === "ios" ? (
                              <View style={{ height: 40, justifyContent: "center", alignItems: "flex-end" }}>
                                <DateTimePicker
                                  value={task.date}
                                  mode="date"
                                  display="compact"
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
                                  style={[styles.input, { justifyContent: "center", backgroundColor: "#F8F9FA", marginBottom: 0, alignItems: "center" }]}
                                  onPress={() => {
                                    const newTasks = [...subTasks];
                                    newTasks[index].showPicker = true;
                                    setSubTasks(newTasks);
                                  }}
                                >
                                  <Text style={{ color: "#333", fontSize: 13, fontWeight: "bold" }}>📅 {task.date.toISOString().split("T")[0].slice(5)}</Text>
                                </TouchableOpacity>
                                {task.showPicker && (
                                  <DateTimePicker
                                    value={task.date}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                      const newTasks = [...subTasks];
                                      newTasks[index].showPicker = false;
                                      if (selectedDate) newTasks[index].date = selectedDate;
                                      setSubTasks(newTasks);
                                    }}
                                  />
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity onPress={addSubTaskField} style={styles.addBtn}>
                      <Text style={{ color: "#2E7D32", fontWeight: "bold", fontSize: 15 }}>＋ やる事をさらに追加</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.modalButtons}>
                  {selectedItem && (
                    <TouchableOpacity onPress={checkDelete} style={styles.deleteBtn}>
                      <Text style={{ color: "#FF3B30", fontWeight: "bold" }}>削除</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                    <Text>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>{selectedItem ? "更新" : "保存"}</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// デザインのお引越し
const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "85%", backgroundColor: "#fff", padding: 20, borderRadius: 15 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  input: { borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 8, marginBottom: 10 },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end" },
  cancelBtn: { padding: 10, marginRight: 10 },
  saveBtn: { padding: 10, backgroundColor: "#007AFF", borderRadius: 8 },
  deleteBtn: { padding: 10, marginRight: "auto" },
  label: { fontSize: 14, color: "#666", marginBottom: 5, marginTop: 10 },
  colorContainer: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  colorCircle: { width: 30, height: 30, borderRadius: 15 },
  selectedCircle: { borderWidth: 3, borderColor: "#333" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15, paddingHorizontal: 5 },
  switchLabel: { fontSize: 16, color: "#333" },
  taskCard: { backgroundColor: "#fff", padding: 12, borderRadius: 8, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  addBtn: { padding: 12, alignItems: "center", backgroundColor: "#E8F5E9", borderRadius: 8, borderWidth: 1, borderColor: "#A5D6A7", borderStyle: "dashed" },
});