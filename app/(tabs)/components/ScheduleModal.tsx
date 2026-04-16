import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

interface SubTask {
  id: number;
  title: string;
  date: Date;
  amount: number;
  isExpense: boolean;
  category?: string;
  isAllDay?: boolean;
  startTime?: Date;
  endTime?: Date;
}

interface ScheduleItem {
  id: string;
  title: string;
  tag?: string;
  tags?: string[];
  amount: number;
  isDone: boolean;
  color: string;
  isEvent: boolean;
  isTodo: boolean;
  isExpense: boolean;
  category?: string;
  recurringGroupId?: string;
  repeatType?: "daily" | "weekly" | "monthly";
  isAllDay?: boolean;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
  selectedItem: ScheduleItem | null;
  activeMode: string;
  scheduleData: any;
  setScheduleData: (data: any) => void;
  layerMaster?: { [key: string]: string };
  tagMaster?: { [key: string]: { layer: string; color: string } };
  setTagMaster: (data: any) => void;
  setHasUnsavedChanges: (val: boolean) => void;
}

const COLOR_PALETTE = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#5AC8FA", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#A2845E"];

const getNextDate = (dateStr: string, type: string, count: number) => {
  if (type === "none" || count === 0) return dateStr;
  const d = new Date(dateStr);
  if (type === "daily") d.setDate(d.getDate() + count);
  if (type === "weekly") d.setDate(d.getDate() + count * 7);
  if (type === "monthly") d.setMonth(d.getMonth() + count);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export default function ScheduleModal({
  visible,
  onClose,
  selectedDate,
  selectedItem,
  activeMode,
  scheduleData,
  setScheduleData,
  layerMaster = {},
  tagMaster = {},
  setTagMaster,
  setHasUnsavedChanges,
}: ScheduleModalProps) {
  // --- 状態管理 ---
  const [inputText, setInputText] = useState("");
  const [inputAmount, setInputAmount] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tagColor, setTagColor] = useState("#007AFF");
  const [selectedCategory, setSelectedCategory] = useState("食費");
  const [repeatType, setRepeatType] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [isAllDay, setIsAllDay] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [isEvent, setIsEvent] = useState(true);
  const [isTodo, setIsTodo] = useState(false);
  const [isExpense, setIsExpense] = useState(false);
  const [showSubTasks, setShowSubTasks] = useState(false);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [quickMainTags, setQuickMainTags] = useState<{[key: string]: string[]}>({
    ALL_LAYERS: ["食費", "交通", "日用品", "交際費", "趣味", "その他"],
  });
  const [editQuickTagModal, setEditQuickTagModal] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [tempQuickTagText, setTempQuickTagText] = useState("");
  const [readingMaster, setReadingMaster] = useState<{[title: string]: string}>({});

  const uiThemeColor = layerMaster[selectedLayer] || "#007AFF";

  // --- 初期化ロジック ---
  useEffect(() => {
    if (!visible) setIsReady(false);
  }, [visible]);

  useEffect(() => {
    const load = async () => {
      const [q, r] = await Promise.all([
        AsyncStorage.getItem("quickMainTagsData"),
        AsyncStorage.getItem("readingMasterData"),
      ]);
      if (q) setQuickMainTags(JSON.parse(q));
      if (r) setReadingMaster(JSON.parse(r));
    };
    if (visible) load();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      const layers = Object.keys(layerMaster);
      const def = layers.length > 0 ? layers[0] : "生活";
      if (selectedItem) {
        setInputText(selectedItem.title || "");
        setInputAmount(selectedItem.amount > 0 ? selectedItem.amount.toString() : "");
        setIsEvent(selectedItem.isEvent ?? true);
        setIsTodo(selectedItem.isTodo ?? false);
        setIsExpense(selectedItem.isExpense ?? false);
        setTagInput(selectedItem.tag || "");
        setTagColor(selectedItem.color || "#007AFF");
        setSelectedLayer(tagMaster?.[selectedItem.tag || ""]?.layer || def);
        setSelectedCategory(selectedItem.category || "食費");
        setIsAllDay(selectedItem.isAllDay ?? true);
        setStartDate(new Date(selectedItem.startDate || selectedDate));
        setEndDate(new Date(selectedItem.endDate || selectedDate));
        if (selectedItem.startTime) {
          const [h, m] = selectedItem.startTime.split(":").map(Number);
          const d = new Date(); d.setHours(h, m, 0, 0); setStartTime(d);
        }
        if (selectedItem.endTime) {
          const [h, m] = selectedItem.endTime.split(":").map(Number);
          const d = new Date(); d.setHours(h, m, 0, 0); setEndTime(d);
        }
      } else {
        setInputText(""); setTagInput(""); setTagColor(layerMaster[def] || "#007AFF");
        setInputAmount(""); setIsEvent(activeMode === "calendar"); setIsTodo(activeMode === "todo");
        setIsExpense(activeMode === "money"); setSelectedLayer(def); setSelectedCategory("食費");
        setIsAllDay(true); setStartDate(new Date(selectedDate)); setEndDate(new Date(selectedDate));
        const s = new Date(); s.setHours(10, 0, 0, 0); setStartTime(s);
        const e = new Date(); e.setHours(11, 0, 0, 0); setEndTime(e);
      }
      setRepeatType("none"); setSubTasks([]); setIsCreatingNewTag(false); setShowSubTasks(false);
    }
  }, [visible, selectedItem, activeMode, layerMaster]);

  // --- 計算ロジック (サジェスト) ---
  const toHiragana = (str: string) => str.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)).toLowerCase();

  const titleHistory = useMemo(() => {
    if (!visible) return [];
    const titles = new Set<string>();
    for (const d in scheduleData) {
      scheduleData[d].forEach((i: any) => i.title && titles.add(i.title));
    }
    return Array.from(titles);
  }, [scheduleData, visible]);

  const suggestions = useMemo(() => {
    const s = inputText.trim();
    if (!s) return [];
    const r = toHiragana(s);
    return titleHistory.filter(t => (readingMaster[t] || toHiragana(t)).startsWith(r) && t !== s).slice(0, 5);
  }, [inputText, titleHistory, readingMaster]);

  const currentQuickTags = useMemo(() => quickMainTags[selectedLayer] || quickMainTags["ALL_LAYERS"] || ["食費", "交通", "日用品", "交際費", "趣味", "その他"], [selectedLayer, quickMainTags]);

  // --- 実行ロジック ---
  const executeSave = async (updateFuture: boolean) => {
    if (!inputText) return Alert.alert("エラー", "タイトルを入力してください");
    const r = { ...readingMaster, [inputText.trim()]: toHiragana(inputText.trim()) };
    setReadingMaster(r);
    AsyncStorage.setItem("readingMasterData", JSON.stringify(r));

    const finalTag = tagInput.trim() || selectedLayer;
    const finalColor = tagInput.trim() ? tagColor : uiThemeColor;
    if (tagInput.trim()) {
      const m = { ...tagMaster, [tagInput.trim()]: { layer: selectedLayer, color: tagColor } };
      setTagMaster(m);
      AsyncStorage.setItem("tagMasterData", JSON.stringify(m));
    }

    const newData = { ...scheduleData };
    const sStr = startDate.toISOString().split("T")[0];
    const itemData = { title: inputText, tag: finalTag, tags: [finalTag], amount: parseInt(inputAmount) || 0, isEvent, isTodo, isExpense, color: finalColor, category: isExpense ? selectedCategory : undefined, repeatType: repeatType !== "none" ? repeatType : undefined, isAllDay, startDate: sStr, endDate: endDate.toISOString().split("T")[0], startTime: isAllDay ? undefined : formatTime(startTime), endTime: isAllDay ? undefined : formatTime(endTime) };

    if (selectedItem) {
      Object.keys(newData).forEach(d => { newData[d] = newData[d].filter((i: any) => i.id !== selectedItem.id); });
      const targetDate = sStr;
      if (!newData[targetDate]) newData[targetDate] = [];
      newData[targetDate].push({ ...selectedItem, ...itemData });
    } else {
      const baseId = Date.now().toString();
      if (!newData[sStr]) newData[sStr] = [];
      newData[sStr].push({ id: baseId, isDone: false, ...itemData });
    }

    onClose();
    setTimeout(() => { setScheduleData(newData); setHasUnsavedChanges(true); }, 300);
  };

  const executeDelete = () => {
    const newData = { ...scheduleData };
    Object.keys(newData).forEach(d => { newData[d] = newData[d].filter((i: any) => i.id !== selectedItem!.id); });
    onClose();
    setTimeout(() => { setScheduleData(newData); setHasUnsavedChanges(true); }, 300);
  };

  // --- メモ化された重いUIセクション ---
  const formContent = useMemo(() => {
    return (
      <View>
        <View style={styles.timeSection}>
          <View style={styles.timePreviewRow}>
            <Ionicons name="time" size={14} color={uiThemeColor} />
            <Text style={[styles.timePreviewText, { color: uiThemeColor }]}>
              {isAllDay ? "終日" : `${formatTime(startTime)} 〜 ${formatTime(endTime)}`}
            </Text>
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>終日</Text>
            <Switch value={isAllDay} onValueChange={setIsAllDay} trackColor={{ true: uiThemeColor }} />
          </View>
          <View style={styles.timePickerContainer}>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>開始</Text>
              <DateTimePicker value={startDate} mode="date" display="compact" onChange={(e, d) => d && setStartDate(d)} />
              {!isAllDay && <DateTimePicker value={startTime} mode="time" display="default" onChange={(e, d) => d && setStartTime(d)} />}
            </View>
            <View style={[styles.timeRow, { marginTop: 12 }]}>
              <Text style={styles.timeLabel}>終了</Text>
              <DateTimePicker value={endDate} mode="date" display="compact" onChange={(e, d) => d && setEndDate(d)} />
              {!isAllDay && <DateTimePicker value={endTime} mode="time" display="default" onChange={(e, d) => d && setEndTime(d)} />}
            </View>
          </View>
        </View>

        <Text style={styles.label}>カレンダーの種類</Text>
        <View style={styles.layerContainer}>
          {Object.keys(layerMaster).map(l => (
            <TouchableOpacity key={l} style={[styles.layerChip, selectedLayer === l && { backgroundColor: layerMaster[l] }]} onPress={() => setSelectedLayer(l)}>
              <Text style={[styles.layerChipText, selectedLayer === l && { color: "#fff" }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tagSection}>
          <Text style={styles.label}>属性（任意）</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity onPress={() => setIsCreatingNewTag(!isCreatingNewTag)} style={[styles.addTagCircle, isCreatingNewTag && { backgroundColor: uiThemeColor }]}>
              <Ionicons name={isCreatingNewTag ? "close" : "add"} size={22} color={isCreatingNewTag ? "#fff" : uiThemeColor} />
            </TouchableOpacity>
            {Object.keys(tagMaster).filter(t => tagMaster[t].layer === selectedLayer).map(t => (
              <TouchableOpacity key={t} onPress={() => setTagInput(t)} style={[styles.tagChip, tagInput === t && { backgroundColor: tagMaster[t].color }]}>
                <Text style={[styles.tagText, tagInput === t && { color: "#fff" }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.optionSection, { borderLeftColor: uiThemeColor }]}>
          <View style={styles.switchRow}><Text style={styles.switchLabel}>予定として表示</Text><Switch value={isEvent} onValueChange={setIsEvent} trackColor={{ true: uiThemeColor }} /></View>
          <View style={styles.switchRow}><Text style={styles.switchLabel}>ToDoリストに表示</Text><Switch value={isTodo} onValueChange={setIsTodo} trackColor={{ true: uiThemeColor }} /></View>
          <View style={styles.switchRow}><Text style={styles.switchLabel}>支出を記録</Text><Switch value={isExpense} onValueChange={setIsExpense} trackColor={{ true: uiThemeColor }} /></View>
          {isExpense && (
            <View>
              <TextInput style={styles.input} placeholder="金額 (¥)" keyboardType="numeric" value={inputAmount} onChangeText={setInputAmount} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {currentQuickTags.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.layerChip, selectedCategory === cat && { backgroundColor: uiThemeColor }]} onPress={() => setSelectedCategory(cat)}>
                    <Text style={[styles.layerChipText, selectedCategory === cat && { color: "#fff" }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

<TouchableOpacity style={[styles.subTaskToggleBtn, { borderColor: uiThemeColor }]} onPress={() => setShowSubTasks(!showSubTasks)}>
            <Ionicons name={showSubTasks ? "chevron-up" : "list-outline"} size={18} color={uiThemeColor} />
            <Text style={{ color: uiThemeColor, fontWeight: "bold", marginLeft: 8 }}>{showSubTasks ? "サブタスク入力を閉じる" : "サブタスクを追加..."}</Text>
          </TouchableOpacity>

          {showSubTasks && (
            <View style={styles.expandingInput}>
              {subTasks.map((task, idx) => (
                <View key={task.id} style={[styles.subTaskCard, { borderLeftColor: uiThemeColor }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <TextInput style={styles.subTaskInput} placeholder="やる事..." placeholderTextColor="#BBB" value={task.title} onChangeText={t => { const n = [...subTasks]; n[idx].title = t; setSubTasks(n); }} />
                    <TouchableOpacity onPress={() => setSubTasks(subTasks.filter(t => t.id !== task.id))}>
                      <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.subTaskControls}>
                    <View style={[styles.datePickerContainer, { backgroundColor: uiThemeColor + "1A" }]}>
                      <Ionicons name="calendar-outline" size={14} color={uiThemeColor} style={{ marginRight: 5 }} />
                      <DateTimePicker value={task.date} mode="date" display="compact" onChange={(e, d) => { if (d) { const n = [...subTasks]; n[idx].date = d; setSubTasks(n); } }} style={{ width: 100 }} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="logo-yen" size={14} color={task.isExpense ? uiThemeColor : "#BBB"} />
                      <Switch value={task.isExpense} onValueChange={v => { const n = [...subTasks]; n[idx].isExpense = v; setSubTasks(n); }} trackColor={{ true: uiThemeColor, false: "#a9a9a9" }} style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
                    </View>
                  </View>
                  
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="time-outline" size={14} color={task.isAllDay === false ? uiThemeColor : "#BBB"} />
                      <Switch value={task.isAllDay === false} onValueChange={v => { const n = [...subTasks]; n[idx].isAllDay = !v; setSubTasks(n); }} trackColor={{ true: uiThemeColor, false: "#a9a9a9" }} style={{ transform: [{ scaleX: 0.6 }, { scaleY: 0.6 }] }} />
                    </View>
                    {task.isAllDay === false && (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <DateTimePicker value={task.startTime!} mode="time" display="default" onChange={(e, d) => { if (d) { const n = [...subTasks]; n[idx].startTime = d; setSubTasks(n); } }} style={{ width: 75 }} />
                        <Text style={{ color: "#666" }}>-</Text>
                        <DateTimePicker value={task.endTime!} mode="time" display="default" onChange={(e, d) => { if (d) { const n = [...subTasks]; n[idx].endTime = d; setSubTasks(n); } }} style={{ width: 75 }} />
                      </View>
                    )}
                  </View>

                  {task.isExpense && (
                    <View style={styles.subTaskAmountContainer}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={[styles.yenSymbol, { color: uiThemeColor }]}>¥</Text>
                        <TextInput style={styles.subTaskAmountInput} placeholder="0" placeholderTextColor="#BBB" keyboardType="numeric" value={task.amount > 0 ? task.amount.toString() : ""} onChangeText={v => { const n = [...subTasks]; n[idx].amount = parseInt(v) || 0; setSubTasks(n); }} />
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        {currentQuickTags.map((cat, index) => (
                          <TouchableOpacity key={cat} style={[styles.microChip, task.category === cat && { backgroundColor: uiThemeColor }]} onPress={() => { const n = [...subTasks]; n[idx].category = cat; setSubTasks(n); }}>
                            <Text style={[styles.microChipText, task.category === cat && { color: "#fff" }]}>{cat}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addSubTaskBtn} onPress={() => {
                const s = new Date(); s.setHours(10, 0, 0, 0);
                const e = new Date(); e.setHours(11, 0, 0, 0);
                setSubTasks([...subTasks, { id: Date.now(), title: "", date: new Date(selectedDate), amount: 0, isExpense: false, category: selectedCategory, isAllDay: true, startTime: s, endTime: e }]);
              }}>
                <Ionicons name="add-circle" size={22} color={uiThemeColor} />
                <Text style={{ color: uiThemeColor, fontWeight: "bold", marginLeft: 8 }}>子タスクを追加</Text>
              </TouchableOpacity>
            </View>
          )}



        </View>
      </View>
    );
  }, [isAllDay, startDate, endDate, startTime, endTime, uiThemeColor, layerMaster, selectedLayer, tagMaster, tagInput, tagColor, isCreatingNewTag, selectedItem, repeatType, isEvent, isTodo, isExpense, inputAmount, selectedCategory, showSubTasks, subTasks, currentQuickTags, selectedDate]);

  // --- メイン描画 ---
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onShow={() => setIsReady(true)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss} style={[styles.modalContent, { borderTopWidth: 8, borderTopColor: uiThemeColor }]}>
          {!isReady ? (
            <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator size="large" color={uiThemeColor} /></View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.headerRow}>
                <Text style={[styles.modalTitle, { color: uiThemeColor }]}>{selectedItem ? "予定を編集" : "新規作成"}</Text>
                <Text style={styles.dateBadge}>{selectedDate}</Text>
              </View>
              <TextInput style={styles.mainInput} placeholder="予定のタイトル" value={inputText} onChangeText={setInputText} />
              
              {suggestions.length > 0 && (
                <View style={styles.suggestionWrapper}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {suggestions.map((s, i) => (
                      <TouchableOpacity key={i} style={styles.suggestionBadge} onPress={() => setInputText(s)}>
                        <Text style={styles.suggestionText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 🌟 メモ化された重いUIをここに配置 */}
              {formContent}

              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={onClose} style={styles.cancelBtn}><Text style={{ color: "#999" }}>キャンセル</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => executeSave(false)} style={[styles.saveBtn, { backgroundColor: uiThemeColor }]}><Text style={styles.saveBtnText}>保存して閉じる</Text></TouchableOpacity>
              </View>
              {selectedItem && (
                <TouchableOpacity onPress={executeDelete} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  <Text style={styles.deleteBtnText}>この予定を削除する</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "94%", backgroundColor: "#fff", padding: 22, borderRadius: 25, height: "75%" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  dateBadge: { backgroundColor: "#E5E5EA", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, fontSize: 12 },
  mainInput: { fontSize: 22, fontWeight: "bold", marginBottom: 10, color: "#1C1C1E" },
  timeSection: { backgroundColor: "#F8F8FA", padding: 12, borderRadius: 12, marginBottom: 15 },
  timePreviewRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10, gap: 5 },
  timePreviewText: { fontSize: 13, fontWeight: "bold" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  switchLabel: { fontSize: 14, color: "#3A3A3C" },
  timePickerContainer: { borderTopWidth: 1, borderTopColor: "#EEE", paddingTop: 10 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timeLabel: { fontSize: 12, color: "#666" },
  label: { fontSize: 11, fontWeight: "bold", color: "#666", marginBottom: 8, textTransform: "uppercase" },
  layerContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 15 },
  layerChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "#F2F2F7" },
  layerChipText: { fontSize: 12, color: "#666", fontWeight: "bold" },
  tagSection: { marginBottom: 15 },
  addTagCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F5", justifyContent: "center", alignItems: "center", marginRight: 8 },
  tagChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#EEE", marginRight: 8 },
  tagText: { fontSize: 12, fontWeight: "600" },
  optionSection: { backgroundColor: "#F8F8FA", padding: 12, borderRadius: 15, borderLeftWidth: 4, marginBottom: 15 },
  input: { backgroundColor: "#FFF", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#EEE", marginTop: 10 },
  actionButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 15 },
  cancelBtn: { padding: 10 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  saveBtnText: { color: "#fff", fontWeight: "bold" },
  deleteBtn: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#EEE", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  deleteBtnText: { color: "#FF3B30", fontSize: 13, fontWeight: "bold" },
  suggestionWrapper: { marginBottom: 10, height: 32 },
  suggestionBadge: { backgroundColor: "#F2F2F7", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: "#DDD" },
  suggestionText: { fontSize: 12, color: "#333" },
  subTaskToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    marginTop: 10,
  },
  expandingInput: { marginTop: 15 },
  subTaskCard: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
  },
  subTaskControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  addSubTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    marginTop: 5,
  },
  subTaskAmountContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F5",
  },
  yenSymbol: { fontSize: 14, fontWeight: "bold", marginRight: 5 },
  subTaskAmountInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    paddingVertical: 2,
  },
  subTaskInput: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    color: "#333",
    paddingVertical: 5,
  },
  microChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#F0F0F5",
    marginRight: 6,
  },
  microChipText: { fontSize: 10, color: "#666", fontWeight: "bold" },
});