import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScheduleFormData } from "../../../../types"; // 🌟 追加
import { styles } from "./ScheduleModal.styles";

interface RepeatSectionProps {
  repeatType: "none" | "daily" | "weekly" | "monthly" | "custom";
  repeatDays: number[];
  repeatInterval: number;
  uiThemeColor: string;
  updateForm: (updates: Partial<ScheduleFormData>) => void; // 🌟 anyを修正
}

export const RepeatSection = React.memo(
  ({
    repeatType,
    repeatDays,
    repeatInterval,
    uiThemeColor,
    updateForm,
  }: RepeatSectionProps) => {
    return (
      <View>
        <Text style={styles.label}>繰り返し</Text>
        <View style={styles.layerContainer}>
          {[
            { label: "なし", value: "none" },
            { label: "毎日", value: "daily" },
            { label: "毎週", value: "weekly" },
            { label: "毎月", value: "monthly" },
            { label: "カスタム", value: "custom" },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.layerChip,
                repeatType === opt.value && { backgroundColor: uiThemeColor },
              ]}
              onPress={() => updateForm({ repeatType: opt.value as RepeatSectionProps["repeatType"] })}
            >
              <Text
                style={[
                  styles.layerChipText,
                  repeatType === opt.value && { color: "#fff" },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {repeatType === "custom" && (
          <View style={styles.customRepeatArea}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={styles.miniLabel}>曜日の選択</Text>
              <TouchableOpacity
                onPress={() => updateForm({ repeatDays: [1, 2, 3, 4, 5] })}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: uiThemeColor,
                    fontWeight: "bold",
                  }}
                >
                  平日のみ選択
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.daySelectorRow}>
              {["日", "月", "火", "水", "木", "金", "土"].map((day, idx) => {
                const isSelected = repeatDays.includes(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayCircle,
                      isSelected && {
                        backgroundColor: uiThemeColor,
                        borderColor: uiThemeColor,
                      },
                    ]}
                    onPress={() => {
                      const prev = repeatDays;
                      const next = prev.includes(idx)
                        ? prev.filter((d) => d !== idx)
                        : [...prev, idx];
                      updateForm({ repeatDays: next });
                    }}
                  >
                    <Text
                      style={[styles.dayText, isSelected && { color: "#FFF" }]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.intervalRow}>
              <Text style={styles.miniLabel}>繰り返しの間隔:</Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <TextInput
                  style={styles.intervalInput}
                  keyboardType="numeric"
                  value={repeatInterval.toString()}
                  onChangeText={(t) =>
                    updateForm({ repeatInterval: parseInt(t) || 1 })
                  }
                />
                <Text
                  style={{ fontSize: 14, fontWeight: "bold", color: "#1C1C1E" }}
                >
                  週間ごと
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  },
);
