import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo } from "react";
import {
    FlatList, // 🌟 追加！
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SubTask } from "../../../../types"; // 🌟 パス調整
import { ModernDatePicker } from "./ModernDatePicker";
import { styles } from "./ScheduleModal.styles";

interface SubTaskItemProps {
  task: SubTask;
  uiThemeColor: string;
  selectedDate: string;
  currentQuickTags: string[];
  onUpdate: (id: number, updates: Partial<SubTask>) => void;
  onDelete: (id: number) => void;
}

export const SubTaskItem = React.memo(
  ({
    task,
    uiThemeColor,
    selectedDate,
    currentQuickTags,
    onUpdate,
    onDelete,
  }: SubTaskItemProps) => {
    // 🌟 全てのイベントハンドラをキャッシュ
    const handleTitleChange = useCallback(
      (t: string) => onUpdate(task.id, { title: t }),
      [task.id, onUpdate]
    );

    const handleAmountChange = useCallback(
      (t: string) => onUpdate(task.id, { amount: parseInt(t) || 0 }),
      [task.id, onUpdate]
    );

    const handleDoneToggle = useCallback(
      () => onUpdate(task.id, { isDone: !task.isDone }),
      [task.id, task.isDone, onUpdate]
    );

    const handleIncomeToggle = useCallback(
      (v: boolean) => {
        onUpdate(task.id, { isIncome: v, isExpense: v ? false : task.isExpense });
      },
      [task.id, task.isExpense, onUpdate]
    );

    const handleAddDeadline = useCallback(() => {
      onUpdate(task.id, {
        hasDateTime: true,
        deadlineDate: new Date(selectedDate),
        endTime: new Date(),
      });
    }, [task.id, selectedDate, onUpdate]);

    const handleRemoveDeadline = useCallback(
      () => onUpdate(task.id, { hasDateTime: false }),
      [task.id, onUpdate]
    );

    const handleDeadlineDateChange = useCallback(
      (d: Date) => onUpdate(task.id, { deadlineDate: d }),
      [task.id, onUpdate]
    );

    const handleDeadlineTimeChange = useCallback(
      (d: Date) => onUpdate(task.id, { endTime: d }),
      [task.id, onUpdate]
    );

    const handleDelete = useCallback(() => onDelete(task.id), [task.id, onDelete]);

    const borderColor = useMemo(() => {
      if (task.isExpense) return "#FF9500";
      if (task.isIncome) return "#34C759";
      return uiThemeColor;
    }, [task.isExpense, task.isIncome, uiThemeColor]);

    // 🌟 FlatList用の描画関数も useCallback でキャッシュ！
    const renderCategoryItem = useCallback(
      ({ item: cat }: { item: string }) => {
        const isSelected = task.category === cat;
        return (
          <TouchableOpacity
            onPress={() => onUpdate(task.id, { category: cat, title: cat })}
            style={[
              styles.miniReminderChip,
              localStyles.chipBase,
              isSelected && localStyles.chipSelected,
            ]}
          >
            <Text
              style={[
                localStyles.chipText,
                isSelected && localStyles.chipTextSelected,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        );
      },
      [task.category, task.id, onUpdate]
    );

    return (
      <View
        style={[
          styles.subTaskCard,
          localStyles.cardPadding,
          { borderLeftColor: borderColor },
        ]}
      >
        {task.isExpense ? (
          // ==========================================
          // 💰 金額モード
          // ==========================================
          <View>
            <View style={localStyles.headerRow}>
              <Text style={localStyles.categoryLabel}>カテゴリを選択</Text>
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons name="close-circle" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
            
            {/* 🌟 ここを FlatList に完全移行！ */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={currentQuickTags}
              keyExtractor={(item) => item}
              renderItem={renderCategoryItem}
              style={localStyles.categoryScroll}
            />

            <View style={localStyles.amountInputRow}>
              <Ionicons
                name="wallet-outline"
                size={16}
                color="#FF9500"
                style={localStyles.walletIcon}
              />
              <TextInput
                style={localStyles.amountInput}
                keyboardType="numeric"
                placeholder="0"
                value={task.amount ? task.amount.toString() : ""}
                onChangeText={handleAmountChange}
              />
              <Text style={localStyles.yenLabel}>円</Text>
            </View>
          </View>
        ) : (
          // ==========================================
          // ✅ タスクモード
          // ==========================================
          <View>
            <View style={localStyles.taskRow}>
              <TouchableOpacity onPress={handleDoneToggle} style={localStyles.checkbox}>
                <Ionicons
                  name={task.isDone ? "checkbox" : "square-outline"}
                  size={24}
                  color={task.isDone ? "#8E8E93" : uiThemeColor}
                />
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.subTaskInput,
                  localStyles.taskInput,
                  task.isDone && localStyles.taskInputDone,
                ]}
                placeholder="タスクを入力..."
                placeholderTextColor="#BBB"
                value={task.title}
                onChangeText={handleTitleChange}
              />
              <TouchableOpacity onPress={handleDelete} style={localStyles.deleteIcon}>
                <Ionicons name="close-circle" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>

            <View style={localStyles.optionsRow}>
              <View
                style={[
                  localStyles.incomeToggle,
                  task.isIncome ? localStyles.incomeBgActive : localStyles.incomeBgInactive,
                ]}
              >
                <Ionicons
                  name="trending-up"
                  size={14}
                  color={task.isIncome ? "#34C759" : "#8E8E93"}
                />
                <Switch
                  value={task.isIncome || false}
                  onValueChange={handleIncomeToggle}
                  style={localStyles.switchScale}
                  trackColor={{ false: "#C7C7CC", true: "#34C759" }}
                />
                {task.isIncome && (
                  <TextInput
                    style={localStyles.incomeAmountInput}
                    keyboardType="numeric"
                    placeholder="￥金額"
                    value={task.amount ? task.amount.toString() : ""}
                    onChangeText={handleAmountChange}
                  />
                )}
              </View>

              {!task.hasDateTime ? (
                <TouchableOpacity
                  style={[styles.microChip, localStyles.addDeadlineBtn]}
                  onPress={handleAddDeadline}
                >
                  <Text style={localStyles.addDeadlineText}>+ ⏱️ 締切を設定</Text>
                </TouchableOpacity>
              ) : (
                <View style={localStyles.deadlineRow}>
                  <ModernDatePicker
                    value={task.deadlineDate || new Date(selectedDate)}
                    mode="date"
                    onChange={handleDeadlineDateChange}
                    themeColor={uiThemeColor}
                  />
                  <ModernDatePicker
                    value={task.endTime || new Date()}
                    mode="time"
                    onChange={handleDeadlineTimeChange}
                    themeColor={uiThemeColor}
                  />
                  <TouchableOpacity onPress={handleRemoveDeadline}>
                    <Ionicons name="close" size={16} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  }
);

const localStyles = StyleSheet.create({
  cardPadding: { paddingVertical: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  categoryLabel: { fontSize: 11, fontWeight: "bold", color: "#8E8E93" },
  categoryScroll: { marginBottom: 15 },
  chipBase: { marginRight: 8, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  chipSelected: { backgroundColor: "#FF9500", borderColor: "#FF9500" },
  chipText: { fontSize: 11, fontWeight: "bold", color: "#8E8E93" },
  chipTextSelected: { color: "#FFF" },
  amountInputRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F7", padding: 12, borderRadius: 14 },
  walletIcon: { marginRight: 8 },
  amountInput: { flex: 1, fontSize: 18, fontWeight: "bold", textAlign: "right", color: "#1C1C1E" },
  yenLabel: { fontSize: 14, fontWeight: "bold", color: "#1C1C1E", marginLeft: 6 },
  taskRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  checkbox: { marginRight: 10 },
  taskInput: { flex: 1, fontSize: 16, minHeight: 32, paddingVertical: 4 },
  taskInputDone: { textDecorationLine: "line-through", color: "#8E8E93" },
  deleteIcon: { marginLeft: 8 },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  incomeToggle: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  incomeBgActive: { backgroundColor: "#34C75915" },
  incomeBgInactive: { backgroundColor: "#F2F2F7" },
  switchScale: { transform: [{ scale: 0.6 }], marginLeft: 2 },
  incomeAmountInput: { width: 60, textAlign: "right", fontSize: 12, fontWeight: "bold", marginLeft: 4 },
  addDeadlineBtn: { paddingVertical: 6 },
  addDeadlineText: { fontSize: 11, color: "#8E8E93", fontWeight: "bold" },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});