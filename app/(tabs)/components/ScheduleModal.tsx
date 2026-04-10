import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";

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

interface SubTask {
    id: number;
    title: string;
    date: Date;
    amount: number;
    isExpense: boolean;
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
}

const COLOR_PALETTE = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#5AC8FA", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#A2845E"];

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
    setTagMaster
}: ScheduleModalProps) {

    const [inputText, setInputText] = useState("");
    const [inputAmount, setInputAmount] = useState("");
    const [selectedLayer, setSelectedLayer] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tagColor, setTagColor] = useState("#007AFF");

    const [isManageMode, setIsManageMode] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#007AFF");

    const [isEvent, setIsEvent] = useState(true);
    const [isTodo, setIsTodo] = useState(false);
    const [isExpense, setIsExpense] = useState(false);
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);

    const uiThemeColor = layerMaster[selectedLayer] || "#007AFF";

    useEffect(() => {
        if (visible) {
            const availableLayers = Object.keys(layerMaster);
            const defaultLayer = availableLayers.length > 0 ? availableLayers[0] : "生活";

            if (selectedItem) {
                setInputText(selectedItem.title);
                setInputAmount(selectedItem.amount > 0 ? selectedItem.amount.toString() : "");
                setIsEvent(selectedItem.isEvent);
                setIsTodo(selectedItem.isTodo);
                setIsExpense(selectedItem.isExpense);
                const itemTag = selectedItem.tag || "";
                setTagInput(itemTag);
                setTagColor(selectedItem.color);
                setSelectedLayer(tagMaster[itemTag]?.layer || defaultLayer);
            } else {
                setInputText("");
                setTagInput("");
                setTagColor(layerMaster[defaultLayer] || "#007AFF");
                setInputAmount("");
                setIsEvent(activeMode === "calendar");
                setIsTodo(activeMode === "todo");
                setIsExpense(activeMode === "money");
                setSelectedLayer(defaultLayer);
            }
            setSubTasks([]);
            setIsManageMode(false);
            setNewTagName("");
        }
    }, [visible, selectedItem, activeMode, layerMaster]);

    const updateTagMaster = async (newMaster: any) => {
        setTagMaster(newMaster);
        await AsyncStorage.setItem("tagMasterData", JSON.stringify(newMaster));
    };

    const handleSave = async () => {
        if (!inputText) return Alert.alert("エラー", "タイトルを入力してください");
        const finalTag = tagInput.trim() !== "" ? tagInput.trim() : selectedLayer;
        const finalColor = tagInput.trim() !== "" ? tagColor : uiThemeColor;

        if (!tagMaster[finalTag] || tagMaster[finalTag].color !== finalColor) {
            const newMaster = { ...tagMaster, [finalTag]: { layer: selectedLayer, color: finalColor } };
            updateTagMaster(newMaster);
        }

        const newData = { ...scheduleData };
        if (!newData[selectedDate]) newData[selectedDate] = [];
        const itemData = { title: inputText, tag: finalTag, amount: parseInt(inputAmount) || 0, isEvent, isTodo, isExpense, color: finalColor, isDone: selectedItem ? selectedItem.isDone : false };

        if (selectedItem) {
            newData[selectedDate] = newData[selectedDate].map((item: any) => item.id === selectedItem.id ? { ...item, ...itemData } : item);
        } else {
            const baseId = Date.now().toString();
            newData[selectedDate].push({ id: baseId, ...itemData });
            if (isTodo) {
                subTasks.filter(t => t.title.trim() !== "").forEach((task, index) => {
                    const d = task.date.toISOString().split("T")[0];
                    if (!newData[d]) newData[d] = [];
                    newData[d].push({ id: `${baseId}_${index}`, title: `${task.title} (${inputText})`, tag: finalTag, amount: task.isExpense ? task.amount : 0, isDone: false, isEvent: false, isTodo: true, isExpense: task.isExpense, color: finalColor });
                });
            }
        }
        setScheduleData(newData);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { borderTopWidth: 8, borderTopColor: uiThemeColor }]}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                            <View style={styles.headerRow}>
                                <Text style={[styles.modalTitle, { color: uiThemeColor }]}>
                                    {isManageMode ? `${selectedLayer} ` : (selectedItem ? "予定を編集" : "新規作成")}
                                </Text>
                                {/* 管理モードでない時は日付バッジを表示 */}
                                {!isManageMode && (
                                    <View style={[styles.dateBadge, { backgroundColor: uiThemeColor + "1A" }]}>
                                        <Text style={{ color: uiThemeColor, fontSize: 12, fontWeight: 'bold' }}>{selectedDate}</Text>
                                    </View>
                                )}
                            </View>

                            {!isManageMode ? (
                                <>
                                    <TextInput style={styles.mainInput} placeholder="予定のタイトル" placeholderTextColor="#999" value={inputText} onChangeText={setInputText} />

                                    <Text style={styles.label}>カテゴリー</Text>
                                    <View style={styles.layerContainer}>
                                        {Object.keys(layerMaster).map(layer => (
                                            <TouchableOpacity key={layer} style={[styles.layerChip, selectedLayer === layer && { backgroundColor: layerMaster[layer] }]} onPress={() => setSelectedLayer(layer)}>
                                                <Text style={[styles.layerChipText, selectedLayer === layer && { color: "#fff" }]}>{layer}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View style={styles.tagSection}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="pricetag-outline" size={16} color={uiThemeColor} style={{ marginRight: 8 }} />
                                            <TextInput
                                                style={[styles.subTagInput, { flex: 1, borderBottomColor: tagInput ? uiThemeColor : '#EEE' }]}
                                                placeholder="サブタグ名を入力"
                                                placeholderTextColor="#999"
                                                value={tagInput}
                                                onChangeText={setTagInput}
                                            />
                                        </View>

                                        {tagInput.length > 0 && (
                                            <TouchableOpacity
                                                style={[styles.tagColorSetter, { borderColor: uiThemeColor + "40" }]}
                                                onPress={() => { setNewTagName(tagInput); setIsManageMode(true); }}
                                            >
                                                <View style={[styles.colorIndicator, { backgroundColor: tagColor }]} />
                                                <Text style={[styles.tagColorSetterText, { color: uiThemeColor }]}>サブタグの色を設定</Text>
                                                <Ionicons name="chevron-forward" size={14} color={uiThemeColor} />
                                            </TouchableOpacity>
                                        )}

                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                                            {Object.keys(tagMaster).filter(t => tagMaster[t].layer === selectedLayer && t !== selectedLayer).map(tag => (
                                                <TouchableOpacity key={tag} style={styles.legendChip} onPress={() => { setTagInput(tag); setTagColor(tagMaster[tag].color); }}>
                                                    <View style={[styles.legendDot, { backgroundColor: tagMaster[tag].color }]} />
                                                    <Text style={styles.legendText}>{tag}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>

                                    <View style={[styles.optionSection, { borderLeftColor: uiThemeColor }]}>
                                        <View style={styles.switchRow}>
                                            <View style={styles.iconLabel}><Ionicons name="card-outline" size={20} color={isExpense ? uiThemeColor : "#666"} /><Text style={[styles.switchLabel, isExpense && { color: uiThemeColor }]}>支出を記録</Text></View>
                                            <Switch value={isExpense} onValueChange={setIsExpense} trackColor={{ true: uiThemeColor }} />
                                        </View>
                                        {isExpense && <TextInput style={styles.input} placeholder="金額を入力" keyboardType="numeric" value={inputAmount} onChangeText={setInputAmount} />}

                                        <View style={styles.switchRow}>
                                            <View style={styles.iconLabel}><Ionicons name="checkmark-done-circle-outline" size={20} color={isTodo ? uiThemeColor : "#666"} /><Text style={[styles.switchLabel, isTodo && { color: uiThemeColor }]}>ToDo設定</Text></View>
                                            <Switch value={isTodo} onValueChange={setIsTodo} trackColor={{ true: uiThemeColor }} />
                                        </View>

                                        {isTodo && (
                                            <View style={styles.expandingInput}>
                                                {subTasks.map((task, idx) => (
                                                    <View key={task.id} style={[styles.subTaskCard, { borderLeftColor: uiThemeColor }]}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                            <TextInput style={styles.subTaskInput} placeholder="やる事..." placeholderTextColor="#999" value={task.title} onChangeText={(t) => { const n = [...subTasks]; n[idx].title = t; setSubTasks(n); }} />
                                                            <TouchableOpacity onPress={() => setSubTasks(subTasks.filter(t => t.id !== task.id))}><Ionicons name="close-circle" size={20} color="#FF3B30" /></TouchableOpacity>
                                                        </View>
                                                        <View style={styles.subTaskControls}>
                                                            <View style={[styles.datePickerContainer, { backgroundColor: uiThemeColor + "10" }]}>
                                                                <Ionicons name="calendar-outline" size={14} color={uiThemeColor} style={{ marginRight: 5 }} />
                                                                <DateTimePicker value={task.date} mode="date" display="compact" onChange={(e, d) => { if (d) { const n = [...subTasks]; n[idx].date = d; setSubTasks(n); } }} style={{ width: 100 }} />
                                                            </View>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <Ionicons name="logo-yen" size={14} color={task.isExpense ? uiThemeColor : "#999"} />
                                                                <Switch value={task.isExpense} onValueChange={(v) => { const n = [...subTasks]; n[idx].isExpense = v; setSubTasks(n); }} trackColor={{ true: uiThemeColor }} style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))}
                                                <TouchableOpacity style={styles.addSubTaskBtn} onPress={() => setSubTasks([...subTasks, { id: Date.now(), title: "", date: new Date(selectedDate), amount: 0, isExpense: false }])}>
                                                    <Ionicons name="add-circle" size={24} color={uiThemeColor} /><Text style={{ color: uiThemeColor, fontWeight: 'bold', marginLeft: 8 }}>子タスクを追加</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </>
                            ) : (
                                <View style={styles.manageContainer}>
                                    {/* 🌟 1. 既存リストを上に（長期的な利便性） */}
                                    <Text style={styles.manageSubTitle}>{selectedLayer} の登録済みサブタグ</Text>
                                    {Object.keys(tagMaster).filter(t => tagMaster[t].layer === selectedLayer && t !== selectedLayer).map(tag => (
                                        <View key={tag} style={styles.manageRow}>
                                            <View style={styles.manageTagInfo}>
                                                <View style={[styles.colorIndicator, { backgroundColor: tagMaster[tag].color }]} />
                                                <Text style={{ fontWeight: 'bold', color: '#999' }}>：</Text>
                                                <Text style={styles.manageTagName}>{tag}</Text>
                                            </View>
                                            <View style={styles.manageActions}>
                                                <ScrollView horizontal style={{ maxWidth: 100 }} showsHorizontalScrollIndicator={false}>
                                                    {COLOR_PALETTE.map(c => (
                                                        <TouchableOpacity key={c} onPress={() => {
                                                            const newMaster = { ...tagMaster, [tag]: { ...tagMaster[tag], color: c } }; updateTagMaster(newMaster); setTagColor(c);
                                                        }} style={[styles.miniColorDot, { backgroundColor: c }, tagMaster[tag].color === c && { borderWidth: 2, borderColor: '#333' }]} />
                                                    ))}
                                                </ScrollView>
                                                <TouchableOpacity onPress={() => {
                                                    const newMaster = { ...tagMaster }; delete newMaster[tag]; updateTagMaster(newMaster);
                                                }} style={{ marginLeft: 10 }}><Ionicons name="trash-outline" size={18} color="#FF3B30" /></TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}

                                    {/* 🌟 2. 新規追加を下に */}
                                    <View style={[styles.addTagCard, { borderColor: uiThemeColor + "40", marginTop: 15 }]}>
                                        <Text style={styles.manageSubTitle}>新しいサブタグを登録</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                            <View style={[styles.colorIndicator, { backgroundColor: newTagColor, width: 20, height: 20 }]} />
                                            <TextInput style={[styles.subTagInput, { flex: 1, marginLeft: 10, borderBottomWidth: 0 }]} placeholder="名前を入力" value={newTagName} onChangeText={setNewTagName} />
                                        </View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                                            {COLOR_PALETTE.map(c => (
                                                <TouchableOpacity key={c} onPress={() => setNewTagColor(c)} style={[styles.miniColorDot, { backgroundColor: c }, newTagColor === c && { borderWidth: 2, borderColor: '#333' }]} />
                                            ))}
                                        </ScrollView>
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (!newTagName.trim()) return;
                                                const newMaster = { ...tagMaster, [newTagName]: { layer: selectedLayer, color: newTagColor } };
                                                updateTagMaster(newMaster);
                                                setTagInput(newTagName);
                                                setTagColor(newTagColor);
                                                setIsManageMode(false);
                                            }}
                                            style={[styles.saveBtn, { backgroundColor: uiThemeColor, width: '100%' }]}
                                        >
                                            <Text style={styles.saveBtnText}>登録して戻る</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            <View style={styles.actionButtons}>
                                <TouchableOpacity onPress={() => {
                                    if (isManageMode) setIsManageMode(false);
                                    else onClose();
                                }} style={styles.cancelBtn}>
                                    <Text style={{ color: '#999' }}>{isManageMode ? "戻る" : "閉じる"}</Text>
                                </TouchableOpacity>
                                {!isManageMode && (
                                    <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: uiThemeColor }]}>
                                        <Text style={styles.saveBtnText}>保存して閉じる</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {!isManageMode && selectedItem && (
                                <TouchableOpacity onPress={() => Alert.alert("削除", "消去しますか？", [{
                                    text: "消す", onPress: () => {
                                        const n = { ...scheduleData }; n[selectedDate] = n[selectedDate].filter((i: any) => i.id !== selectedItem.id);
                                        setScheduleData(n); onClose();
                                    }
                                }, { text: "やめる" }])} style={{ marginTop: 25, alignItems: 'center' }}>
                                    <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '600' }}>この予定を削除する</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
    modalContent: { width: "94%", backgroundColor: "#fff", padding: 22, borderRadius: 25, maxHeight: "90%" },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 18, fontWeight: "bold" },
    dateBadge: { backgroundColor: '#F0F0F5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, fontSize: 12, color: '#666' },
    mainInput: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, paddingVertical: 10, color: '#333' },
    label: { fontSize: 12, color: "#AAA", fontWeight: "bold", marginBottom: 8, marginTop: 10 },
    layerContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 15 },
    layerChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 15, backgroundColor: "#F5F5F7" },
    layerChipText: { fontSize: 13, color: "#666", fontWeight: "bold" },
    tagSection: { marginBottom: 20 },
    subTagInput: { fontSize: 16, borderBottomWidth: 1, paddingVertical: 8, color: '#333' },
    tagColorSetter: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: 15, borderWidth: 1, backgroundColor: '#FDFDFD' },
    tagColorSetterText: { flex: 1, fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
    legendChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginRight: 8 },
    legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    legendText: { fontSize: 12, color: '#444', fontWeight: '500' },
    optionSection: { backgroundColor: '#F8F8FA', borderRadius: 20, padding: 15, marginBottom: 20, borderLeftWidth: 5 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    switchLabel: { fontSize: 15, fontWeight: '500' },
    expandingInput: { marginTop: 10 },
    subTaskCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, borderLeftWidth: 5 },
    subTaskInput: { fontSize: 16, marginBottom: 12, color: '#333', fontWeight: '500', flex: 1 },
    subTaskControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    datePickerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, marginTop: 10 },
    cancelBtn: { padding: 12 },
    saveBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
    saveBtnText: { color: "#fff", fontWeight: "bold" },
    addSubTaskBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10 },
    input: { backgroundColor: "#FFF", padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#EEE', color: '#333' },
    manageContainer: { paddingVertical: 10 },
    manageSubTitle: { fontSize: 13, color: '#888', marginBottom: 12, fontWeight: 'bold' },
    manageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F8FA', padding: 12, borderRadius: 15, marginBottom: 10 },
    manageTagInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    colorIndicator: { width: 14, height: 14, borderRadius: 7 },
    manageTagName: { fontSize: 15, fontWeight: 'bold', color: '#333', marginLeft: 8, flex: 1 },
    manageActions: { flexDirection: 'row', alignItems: 'center' },
    miniColorDot: { width: 22, height: 22, borderRadius: 11, marginRight: 8 },
    addTagCard: { padding: 18, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', backgroundColor: '#FDFDFD' },
});