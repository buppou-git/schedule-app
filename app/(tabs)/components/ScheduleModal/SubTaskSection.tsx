import { Ionicons } from "@expo/vector-icons";
import React, { Dispatch, SetStateAction, useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScheduleFormData, SubTask } from "../../../../types"; // 🌟 ScheduleFormData を追加
import { styles } from "./ScheduleModal.styles";
import { SubTaskItem } from "./SubTaskItem";

interface SubTaskSectionProps {
  showSubTasks: boolean;
  setShowSubTasks: (val: boolean) => void;
  subTasks: SubTask[];
  setSubTasks: Dispatch<SetStateAction<SubTask[]>>;
  uiThemeColor: string;
  selectedDate: string;
  currentQuickTags: string[];
  updateForm: (updates: Partial<ScheduleFormData>) => void; // 🌟 anyを修正
}
export const SubTaskSection = React.memo(
  ({
    showSubTasks,
    setShowSubTasks,
    subTasks,
    setSubTasks,
    uiThemeColor,
    selectedDate,
    currentQuickTags,
    updateForm,
  }: SubTaskSectionProps) => {

    // 🌟 1. 全体更新を局所化＆キャッシュ
    const handleUpdateSubTask = useCallback(
      (id: number, updates: Partial<SubTask>) => {
        setSubTasks((prev: SubTask[]) =>
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
      },
      [setSubTasks]
    );

    const handleDeleteSubTask = useCallback(
      (id: number) => {
        setSubTasks((prev: SubTask[]) => prev.filter((t) => t.id !== id));
      },
      [setSubTasks]
    );

    const handleAddTodo = useCallback(() => {
      updateForm({ isTodo: true });
      setSubTasks((prev: SubTask[]) => [
        ...prev,
        {
          id: Date.now(),
          title: "",
          date: new Date(selectedDate),
          hasDateTime: false,
          amount: 0,
          isExpense: false,
          isIncome: false,
          isDone: false,
          category: "",
        },
      ]);
    }, [selectedDate, setSubTasks, updateForm]);

    const handleAddExpense = useCallback(() => {
      updateForm({ isExpense: true });
      setSubTasks((prev: SubTask[]) => [
        ...prev,
        {
          id: Date.now(),
          title: "",
          date: new Date(selectedDate),
          hasDateTime: false,
          amount: 0,
          isExpense: true,
          isIncome: false,
          isDone: false,
          category: currentQuickTags[0] || "食費",
        },
      ]);
    }, [selectedDate, currentQuickTags, setSubTasks, updateForm]);

    const handleToggleShow = useCallback(() => {
      setShowSubTasks(!showSubTasks);
    }, [showSubTasks, setShowSubTasks]);

    return (
      <View>
        <TouchableOpacity
          style={[styles.subTaskToggleBtn, { borderColor: uiThemeColor }]}
          onPress={handleToggleShow}
        >
          <Ionicons
            name={showSubTasks ? "chevron-up" : "list-outline"}
            size={18}
            color={uiThemeColor}
          />
          <Text style={[localStyles.toggleText, { color: uiThemeColor }]}>
            {showSubTasks ? "詳細入力を閉じる" : "詳細を追加"}
          </Text>
        </TouchableOpacity>

        {showSubTasks && (
          <View style={styles.expandingInput}>
            {/* 🌟 2. mapの中身は分離したコンポーネントに任せる！ */}
            {subTasks.map((task) => (
              <SubTaskItem
                key={task.id}
                task={task}
                uiThemeColor={uiThemeColor}
                selectedDate={selectedDate}
                currentQuickTags={currentQuickTags}
                onUpdate={handleUpdateSubTask}
                onDelete={handleDeleteSubTask}
              />
            ))}

            <View style={localStyles.addBtnsRow}>
              <TouchableOpacity
                style={[
                  styles.addSubTaskBtn,
                  localStyles.addBtnBase,
                  { backgroundColor: uiThemeColor + "15" },
                ]}
                onPress={handleAddTodo}
              >
                <Ionicons name="add-circle" size={18} color={uiThemeColor} />
                <Text style={[localStyles.addBtnText, { color: uiThemeColor }]}>
                  サブタスク
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addSubTaskBtn,
                  localStyles.addBtnBase,
                  localStyles.addExpenseBg,
                ]}
                onPress={handleAddExpense}
              >
                <Ionicons name="wallet" size={18} color="#FF9500" />
                <Text style={[localStyles.addBtnText, localStyles.addExpenseText]}>
                  追加出費
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }
);

const localStyles = StyleSheet.create({
  toggleText: { fontWeight: "bold", marginLeft: 8 },
  addBtnsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  addBtnBase: { flex: 1, borderRadius: 12, paddingVertical: 12, justifyContent: "center" },
  addBtnText: { fontWeight: "bold", marginLeft: 6 },
  addExpenseBg: { backgroundColor: "#FF950015" },
  addExpenseText: { color: "#FF9500" },
});