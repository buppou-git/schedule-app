import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface TodoItemProps {
  item: any;
  itemDate: string;
  selectedDate: string;
  tagMaster: any;
  layerMaster: any;
  formatEventTime: (item: any) => string;
  openEditModal: (item: any) => void;
  toggleTodo: (date: string, id: string) => void;
  toggleSubTodo: (date: string, parentId: string, subTaskId: number) => void;
  setEditingSubTaskInfo: (info: any) => void;
  setSubTaskModalVisible: (visible: boolean) => void;
}

export default function TodoItem({
  item,
  itemDate,
  selectedDate,
  tagMaster,
  layerMaster,
  formatEventTime,
  openEditModal,
  toggleTodo,
  toggleSubTodo,
  setEditingSubTaskInfo,
  setSubTaskModalVisible,
}: TodoItemProps) {
  const itemTags = item.tags && item.tags.length > 0 ? item.tags : item.tag ? [item.tag] : [];
  
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
      >
        <View style={styles.stripeContainer}>
          {uniqueColors.map((color: any, idx: number) => (
            <View key={idx} style={[styles.todoAccent, { backgroundColor: color }]} />
          ))}
        </View>
        <View style={styles.todoContent}>
          <View style={styles.todoMainRow}>
            <Text style={[styles.todoTitle, item.isDone && styles.todoTitleDone]} numberOfLines={1}>
              {item.title}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
              {itemTags.map((tag: string, idx: number) => (
                <View key={idx} style={[styles.miniTagBadge, { backgroundColor: displayColors[idx] + "15", borderColor: displayColors[idx] }]}>
                  <Text style={[styles.miniTagText, { color: displayColors[idx] }]}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
          <View style={styles.todoSubRow}>
            {isFinalDay && !item.isDone ? (
              <View style={styles.deadlineBadgeUrgent}>
                <Ionicons name="flame" size={10} color="#FFF" style={{ marginRight: 2 }} />
                <Text style={styles.deadlineBadgeTextUrgent}>TODAY: 最終日!</Text>
              </View>
            ) : daysLeft !== null && daysLeft > 0 && !item.isDone ? (
              <View style={styles.deadlineBadgeSafe}>
                <Ionicons name="leaf-outline" size={10} color="#34C759" style={{ marginRight: 2 }} />
                <Text style={styles.deadlineBadgeTextSafe}>残り {daysLeft} 日</Text>
              </View>
            ) : null}
            <View style={styles.todoTimeRow}>
              <Ionicons name="time-outline" size={10} color="#8E8E93" />
              <Text style={styles.todoTimeText}>{formatEventTime(item)}</Text>
            </View>
          </View>
        </View>

        {(!item.subTasks || item.subTasks.length === 0) ? (
          <TouchableOpacity style={styles.checkButton} onPress={() => toggleTodo(itemDate, item.id)}>
            <Ionicons
              name={item.isDone ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={item.isDone ? "#34C759" : "#C7C7CC"}
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.checkButton, { opacity: 0.5 }]}>
            <Ionicons
              name={item.isDone ? "checkmark-done-circle" : "list-circle-outline"}
              size={24}
              color={item.isDone ? "#34C759" : "#AEAEB2"}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* サブタスクのUI */}
      {item.subTasks && item.subTasks.length > 0 && (
        <View style={styles.subTaskListContainer}>
          {item.subTasks.map((sub: any) => (
            <TouchableOpacity
              key={sub.id}
              style={[styles.subTaskMiniCard, sub.isDone && { opacity: 0.5 }]}
              onPress={() => {
                setEditingSubTaskInfo({
                  parentId: item.id,
                  parentTitle: item.title,
                  date: itemDate,
                  subTask: sub,
                });
                setSubTaskModalVisible(true);
              }}
              activeOpacity={0.6}
            >
              <TouchableOpacity
                style={{ padding: 4, marginRight: 6 }}
                onPress={() => toggleSubTodo(itemDate, item.id, sub.id)}
              >
                <Ionicons
                  name={sub.isDone ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={sub.isDone ? "#34C759" : "#AEAEB2"}
                />
              </TouchableOpacity>
              <Text style={[styles.subTaskMiniTitle, sub.isDone && styles.todoTitleDone]}>
                {sub.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  todoCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, marginBottom: 0, borderWidth: 1, borderColor: "#F2F2F7", minHeight: 56 },
  todoCardDone: { backgroundColor: "transparent", borderColor: "transparent", opacity: 0.5 },
  stripeContainer: { flexDirection: "row", height: "60%", marginLeft: 8, gap: 2 },
  todoAccent: { width: 4, height: "100%", borderRadius: 2 },
  todoContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  todoMainRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  todoTitle: { fontSize: 15, fontWeight: "600", color: "#1C1C1E", flex: 1, marginRight: 8 },
  todoTitleDone: { color: "#8E8E93", textDecorationLine: "line-through" },
  miniTagBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5 },
  miniTagText: { fontSize: 8, fontWeight: "bold" },
  todoSubRow: { flexDirection: "row", alignItems: "center", marginTop: 4, flexWrap: "wrap", gap: 6 },
  todoTimeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  todoTimeText: { fontSize: 10, color: "#8E8E93", fontWeight: "500" },
  checkButton: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: "center", alignItems: "center" },
  deadlineBadgeUrgent: { flexDirection: "row", alignItems: "center", backgroundColor: "#FF3B30", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, shadowColor: "#FF3B30", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  deadlineBadgeTextUrgent: { color: "#FFF", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  deadlineBadgeSafe: { flexDirection: "row", alignItems: "center", backgroundColor: "#E5F9E7", borderWidth: 1, borderColor: "#34C759", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  deadlineBadgeTextSafe: { color: "#34C759", fontSize: 9, fontWeight: "700" },
  subTaskListContainer: { marginLeft: 20, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: "#E5E5EA", marginTop: 6, gap: 6 },
  subTaskMiniCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F8FA", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  subTaskMiniTitle: { fontSize: 13, fontWeight: "600", color: "#333", flex: 1 },
});