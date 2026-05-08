import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SubTask } from "../../../../types"; // 🌟 パスはご自身の環境に合わせて調整してください
import { ModernDatePicker } from "./ModernDatePicker";
import { styles } from "./ScheduleModal.styles";

interface SubTaskSectionProps {
  showSubTasks: boolean;
  setShowSubTasks: (val: boolean) => void;
  subTasks: SubTask[];
  setSubTasks: (val: SubTask[]) => void;
  uiThemeColor: string;
  selectedDate: string;
  currentQuickTags: string[];
  updateForm: (updates: any) => void;
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
    return (
      <View>
        <TouchableOpacity
          style={[styles.subTaskToggleBtn, { borderColor: uiThemeColor }]}
          onPress={() => setShowSubTasks(!showSubTasks)}
        >
          <Ionicons
            name={showSubTasks ? "chevron-up" : "list-outline"}
            size={18}
            color={uiThemeColor}
          />
          <Text
            style={{ color: uiThemeColor, fontWeight: "bold", marginLeft: 8 }}
          >
            {showSubTasks ? "詳細入力を閉じる" : "詳細を追加"}
          </Text>
        </TouchableOpacity>

        {showSubTasks && (
          <View style={styles.expandingInput}>
            {subTasks.map((task, idx) => (
              <View
                key={task.id}
                style={[
                  styles.subTaskCard,
                  {
                    borderLeftColor: task.isExpense
                      ? "#FF9500"
                      : task.isIncome
                        ? "#34C759"
                        : uiThemeColor,
                  },
                  { paddingVertical: 12 },
                ]}
              >
                {task.isExpense ? (
                  // =======================================================
                  // 💰 【金額・内訳モード】
                  // =======================================================
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "bold",
                          color: "#8E8E93",
                        }}
                      >
                        カテゴリを選択
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setSubTasks(subTasks.filter((t) => t.id !== task.id))
                        }
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 15 }}
                    >
                      {currentQuickTags.map((cat) => {
                        const isSelected = task.category === cat;
                        return (
                          <TouchableOpacity
                            key={cat}
                            onPress={() => {
                              const n = [...subTasks];
                              n[idx].category = cat;
                              n[idx].title = cat;
                              setSubTasks(n);
                            }}
                            style={[
                              styles.miniReminderChip,
                              {
                                marginRight: 8,
                                borderRadius: 16,
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                              },
                              isSelected && {
                                backgroundColor: "#FF9500",
                                borderColor: "#FF9500",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "bold",
                                color: isSelected ? "#FFF" : "#8E8E93",
                              }}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#F2F2F7",
                        padding: 12,
                        borderRadius: 14,
                      }}
                    >
                      <Ionicons
                        name="wallet-outline"
                        size={16}
                        color="#FF9500"
                        style={{ marginRight: 8 }}
                      />
                      <TextInput
                        style={{
                          flex: 1,
                          fontSize: 18,
                          fontWeight: "bold",
                          textAlign: "right",
                          color: "#1C1C1E",
                        }}
                        keyboardType="numeric"
                        placeholder="0"
                        value={task.amount ? task.amount.toString() : ""}
                        onChangeText={(t) => {
                          const n = [...subTasks];
                          n[idx].amount = parseInt(t) || 0;
                          setSubTasks(n);
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "bold",
                          color: "#1C1C1E",
                          marginLeft: 6,
                        }}
                      >
                        円
                      </Text>
                    </View>
                  </View>
                ) : (
                  // =======================================================
                  // ✅ 【タスクモード】
                  // =======================================================
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          const n = [...subTasks];
                          n[idx].isDone = !n[idx].isDone;
                          setSubTasks(n);
                        }}
                        style={{ marginRight: 10 }}
                      >
                        <Ionicons
                          name={task.isDone ? "checkbox" : "square-outline"}
                          size={24}
                          color={task.isDone ? "#8E8E93" : uiThemeColor}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={[
                          styles.subTaskInput,
                          {
                            flex: 1,
                            fontSize: 16,
                            minHeight: 32,
                            paddingVertical: 4,
                          },
                          task.isDone && {
                            textDecorationLine: "line-through",
                            color: "#8E8E93",
                          },
                        ]}
                        placeholder="タスクを入力..."
                        placeholderTextColor="#BBB"
                        value={task.title}
                        onChangeText={(t) => {
                          const n = [...subTasks];
                          n[idx].title = t;
                          setSubTasks(n);
                        }}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setSubTasks(subTasks.filter((t) => t.id !== task.id))
                        }
                        style={{ marginLeft: 8 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: task.isIncome
                            ? "#34C75915"
                            : "#F2F2F7",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                        }}
                      >
                        <Ionicons
                          name="trending-up"
                          size={14}
                          color={task.isIncome ? "#34C759" : "#8E8E93"}
                        />
                        <Switch
                          value={task.isIncome || false}
                          onValueChange={(v) => {
                            const n = [...subTasks];
                            n[idx].isIncome = v;
                            if (v) n[idx].isExpense = false;
                            setSubTasks(n);
                          }}
                          style={{ transform: [{ scale: 0.6 }], marginLeft: 2 }}
                          trackColor={{ false: "#C7C7CC", true: "#34C759" }}
                        />
                        {task.isIncome && (
                          <TextInput
                            style={{
                              width: 60,
                              textAlign: "right",
                              fontSize: 12,
                              fontWeight: "bold",
                              marginLeft: 4,
                            }}
                            keyboardType="numeric"
                            placeholder="￥金額"
                            value={task.amount ? task.amount.toString() : ""}
                            onChangeText={(t) => {
                              const n = [...subTasks];
                              n[idx].amount = parseInt(t) || 0;
                              setSubTasks(n);
                            }}
                          />
                        )}
                      </View>

                      {!task.hasDateTime ? (
                        <TouchableOpacity
                          style={[styles.microChip, { paddingVertical: 6 }]}
                          onPress={() => {
                            const n = [...subTasks];
                            n[idx].hasDateTime = true;
                            n[idx].deadlineDate = new Date(selectedDate);
                            n[idx].endTime = new Date();
                            setSubTasks(n);
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#8E8E93",
                              fontWeight: "bold",
                            }}
                          >
                            + ⏱️ 締切を設定
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <ModernDatePicker
                            value={task.deadlineDate || new Date(selectedDate)}
                            mode="date"
                            onChange={(d: Date) => {
                              const n = [...subTasks];
                              n[idx].deadlineDate = d;
                              setSubTasks(n);
                            }}
                            themeColor={uiThemeColor}
                          />
                          <ModernDatePicker
                            value={task.endTime || new Date()}
                            mode="time"
                            onChange={(d: Date) => {
                              const n = [...subTasks];
                              n[idx].endTime = d;
                              setSubTasks(n);
                            }}
                            themeColor={uiThemeColor}
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const n = [...subTasks];
                              n[idx].hasDateTime = false;
                              setSubTasks(n);
                            }}
                          >
                            <Ionicons name="close" size={16} color="#8E8E93" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[
                  styles.addSubTaskBtn,
                  {
                    flex: 1,
                    backgroundColor: uiThemeColor + "15",
                    borderRadius: 12,
                    paddingVertical: 12,
                    justifyContent: "center",
                  },
                ]}
                onPress={() => {
                  updateForm({ isTodo: true });
                  setSubTasks([
                    ...subTasks,
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
                }}
              >
                <Ionicons name="add-circle" size={18} color={uiThemeColor} />
                <Text
                  style={{
                    color: uiThemeColor,
                    fontWeight: "bold",
                    marginLeft: 6,
                  }}
                >
                  サブタスク
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addSubTaskBtn,
                  {
                    flex: 1,
                    backgroundColor: "#FF950015",
                    borderRadius: 12,
                    paddingVertical: 12,
                    justifyContent: "center",
                  },
                ]}
                onPress={() => {
                  updateForm({ isExpense: true });
                  setSubTasks([
                    ...subTasks,
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
                }}
              >
                <Ionicons name="wallet" size={18} color="#FF9500" />
                <Text
                  style={{
                    color: "#FF9500",
                    fontWeight: "bold",
                    marginLeft: 6,
                  }}
                >
                  追加出費
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  },
);
