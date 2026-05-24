import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { styles } from "./ScheduleModal.styles";

type RepeatType = "none" | "daily" | "weekly" | "monthly" | "custom";

interface RepeatSectionProps {
  repeatType: RepeatType;
  repeatDays: number[];
  repeatInterval: number;
  repeatEndDate: Date | null;
  uiThemeColor: string;
  onPress: () => void;
}

const repeatTypeLabelMap: Record<RepeatType, string> = {
  none: "なし",
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
  custom: "カスタム",
};

const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
};

const getRepeatSummary = (
  repeatType: RepeatType,
  repeatDays: number[],
  repeatInterval: number,
  repeatEndDate: Date | null,
) => {
  if (repeatType === "none") return "なし";

  const endText = repeatEndDate ? ` / ${formatDate(repeatEndDate)}まで` : "";

  if (repeatType !== "custom") {
    return `${repeatTypeLabelMap[repeatType]}${endText}`;
  }

  const days =
    repeatDays.length > 0
      ? repeatDays.map((d) => dayLabels[d]).join("・")
      : "曜日未選択";

  return `${repeatInterval}週間ごと / ${days}${endText}`;
};

export const RepeatSection = React.memo(
  ({
    repeatType,
    repeatDays,
    repeatInterval,
    repeatEndDate,
    uiThemeColor,
    onPress,
  }: RepeatSectionProps) => {
    return (
      <View>
        <Text style={styles.label}>繰り返し</Text>

        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.75}
          style={{
            backgroundColor: "#FFF",
            borderWidth: 1,
            borderColor: "#E5E5EA",
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "bold",
                color: "#1C1C1E",
              }}
            >
              {getRepeatSummary(
                repeatType,
                repeatDays,
                repeatInterval,
                repeatEndDate,
              )}
            </Text>

            <Text
              style={{
                fontSize: 12,
                color: "#8E8E93",
                marginTop: 3,
              }}
            >
              タップして変更
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color={uiThemeColor} />
        </TouchableOpacity>
      </View>
    );
  },
);