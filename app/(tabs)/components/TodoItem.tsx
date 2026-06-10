import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics"; // 🌟 Hapticsを追加（ボタンの振動用）
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppStore } from "../../../store/useAppStore";
import { ScheduleItem, SubTask } from "../../../types";

import { resolveTags } from "../../../utils/tagUtils";

interface TodoItemProps {
  item: ScheduleItem;
  itemDate: string;
  selectedDate: string;
  activeTags: string[];
  formatEventTime: (item: ScheduleItem) => string;
  openEditModal: (item: ScheduleItem) => void;
  toggleTodo: (date: string, id: string) => void;
  toggleSubTodo: (date: string, parentId: string, subTaskId: number) => void;
  setEditingSubTaskInfo: (info: {
    parentId: string;
    parentTitle: string;
    date: string;
    subTask: SubTask;
  }) => void;
  setSubTaskModalVisible: (visible: boolean) => void;
  onLongPress: (item: ScheduleItem) => void;
  streakCount: number;
}

const TodoItem = memo(function TodoItem({
  item,
  itemDate,
  selectedDate,
  activeTags,
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

  // =========================================================
  // 🌟 追加：楽観的UI (Optimistic UI) の魔法
  // 親の処理を待たずに、見た目だけを「0秒」で切り替えるためのローカルステート
  // =========================================================
  const [optItem, setOptItem] = useState(item);

  // 🌟 2. 追加：親からの古いデータをブロックするバリア
  const isUpdating = useRef(false);

  // クラウド同期などで親の最新データが降ってきたら、それに合わせる
  useEffect(() => {
    // 🌟 3. 変更：バリアが張られていない時だけ、親のデータを受け入れる
    if (!isUpdating.current) {
      setOptItem(item);
    }
  }, [item]);

  // 🌟 魔法の即時関数（親タスク用）
  const handleToggleTodo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    isUpdating.current = true; // 🌟 バリアを展開！（親からの古い先祖返りデータをシャットアウト）

    // 1. UIを爆速（0ミリ秒）で切り替える
    setOptItem((prev) => ({ ...prev, isDone: !prev.isDone }));

    // 2. アニメーションを最優先させ、50ms 待ってから裏でクラウド保存処理を走らせる
    setTimeout(() => {
      toggleTodo(itemDate, item.id);

      // 🌟 クラウドの同期処理が完了して親のデータが最新になる頃合い（1秒後）にバリアを解除！
      setTimeout(() => {
        isUpdating.current = false;
      }, 1000);
    }, 50);
  };

  // 🌟 魔法の即時関数（サブタスク用）
  const handleToggleSubTodo = (subTaskId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    isUpdating.current = true; // 🌟 こちらもバリアを展開！

    // 1. サブタスクのUIを爆速で切り替える
    setOptItem((prev) => {
      if (!prev.subTasks) return prev;
      const newSubTasks = prev.subTasks.map((sub) =>
        sub.id === subTaskId ? { ...sub, isDone: !sub.isDone } : sub,
      );

      // お金以外のタスクが全て完了したか判定し、親のチェックも自動でつける
      const pureTodos = newSubTasks.filter((s) => !s.isExpense && !s.isIncome);
      const isAllDone =
        pureTodos.length > 0 ? pureTodos.every((s) => s.isDone) : prev.isDone;

      return { ...prev, subTasks: newSubTasks, isDone: isAllDone };
    });

    // 2. 50ms の猶予を持って裏で本物の保存処理を投げる
    setTimeout(() => {
      toggleSubTodo(itemDate, item.id, subTaskId);

      // 🌟 同じく1秒後に古いデータからの上書きを許可する状態に戻す
      setTimeout(() => {
        isUpdating.current = false;
      }, 1000);
    }, 50);
  };

  // 👇 以降の表示ロジックは、すべて `optItem` (見た目上の最新データ) をもとに描画します
  const { parent, sub } = resolveTags(optItem);
  const isSingleLayerMode = activeTags && activeTags.length === 1;
  const displayTag = isSingleLayerMode && sub ? sub : parent;
  const displayColor =
    tagMaster[displayTag]?.color || layerMaster[displayTag] || "#999";

  const isPeriodTask = optItem.endDate && optItem.startDate !== optItem.endDate;
  let daysLeft = null;
  let isFinalDay = false;

  if (isPeriodTask && optItem.endDate) {
    const targetD = new Date(selectedDate);
    const endD = new Date(optItem.endDate);
    const diffTime = endD.getTime() - targetD.getTime();
    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isFinalDay = daysLeft === 0;
  }
  const isShared = useMemo(
    () => !!optItem.sharedRoomId,
    [optItem.sharedRoomId],
  );

  return (
    <View style={{ marginBottom: 12 }}>
      {/* 親タスクのカード */}
      <TouchableOpacity
        style={[styles.todoCard, optItem.isDone && styles.todoCardDone]}
        onPress={() => openEditModal(optItem)}
        activeOpacity={0.7}
        onLongPress={() => onLongPress(optItem)}
        delayLongPress={300}
      >
        <View style={styles.stripeContainer}>
          <View
            style={[styles.todoAccent, { backgroundColor: displayColor }]}
          />
        </View>

        <View style={styles.todoContent}>
          <View style={styles.todoMainRow}>
            <Text
              style={[styles.todoTitle, optItem.isDone && styles.todoTitleDone]}
              numberOfLines={1}
            >
              {optItem.title}
            </Text>

            {isShared && (
              <View
                style={{
                  backgroundColor: "#E5E5EA",
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                  borderRadius: 4,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{ fontSize: 8, color: "#8E8E93", fontWeight: "bold" }}
                >
                  共有
                </Text>
              </View>
            )}

            {displayTag && (
              <View
                style={[
                  styles.miniTagBadge,
                  {
                    backgroundColor: displayColor + "15",
                    borderColor: displayColor,
                  },
                ]}
              >
                <Text style={[styles.miniTagText, { color: displayColor }]}>
                  {displayTag}
                </Text>
              </View>
            )}
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

            {isFinalDay && !optItem.isDone ? (
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
            ) : daysLeft !== null && daysLeft > 0 && !optItem.isDone ? (
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
              <Text style={styles.todoTimeText}>
                {formatEventTime(optItem)}
              </Text>
            </View>
          </View>
        </View>

        {!optItem.subTasks || optItem.subTasks.length === 0 ? (
          <TouchableOpacity
            style={styles.checkButton}
            onPress={handleToggleTodo} // 🌟 魔法の即時関数に変更！
          >
            <Ionicons
              name={optItem.isDone ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={optItem.isDone ? "#34C759" : "#C7C7CC"}
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.checkButton, { opacity: 0.5 }]}>
            <Ionicons
              name={
                optItem.isDone ? "checkmark-done-circle" : "list-circle-outline"
              }
              size={24}
              color={optItem.isDone ? "#34C759" : "#AEAEB2"}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* サブタスクの表示 */}
      {optItem.subTasks && optItem.subTasks.length > 0 && (
        <View>
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
              {optItem.subTasks.filter((s: SubTask) => s.isDone).length}/
              {optItem.subTasks.length})
            </Text>
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.subTaskListContainer}>
              {optItem.subTasks.map((sub: SubTask) => (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.subTaskMiniCard}
                  onPress={() => handleToggleSubTodo(sub.id)} // 🌟 魔法の即時関数に変更！
                >
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
                        {sub.endTime instanceof Date
                          ? `${("0" + sub.endTime.getHours()).slice(-2)}:${("0" + sub.endTime.getMinutes()).slice(-2)}`
                          : String(sub.endTime)}
                      </Text>
                    </View>
                  )}

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
                        parentId: optItem.id,
                        parentTitle: optItem.title,
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
