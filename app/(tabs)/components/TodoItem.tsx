import { Ionicons } from "@expo/vector-icons";
import React, { memo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppStore } from "../../../store/useAppStore";
import { ScheduleItem, SubTask } from "../../../types";

interface TodoItemProps {
  item: ScheduleItem;
  itemDate: string;
  selectedDate: string;
  formatEventTime: (item: ScheduleItem) => string;
  openEditModal: (item: ScheduleItem) => void;
  toggleTodo: (date: string, id: string) => void;
  toggleSubTodo: (date: string, parentId: string, subTaskId: number) => void;

  // 🌟 ここは「どんなオブジェクトを受け取るか」を明確に定義！
  setEditingSubTaskInfo: (info: {
    parentId: string;
    parentTitle: string;
    date: string;
    subTask: SubTask;
  }) => void;

  setSubTaskModalVisible: (visible: boolean) => void;
  onLongPress: (item: ScheduleItem) => void; // 🌟
  streakCount: number;
}

const TodoItem = memo(function TodoItem({
  item,
  itemDate,
  selectedDate,
  formatEventTime,
  openEditModal,
  toggleTodo,
  toggleSubTodo,
  setEditingSubTaskInfo,
  setSubTaskModalVisible,
  onLongPress,
  streakCount,
}: TodoItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { tagMaster, layerMaster } = useAppStore();

  const itemTags =
    item.tags && item.tags.length > 0 ? item.tags : item.tag ? [item.tag] : [];

  const displayColors = itemTags.map((tag: string) => {
    const color = tagMaster[tag]?.color || layerMaster[tag] || "#999";
    return color;
  });
  const uniqueColors = Array.from(new Set(displayColors));

  const isPeriodTask = item.endDate && item.startDate !== item.endDate;
  let daysLeft = null;
  let isFinalDay = false;

  if (isPeriodTask && item.endDate) {
    const targetD = new Date(selectedDate);
    const endD = new Date(item.endDate);
    const diffTime = endD.getTime() - targetD.getTime();
    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isFinalDay = daysLeft === 0;
  }

  return (
    <View style={{ marginBottom: 12 }}>
      {/* 親タスクのカード */}
      <TouchableOpacity
        style={[styles.todoCard, item.isDone && styles.todoCardDone]}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
        onLongPress={() => onLongPress(item)}
        delayLongPress={300} // 0.3秒で発火
      >
        <View style={styles.stripeContainer}>
          {uniqueColors.map((color: any, idx: number) => (
            <View
              key={idx}
              style={[styles.todoAccent, { backgroundColor: color }]}
            />
          ))}
        </View>
        <View style={styles.todoContent}>
          <View style={styles.todoMainRow}>
            <Text
              style={[styles.todoTitle, item.isDone && styles.todoTitleDone]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 4 }}
            >
              {itemTags.map((tag: string, idx: number) => (
                <View
                  key={idx}
                  style={[
                    styles.miniTagBadge,
                    {
                      backgroundColor: displayColors[idx] + "15",
                      borderColor: displayColors[idx],
                    },
                  ]}
                >
                  <Text
                    style={[styles.miniTagText, { color: displayColors[idx] }]}
                  >
                    {tag}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
          <View style={styles.todoSubRow}>
            {streakCount > 0 && (
              <View style={styles.streakBadge}>
                <Ionicons
                  name="flame"
                  size={10}
                  color="#FF9500"
                  style={{ marginRight: 2 }}
                />
                <Text style={styles.streakText}>{streakCount} Days</Text>
              </View>
            )}

            {isFinalDay && !item.isDone ? (
              <View style={styles.deadlineBadgeUrgent}>
                <Ionicons
                  name="flame"
                  size={10}
                  color="#FFF"
                  style={{ marginRight: 2 }}
                />
                <Text style={styles.deadlineBadgeTextUrgent}>
                  TODAY: 最終日!
                </Text>
              </View>
            ) : daysLeft !== null && daysLeft > 0 && !item.isDone ? (
              <View style={styles.deadlineBadgeSafe}>
                <Ionicons
                  name="leaf-outline"
                  size={10}
                  color="#34C759"
                  style={{ marginRight: 2 }}
                />
                <Text style={styles.deadlineBadgeTextSafe}>
                  残り {daysLeft} 日
                </Text>
              </View>
            ) : null}
            <View style={styles.todoTimeRow}>
              <Ionicons name="time-outline" size={10} color="#8E8E93" />
              <Text style={styles.todoTimeText}>{formatEventTime(item)}</Text>
            </View>
          </View>
        </View>

        {!item.subTasks || item.subTasks.length === 0 ? (
          <TouchableOpacity
            style={styles.checkButton}
            onPress={() => toggleTodo(itemDate, item.id)}
          >
            <Ionicons
              name={item.isDone ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={item.isDone ? "#34C759" : "#C7C7CC"}
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.checkButton, { opacity: 0.5 }]}>
            <Ionicons
              name={
                item.isDone ? "checkmark-done-circle" : "list-circle-outline"
              }
              size={24}
              color={item.isDone ? "#34C759" : "#AEAEB2"}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* 🌟 サブタスクの表示 */}
      {item.subTasks && item.subTasks.length > 0 && (
        <View>
          {/* 🌟 展開用トグルボタン */}
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 8,
              marginLeft: 20,
              paddingVertical: 4,
            }}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.6}
          >
            <Ionicons
              name={isExpanded ? "chevron-down" : "chevron-forward"}
              size={16}
              color="#8E8E93"
            />
            <Text
              style={{
                fontSize: 12,
                color: "#8E8E93",
                marginLeft: 6,
                fontWeight: "600",
              }}
            >
              サブタスク (
              {item.subTasks.filter((s: SubTask) => s.isDone).length}/
              {item.subTasks.length})
            </Text>
          </TouchableOpacity>

          {/* 🌟 開いている時だけ中身を表示 */}
          {isExpanded && (
            <View style={styles.subTaskListContainer}>
              {item.subTasks.map((sub: SubTask) => (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.subTaskMiniCard}
                  onPress={() => toggleSubTodo(itemDate, item.id, sub.id)}
                >
                  {/* 🌟 支出（お金の記録）以外の場合のみチェックボックスを表示 */}
                  {!sub.isExpense && (
                    <Ionicons
                      name={sub.isDone ? "checkbox" : "square-outline"}
                      size={16}
                      color={sub.isDone ? "#8E8E93" : "#C7C7CC"}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text
                    style={[
                      styles.subTaskMiniTitle,
                      sub.isDone && {
                        color: "#8E8E93",
                        textDecorationLine: "line-through",
                      },
                    ]}
                  >
                    {sub.title}
                  </Text>

                  {/* サブタスクの時間 */}
                  {sub.hasDateTime && sub.endTime && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginRight: 8,
                      }}
                    >
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color="#AEAEB2"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ fontSize: 10, color: "#8E8E93" }}>
                        {/* 🌟 データの型が何であっても、確実に文字の時刻にして表示する */}
                        {sub.endTime instanceof Date
                          ? `${("0" + sub.endTime.getHours()).slice(-2)}:${("0" + sub.endTime.getMinutes()).slice(-2)}`
                          : String(sub.endTime)}
                      </Text>
                    </View>
                  )}

                  {/* お金の表示 */}
                  {(sub.isExpense || sub.isIncome) && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "bold",
                        color: sub.isExpense ? "#FF3B30" : "#34C759",
                        marginRight: 8,
                      }}
                    >
                      {sub.isExpense ? "-" : "+"}¥{sub.amount?.toLocaleString()}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={{ padding: 4 }}
                    onPress={() => {
                      setEditingSubTaskInfo({
                        parentId: item.id,
                        parentTitle: item.title,
                        date: itemDate,
                        subTask: sub,
                      });
                      setSubTaskModalVisible(true);
                    }}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={16}
                      color="#C7C7CC"
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  todoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#F2F2F7",
    minHeight: 56,
  },
  todoCardDone: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    opacity: 0.5,
  },
  stripeContainer: {
    flexDirection: "row",
    height: "60%",
    marginLeft: 8,
    gap: 2,
  },
  todoAccent: { width: 4, height: "100%", borderRadius: 2 },
  todoContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  todoMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  todoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
    flex: 1,
    marginRight: 8,
  },
  todoTitleDone: { color: "#8E8E93", textDecorationLine: "line-through" },
  miniTagBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  miniTagText: { fontSize: 8, fontWeight: "bold" },
  todoSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
    gap: 6,
  },
  todoTimeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  todoTimeText: { fontSize: 10, color: "#8E8E93", fontWeight: "500" },
  checkButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  deadlineBadgeUrgent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    shadowColor: "#FF3B30",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  deadlineBadgeTextUrgent: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  deadlineBadgeSafe: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5F9E7",
    borderWidth: 1,
    borderColor: "#34C759",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  deadlineBadgeTextSafe: { color: "#34C759", fontSize: 9, fontWeight: "700" },
  subTaskListContainer: {
    marginLeft: 20,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E5EA",
    marginTop: 6,
    gap: 6,
  },
  subTaskMiniCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8FA",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  subTaskMiniTitle: { fontSize: 13, fontWeight: "600", color: "#333", flex: 1 },

  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4E5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FF9500",
  },
  streakText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FF9500",
    letterSpacing: 0.5,
  },
});

export default TodoItem;
