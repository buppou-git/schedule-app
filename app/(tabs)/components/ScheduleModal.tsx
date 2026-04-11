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

// --- 型定義 ---
interface SubTask {
    id: number;
    title: string;
    date: Date;
    amount: number;
    isExpense: boolean;
}

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
    
    // UI制御用
    const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
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
                setTagInput(selectedItem.tag || "");
                setTagColor(selectedItem.color);
                setSelectedLayer(tagMaster?.[selectedItem.tag]?.layer || defaultLayer);
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
            setIsCreatingNewTag(false);
        }
    }, [visible, selectedItem, activeMode, layerMaster]);

    // 🌟 予定削除
    const handleDelete = () => {
        if (!selectedItem) return;
        Alert.alert("予定の削除", "この予定を消去してもよろしいですか？", [
            { text: "キャンセル", style: "cancel" },
            { text: "削除", style: "destructive", onPress: () => {
                const newData = { ...scheduleData };
                newData[selectedDate] = newData[selectedDate].filter((item: any) => item.id !== selectedItem.id);
                setScheduleData(newData);
                onClose();
            }}
        ]);
    };

    // 🌟 サブタグの長押し編集
    const handleLongPressTag = (tag: string) => {
        setTagInput(tag);
        setTagColor(tagMaster?.[tag]?.color || "#007AFF");
        setIsCreatingNewTag(true); // 編集エリアをオープン
    };

    const handleSave = async () => {
        if (!inputText) return Alert.alert("エラー", "タイトルを入力してください");
        const finalTag = tagInput.trim() !== "" ? tagInput.trim() : selectedLayer;
        const finalColor = tagInput.trim() !== "" ? tagColor : uiThemeColor;

        // 辞書更新（インライン辞書機能）
        const newMaster = { ...tagMaster, [finalTag]: { layer: selectedLayer, color: finalColor } };
        setTagMaster(newMaster);
        await AsyncStorage.setItem("tagMasterData", JSON.stringify(newMaster));

        const newData = { ...scheduleData };
        if (!newData[selectedDate]) newData[selectedDate] = [];
        const itemData = { 
            title: inputText, tag: finalTag, amount: parseInt(inputAmount) || 0, 
            isEvent, isTodo, isExpense, color: finalColor, 
            isDone: selectedItem ? selectedItem.isDone : false 
        };

        if (selectedItem) {
            newData[selectedDate] = newData[selectedDate].map((item: any) => 
                item.id === selectedItem.id ? { ...item, ...itemData } : item
            );
        } else {
            const baseId = Date.now().toString();
            newData[selectedDate].push({ id: baseId, ...itemData });
            if (isTodo) {
                subTasks.filter(t => t.title.trim() !== "").forEach((task, index) => {
                    const d = task.date.toISOString().split("T")[0];
                    if (!newData[d]) newData[d] = [];
                    newData[d].push({ 
                        id: `${baseId}_${index}`, title: `${task.title} (${inputText})`, 
                        tag: finalTag, amount: task.isExpense ? task.amount : 0, 
                        isDone: false, isEvent: false, isTodo: true, isExpense: task.isExpense, color: finalColor 
                    });
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
                                    {selectedItem ? "予定を編集" : "新規作成"}
                                </Text>
                                <Text style={styles.dateBadge}>{selectedDate}</Text>
                            </View>

                            <TextInput 
                                style={styles.mainInput} 
                                placeholder="予定のタイトル" 
                                placeholderTextColor="#BBB" 
                                value={inputText} 
                                onChangeText={setInputText} 
                            />
                            
                            <Text style={styles.label}>カテゴリー</Text>
                            <View style={styles.layerContainer}>
                                {Object.keys(layerMaster).map(layer => (
                                    <TouchableOpacity 
                                        key={layer} 
                                        style={[styles.layerChip, selectedLayer === layer && { backgroundColor: layerMaster[layer] }]} 
                                        onPress={() => setSelectedLayer(layer)}
                                    >
                                        <Text style={[styles.layerChipText, selectedLayer === layer && { color: "#fff" }]}>{layer}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* 🌟 ハイブリッド・タグセクション */}
                            <View style={styles.tagSection}>
                                <Text style={styles.label}>サブタグ（長押しで編集）</Text>
                                <View style={styles.tagListContainer}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <TouchableOpacity 
                                            onPress={() => { setIsCreatingNewTag(!isCreatingNewTag); setTagInput(""); }} 
                                            style={[styles.addTagCircle, isCreatingNewTag && { backgroundColor: uiThemeColor }]}
                                        >
                                            <Ionicons name={isCreatingNewTag ? "close" : "add"} size={22} color={isCreatingNewTag ? "#fff" : uiThemeColor} />
                                        </TouchableOpacity>

                                        {Object.keys(tagMaster || {}).filter(t => tagMaster![t].layer === selectedLayer && t !== selectedLayer).map(tag => (
                                            <TouchableOpacity 
                                                key={tag} 
                                                onPress={() => { setTagInput(tag); setTagColor(tagMaster![tag].color); setIsCreatingNewTag(false); }}
                                                onLongPress={() => handleLongPressTag(tag)}
                                                style={[styles.tagChip, tagInput === tag && { backgroundColor: tagMaster![tag].color, borderColor: tagMaster![tag].color }]}
                                            >
                                                <View style={[styles.dot, { backgroundColor: tagInput === tag ? "#fff" : tagMaster![tag].color }]} />
                                                <Text style={[styles.tagText, tagInput === tag && { color: "#fff" }]}>{tag}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {isCreatingNewTag && (
                                    <View style={[styles.newTagInputArea, { borderColor: uiThemeColor }]}>
                                        <View style={styles.tagInputRow}>
                                            <TextInput 
                                                autoFocus
                                                style={styles.newTagInput}
                                                placeholder="新しいタグ名を入力"
                                                value={tagInput}
                                                onChangeText={setTagInput}
                                            />
                                            <View style={[styles.colorIndicator, { backgroundColor: tagColor }]} />
                                        </View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                                            {COLOR_PALETTE.map(c => (
                                                <TouchableOpacity key={c} onPress={() => setTagColor(c)} style={[styles.miniColorDot, { backgroundColor: c }, tagColor === c && { borderWidth: 2, borderColor: '#333' }]} />
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            <View style={[styles.optionSection, { borderLeftColor: uiThemeColor }]}>
                                <View style={styles.switchRow}>
                                    <View style={styles.iconLabel}><Ionicons name="card-outline" size={20} color={isExpense ? uiThemeColor : "#666"} /><Text style={[styles.switchLabel, isExpense && { color: uiThemeColor }]}>支出を記録</Text></View>
                                    <Switch value={isExpense} onValueChange={setIsExpense} trackColor={{ true: uiThemeColor }} />
                                </View>
                                {isExpense && <TextInput style={styles.input} placeholder="金額" keyboardType="numeric" value={inputAmount} onChangeText={setInputAmount} />}

                                <View style={styles.switchRow}>
                                    <View style={styles.iconLabel}><Ionicons name="checkmark-done-circle-outline" size={20} color={isTodo ? uiThemeColor : "#666"} /><Text style={[styles.switchLabel, isTodo && { color: uiThemeColor }]}>ToDo詳細設定</Text></View>
                                    <Switch value={isTodo} onValueChange={setIsTodo} trackColor={{ true: uiThemeColor }} />
                                </View>

                                {isTodo && (
    <View style={styles.expandingInput}>
        {subTasks.map((task, idx) => (
            <View key={task.id} style={[styles.subTaskCard, { borderLeftColor: uiThemeColor }]}>
                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems: 'center'}}>
                    <TextInput 
                        style={styles.subTaskInput} 
                        placeholder="やる事..." 
                        placeholderTextColor="#BBB"
                        value={task.title} 
                        onChangeText={(t) => { 
                            const n = [...subTasks]; n[idx].title = t; setSubTasks(n); 
                        }} 
                    />
                    <TouchableOpacity onPress={() => setSubTasks(subTasks.filter(t => t.id !== task.id))}>
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                </View>

                <View style={styles.subTaskControls}>
                    {/* 日付選択 */}
                    <View style={[styles.datePickerContainer, { backgroundColor: uiThemeColor + "1A" }]}>
                        <Ionicons name="calendar-outline" size={14} color={uiThemeColor} style={{ marginRight: 5 }} />
                        <DateTimePicker 
                            value={task.date} 
                            mode="date" 
                            display="compact" 
                            onChange={(e, d) => { 
                                if (d) { const n = [...subTasks]; n[idx].date = d; setSubTasks(n); } 
                            }} 
                            style={{ width: 100 }} 
                        />
                    </View>

                    {/* 支出スイッチ */}
                    <View style={{flexDirection:'row', alignItems:'center'}}>
                        <Ionicons name="logo-yen" size={14} color={task.isExpense ? uiThemeColor : "#BBB"} />
                        <Switch 
                            value={task.isExpense} 
                            onValueChange={(v) => { 
                                const n = [...subTasks]; n[idx].isExpense = v; setSubTasks(n); 
                            }} 
                            trackColor={{ true: uiThemeColor }} 
                            style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} 
                        />
                    </View>
                </View>

                {/* 🌟 子タスクの金額入力欄（スイッチがONの時だけ出現） */}
                {task.isExpense && (
                    <View style={styles.subTaskAmountContainer}>
                        <Text style={[styles.yenSymbol, { color: uiThemeColor }]}>¥</Text>
                        <TextInput 
                            style={styles.subTaskAmountInput} 
                            placeholder="0" 
                            placeholderTextColor="#BBB"
                            keyboardType="numeric" 
                            value={task.amount > 0 ? task.amount.toString() : ""}
                            onChangeText={(v) => { 
                                const n = [...subTasks]; 
                                n[idx].amount = parseInt(v) || 0; 
                                setSubTasks(n); 
                            }} 
                        />
                    </View>
                )}
            </View>
        ))}
        <TouchableOpacity 
            style={styles.addSubTaskBtn} 
            onPress={() => setSubTasks([...subTasks, { id: Date.now(), title: "", date: new Date(selectedDate), amount: 0, isExpense: false }])}
        >
            <Ionicons name="add-circle" size={22} color={uiThemeColor} />
            <Text style={{ color: uiThemeColor, fontWeight: 'bold', marginLeft: 8 }}>子タスクを追加</Text>
        </TouchableOpacity>
    </View>
)}
                            </View>

                            <View style={styles.actionButtons}>
                                <TouchableOpacity onPress={onClose} style={styles.cancelBtn}><Text style={{ color: '#999' }}>キャンセル</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: uiThemeColor }]}>
                                    <Text style={styles.saveBtnText}>保存して閉じる</Text>
                                </TouchableOpacity>
                            </View>

                            {/* 🌟 削除ボタン（編集モード時のみ出現） */}
                            {selectedItem && (
                                <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                    <Text style={styles.deleteBtnText}>この予定を削除する</Text>
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
    modalContent: { width: "94%", backgroundColor: "#fff", padding: 22, borderRadius: 25, maxHeight: "90%", overflow: 'hidden' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 18, fontWeight: "bold" },
    dateBadge: { backgroundColor: '#F0F0F5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, fontSize: 12, color: '#666' },
    mainInput: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, paddingVertical: 10, color: '#333' },
    label: { fontSize: 11, color: "#AAA", fontWeight: "bold", marginBottom: 10, textTransform: 'uppercase' },
    layerContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 },
    layerChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: "#F5F5F7" },
    layerChipText: { fontSize: 13, color: "#666", fontWeight: "bold" },
    tagSection: { marginBottom: 25 },
    tagListContainer: { flexDirection: 'row', alignItems: 'center' },
    addTagCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F0F0F5', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    tagChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', marginRight: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    tagText: { fontSize: 14, fontWeight: '600', color: '#444' },
    newTagInputArea: { marginTop: 15, padding: 15, backgroundColor: '#F8F8FA', borderRadius: 15, borderWidth: 1, borderStyle: 'dashed' },
    tagInputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#DDD', paddingBottom: 5 },
    newTagInput: { flex: 1, fontSize: 16, color: '#333', fontWeight: 'bold' },
    colorIndicator: { width: 16, height: 16, borderRadius: 8, marginLeft: 10 },
    miniColorDot: { width: 24, height: 24, borderRadius: 12, marginRight: 10 },
    optionSection: { backgroundColor: '#F8F8FA', borderRadius: 20, padding: 15, marginBottom: 20, borderLeftWidth: 5 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    switchLabel: { fontSize: 15, fontWeight: '500' },
    expandingInput: { marginTop: 10 },
    subTaskCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, borderLeftWidth: 5 },
    subTaskControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    datePickerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
    cancelBtn: { padding: 12 },
    saveBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
    saveBtnText: { color: "#fff", fontWeight: "bold" },
    addSubTaskBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
    input: { backgroundColor: "#FFF", padding: 12, borderRadius: 10, marginTop: 5, borderWidth: 1, borderColor: '#EEE', color: '#333' },
    deleteBtn: { marginTop: 30, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F0F0F5', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    deleteBtnText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
    subTaskAmountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F5',
    },
    yenSymbol: {
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 5,
    },
    subTaskAmountInput: {
        flex: 1,
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
        paddingVertical: 2,
    },
    subTaskInput: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
        color: '#333',
        paddingVertical: 5, // 少し広げて打ちやすく
    },
});