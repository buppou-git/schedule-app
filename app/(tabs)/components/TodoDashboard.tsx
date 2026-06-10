import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SectionList, StyleSheet, Text, View } from "react-native";
import { ScheduleItem } from "../../../types";
import TodoItem from "./TodoItem";

interface TodoDashboardProps {
  dayTasks: ScheduleItem[];
  upcomingTasks: ScheduleItem[];
  selectedDate: string;
  currentSolidColor: string;
  activeTags: string[]; // 🌟 追加：エラー解消のため
  formatEventTime: (date: ScheduleItem) => string;
  openEditModal: (item: ScheduleItem) => void;
  toggleTodo: (date: string, id: string) => void;
  toggleSubTodo: (date: string, parentId: string, subTaskId: number) => void;
  setEditingSubTaskInfo: (info: any) => void;
  setSubTaskModalVisible: (visible: boolean) => void;
  onLongPress: (item: ScheduleItem) => void;
  calculateStreak: (completedDates: string[] | undefined) => number;
}

export const TodoDashboard = React.memo(
  ({
    dayTasks,
    upcomingTasks,
    selectedDate,
    currentSolidColor,
    activeTags, // 🌟 追加：エラー解消のため
    formatEventTime,
    openEditModal,
    toggleTodo,
    toggleSubTodo,
    setEditingSubTaskInfo,
    setSubTaskModalVisible,
    onLongPress,
    calculateStreak,
  }: TodoDashboardProps) => {
    const [y, m, d] = selectedDate.split("-");

    // =========================================================
    // 🌟 楽観的UI (Optimistic UI) ＆ 進捗バー即時反映システム
    // =========================================================
    const [optDayTasks, setOptDayTasks] = useState(dayTasks);
    const isUpdating = useRef(false);

    // 親（サーバー側データ）から最新データが降ってきたら同期（ただし操作直後の1秒間はブロック）
    useEffect(() => {
      if (!isUpdating.current) {
        setOptDayTasks(dayTasks);
      }
    }, [dayTasks]);

    // 🌟 親タスク用：タップした瞬間に進捗バーの計算を0秒で書き換える関数
    const handleToggleTodoOptimistic = useCallback(
      (date: string, id: string) => {
        isUpdating.current = true;
        setOptDayTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isDone: !t.isDone } : t)),
        );
        toggleTodo(date, id);

        setTimeout(() => {
          isUpdating.current = false;
        }, 1000);
      },
      [toggleTodo],
    );

    // 🌟 サブタスク用：タップした瞬間に親タスクの完了状態を計算して進捗バーに即反映
    const handleToggleSubTodoOptimistic = useCallback(
      (date: string, parentId: string, subTaskId: number) => {
        isUpdating.current = true;
        setOptDayTasks((prev) =>
          prev.map((t) => {
            if (t.id === parentId && t.subTasks) {
              const newSubTasks = t.subTasks.map((sub) =>
                sub.id === subTaskId ? { ...sub, isDone: !sub.isDone } : sub,
              );
              const pureTodos = newSubTasks.filter(
                (s) => !s.isExpense && !s.isIncome,
              );
              const isAllDone =
                pureTodos.length > 0
                  ? pureTodos.every((s) => s.isDone)
                  : t.isDone;

              return { ...t, subTasks: newSubTasks, isDone: isAllDone };
            }
            return t;
          }),
        );
        toggleSubTodo(date, parentId, subTaskId);

        setTimeout(() => {
          isUpdating.current = false;
        }, 1000);
      },
      [toggleSubTodo],
    );

    // 🌟 依存先を optDayTasks (楽観データ) に変更することで進捗バーが0秒で動く！
    const { completedDayTasks, progress, sections } = useMemo(() => {
      const total = optDayTasks.length;
      const completed = optDayTasks.filter((t) => t.isDone).length;
      const prog = total > 0 ? completed / total : 0;

      const routineTasks = optDayTasks.filter((t) => t.repeatType);
      const oneOffTasks = optDayTasks.filter((t) => !t.repeatType);

      const secs = [];
      if (routineTasks.length > 0)
        secs.push({ title: "ROUTINE / 習慣", data: routineTasks });
      if (oneOffTasks.length > 0)
        secs.push({ title: "TASKS / タスク", data: oneOffTasks });
      if (upcomingTasks.length > 0)
        secs.push({ title: "UPCOMING / 近日中のタスク", data: upcomingTasks });

      return { completedDayTasks: completed, progress: prog, sections: secs };
    }, [optDayTasks, upcomingTasks]);

    const renderHeader = () => (
      <View style={localStyles.modernHeader}>
        <View style={localStyles.headerLabelRow}>
          <Text
            style={[localStyles.mainDateTitle, { color: currentSolidColor }]}
          >
            {parseInt(m)}月{parseInt(d)}日 の進捗
          </Text>
          <Text style={localStyles.numericProgress}>
            {completedDayTasks} / {optDayTasks.length}
          </Text>
        </View>
        {optDayTasks.length > 0 && (
          <View style={localStyles.thinProgressBg}>
            <View
              style={[
                localStyles.thinProgressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: currentSolidColor,
                },
              ]}
            />
          </View>
        )}
      </View>
    );

    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={localStyles.sectionTitle}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <TodoItem
            item={item}
            itemDate={selectedDate}
            selectedDate={selectedDate}
            activeTags={activeTags} // 🌟 これで TodoItem.tsx のエラーが完全に消えます！
            formatEventTime={formatEventTime}
            openEditModal={openEditModal}
            toggleTodo={handleToggleTodoOptimistic} // 🌟 爆速関数をセット
            toggleSubTodo={handleToggleSubTodoOptimistic} // 🌟 爆速関数をセット
            setEditingSubTaskInfo={setEditingSubTaskInfo}
            setSubTaskModalVisible={setSubTaskModalVisible}
            streakCount={calculateStreak(item.completedDates)}
            onLongPress={onLongPress}
          />
        )}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />
    );
  },
);

const localStyles = StyleSheet.create({
  modernHeader: { marginBottom: 20, paddingTop: 10 },
  headerLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  mainDateTitle: { fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  numericProgress: { fontSize: 16, fontWeight: "800", color: "#8E8E93" },
  thinProgressBg: {
    height: 6,
    backgroundColor: "#E5E5EA",
    borderRadius: 3,
    overflow: "hidden",
  },
  thinProgressFill: { height: "100%", borderRadius: 3 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
});
