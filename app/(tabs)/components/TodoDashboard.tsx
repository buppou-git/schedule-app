import React, { useMemo } from "react";
import { SectionList, StyleSheet, Text, View } from "react-native";
// 🌟 パスは環境に合わせて調整してください
import { ScheduleItem } from "../../../types";
import TodoItem from "./TodoItem";

interface TodoDashboardProps {
  dayTasks: ScheduleItem[];
  upcomingTasks: ScheduleItem[];
  selectedDate: string;
  currentSolidColor: string;
  // 🌟 元の index.tsx で TodoItem に渡していた関数をすべて定義
  formatEventTime: (date: ScheduleItem) => string;
  openEditModal: (item: ScheduleItem) => void;
  toggleTodo: (date: string, id: string) => void;
  toggleSubTodo: (date: string, parentId: string, subTaskId: number) => void;
  setEditingSubTaskInfo: (info: any) => void;
  setSubTaskModalVisible: (visible: boolean) => void;
  onLongPress: (item: ScheduleItem) => void;
  calculateStreak: (completedDates: string[] | undefined) => number;
}

export const TodoDashboard = React.memo(({
  dayTasks,
  upcomingTasks,
  selectedDate,
  currentSolidColor,
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

  const { completedDayTasks, progress, sections } = useMemo(() => {
    const total = dayTasks.length;
    const completed = dayTasks.filter((t) => t.isDone).length;
    const prog = total > 0 ? completed / total : 0;

    const routineTasks = dayTasks.filter((t) => t.repeatType);
    const oneOffTasks = dayTasks.filter((t) => !t.repeatType);

    const secs = [];
    if (routineTasks.length > 0) secs.push({ title: "ROUTINE / 習慣", data: routineTasks });
    if (oneOffTasks.length > 0) secs.push({ title: "TASKS / タスク", data: oneOffTasks });
    if (upcomingTasks.length > 0) secs.push({ title: "UPCOMING / 近日中のタスク", data: upcomingTasks });

    return { completedDayTasks: completed, progress: prog, sections: secs };
  }, [dayTasks, upcomingTasks]);

  const renderHeader = () => (
    <View style={localStyles.modernHeader}>
      <View style={localStyles.headerLabelRow}>
        <Text style={[localStyles.mainDateTitle, { color: currentSolidColor }]}>
          {parseInt(m)}月{parseInt(d)}日 の進捗
        </Text>
        <Text style={localStyles.numericProgress}>
          {completedDayTasks} / {dayTasks.length}
        </Text>
      </View>
      {dayTasks.length > 0 && (
        <View style={localStyles.thinProgressBg}>
          <View
            style={[
              localStyles.thinProgressFill,
              { width: `${progress * 100}%`, backgroundColor: currentSolidColor },
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
          formatEventTime={formatEventTime}
          openEditModal={openEditModal}
          toggleTodo={toggleTodo}
          toggleSubTodo={toggleSubTodo}
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
});

const localStyles = StyleSheet.create({
  modernHeader: { marginBottom: 20, paddingTop: 10 },
  headerLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
  mainDateTitle: { fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  numericProgress: { fontSize: 16, fontWeight: "800", color: "#8E8E93" },
  thinProgressBg: { height: 6, backgroundColor: "#E5E5EA", borderRadius: 3, overflow: "hidden" },
  thinProgressFill: { height: "100%", borderRadius: 3 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#8E8E93", letterSpacing: 1, marginBottom: 8, marginTop: 16 }
});