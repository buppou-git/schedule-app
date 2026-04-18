import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

// 🌟 おしゃれなカスタムピッカーを内蔵
const ModernDatePicker = ({ value, mode, onChange, themeColor, icon }: any) => {
  const [show, setShow] = useState(false);
  const formattedValue = mode === "date"
    ? `${value.getFullYear()}/${("0" + (value.getMonth() + 1)).slice(-2)}/${("0" + value.getDate()).slice(-2)}`
    : `${("0" + value.getHours()).slice(-2)}:${("0" + value.getMinutes()).slice(-2)}`;

  return (
    <>
      <TouchableOpacity style={[styles.modernDateBtn, { borderColor: themeColor + "40", backgroundColor: themeColor + "0A" }]} onPress={() => setShow(true)}>
        {icon && <Ionicons name={icon} size={16} color={themeColor} style={{ marginRight: 6 }} />}
        <Text style={{ fontSize: 14, fontWeight: "700", color: themeColor }}>{formattedValue}</Text>
      </TouchableOpacity>
      {show && Platform.OS === "android" && (
        <DateTimePicker value={value} mode={mode} display="default" onChange={(e, d) => { setShow(false); if (e.type === "set" && d) onChange(d); }} />
      )}
      {show && Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="fade">
          <TouchableOpacity style={styles.iosPickerOverlay} activeOpacity={1} onPress={() => setShow(false)}>
            <TouchableWithoutFeedback>
              <View style={styles.iosPickerContent}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity onPress={() => setShow(false)} style={{ padding: 8 }}>
                    <Text style={{ color: themeColor, fontSize: 16, fontWeight: "bold" }}>完了</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
                  <DateTimePicker value={value} mode={mode} display="spinner" onChange={(e, d) => { if (d) onChange(d); }} textColor="#000" style={{ height: 210, width: 320 }} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
};

export default function SubTaskEditModal({ visible, onClose, subTask, onSave, themeColor }: any) {
  const [taskData, setTaskData] = useState<any>(null);

  useEffect(() => {
    if (visible && subTask) {
      setTaskData({
        ...subTask,
        date: new Date(subTask.date || new Date()),
        endTime: subTask.endTime ? new Date(subTask.endTime) : new Date(),
      });
    }
  }, [visible, subTask]);

  if (!taskData) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[styles.content, { borderTopColor: themeColor }]}>
              <View style={styles.dragIndicator} />
              
              <Text style={styles.modalTitle}>サブタスクを編集</Text>

              {/* タイトル入力 */}
              <TextInput
                style={styles.input}
                value={taskData.title}
                onChangeText={(t) => setTaskData({ ...taskData, title: t })}
                placeholder="やる事..."
                autoFocus={true}
              />

              {/* 日時設定 */}
              <View style={styles.settingRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="time-outline" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
                  <Text style={styles.settingLabel}>日時を指定</Text>
                </View>
                <Switch
                  value={taskData.hasDateTime}
                  onValueChange={(v) => setTaskData({ ...taskData, hasDateTime: v, reminderOption: v ? "1day" : "none" })}
                  trackColor={{ false: "#C7C7CC", true: themeColor }}
                />
              </View>

              {taskData.hasDateTime && (
                <View style={styles.expandedArea}>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                    <ModernDatePicker value={taskData.date} mode="date" onChange={(d: Date) => setTaskData({ ...taskData, date: d })} themeColor={themeColor} icon="calendar-outline" />
                    <ModernDatePicker value={taskData.endTime} mode="time" onChange={(d: Date) => setTaskData({ ...taskData, endTime: d })} themeColor={themeColor} icon="time-outline" />
                  </View>
                  <Text style={{ fontSize: 11, color: "#8E8E93", marginBottom: 6, fontWeight: "bold" }}>通知リマインダー</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {[{ label: "なし", v: "none" }, { label: "当日", v: "exact" }, { label: "1時間前", v: "1hour" }, { label: "1日前", v: "1day" }].map((opt) => (
                      <TouchableOpacity
                        key={opt.v}
                        style={[styles.chip, taskData.reminderOption === opt.v && { backgroundColor: themeColor, borderColor: themeColor }]}
                        onPress={() => setTaskData({ ...taskData, reminderOption: opt.v })}
                      >
                        <Text style={[styles.chipText, taskData.reminderOption === opt.v && { color: "#FFF" }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* 保存ボタン */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: themeColor }]}
                onPress={() => onSave(taskData)}
              >
                <Text style={styles.saveBtnText}>完了</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  content: { backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 6, paddingBottom: 40 },
  dragIndicator: { width: 40, height: 4, backgroundColor: "#E5E5EA", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#1C1C1E", marginBottom: 15 },
  input: { fontSize: 18, fontWeight: "bold", color: "#1C1C1E", backgroundColor: "#F2F2F7", padding: 16, borderRadius: 12, marginBottom: 20 },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F2F7" },
  settingLabel: { fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  expandedArea: { backgroundColor: "#F8F8FA", padding: 16, borderRadius: 12, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E5EA" },
  chipText: { fontSize: 11, fontWeight: "bold", color: "#8E8E93" },
  saveBtn: { marginTop: 24, padding: 16, borderRadius: 14, alignItems: "center" },
  saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  modernDateBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  iosPickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  iosPickerContent: { backgroundColor: "#FFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  iosPickerHeader: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingVertical: 12 },
});