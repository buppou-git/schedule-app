import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Switch, Text, View } from "react-native";
import { ScheduleFormData } from "../../../../types"; // 🌟 追加
import { ModernDatePicker, formatTime } from "./ModernDatePicker";
import { styles } from "./ScheduleModal.styles";

interface TimeSectionProps {
  isAllDay: boolean;
  startDate: Date;
  startTime: Date;
  endDate: Date;
  endTime: Date;
  uiThemeColor: string;
  updateForm: (updates: Partial<ScheduleFormData>) => void; // 🌟 anyを修正
}

export const TimeSection = React.memo(
  ({
    isAllDay,
    startDate,
    startTime,
    endDate,
    endTime,
    uiThemeColor,
    updateForm,
  }: TimeSectionProps) => {
    return (
      <View style={styles.timeSection}>
        <View style={styles.timePreviewRow}>
          <Ionicons name="time" size={14} color={uiThemeColor} />
          <Text style={[styles.timePreviewText, { color: uiThemeColor }]}>
            {isAllDay
              ? "終日"
              : `${formatTime(startTime)} 〜 ${formatTime(endTime)}`}
          </Text>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>終日</Text>
          <Switch
            value={isAllDay}
            onValueChange={(v) => updateForm({ isAllDay: v })}
            trackColor={{ false: "#C7C7CC", true: uiThemeColor }}
            ios_backgroundColor="#E5E5EA"
          />
        </View>
        <View style={styles.timePickerContainer}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>開始</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <ModernDatePicker
                value={startDate}
                mode="date"
                onChange={(d: Date) => updateForm({ startDate: d })}
                themeColor={uiThemeColor}
                icon="calendar-outline"
              />
              {!isAllDay && (
                <ModernDatePicker
                  value={startTime}
                  mode="time"
                  onChange={(d: Date) => updateForm({ startTime: d })}
                  themeColor={uiThemeColor}
                  icon="time-outline"
                />
              )}
            </View>
          </View>
          <View style={[styles.timeRow, { marginTop: 16 }]}>
            <Text style={styles.timeLabel}>終了</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <ModernDatePicker
                value={endDate}
                mode="date"
                onChange={(d: Date) => updateForm({ endDate: d })}
                themeColor={uiThemeColor}
                icon="calendar-outline"
              />
              {!isAllDay && (
                <ModernDatePicker
                  value={endTime}
                  mode="time"
                  onChange={(d: Date) => updateForm({ endTime: d })}
                  themeColor={uiThemeColor}
                  icon="time-outline"
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  },
);
