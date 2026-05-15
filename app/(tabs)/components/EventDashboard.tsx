import React from "react";
import { FlatList, StyleSheet, Text } from "react-native";
// 🌟 パスは環境に合わせて調整してください
import { ScheduleItem } from "../../../types";
import EventItem from "./EventItem";

interface EventDashboardProps {
  dayEvents: ScheduleItem[];
  selectedDate: string;
  currentSolidColor: string;
  activeTags: string[];
  tagMaster: Record<string, { layer: string; color: string }>;
  layerMaster: Record<string, string>;
  formatEventTime: (item: ScheduleItem) => string;
  openEditModal: (item: ScheduleItem) => void;
  onLongPress: (item: ScheduleItem) => void;
}

export const EventDashboard = React.memo(({
  dayEvents,
  selectedDate,
  currentSolidColor,
  activeTags,
  tagMaster,
  layerMaster,
  formatEventTime,
  openEditModal,
  onLongPress,
}: EventDashboardProps) => {
  const [y, m, d] = selectedDate.split("-");

  // 🌟 ヘッダー部分（「〇月〇日の予定」）
  const renderHeader = () => (
    <Text style={[localStyles.mainDateTitle, { color: currentSolidColor, marginBottom: 15 }]}>
      {parseInt(m)}月{parseInt(d)}日 の予定
    </Text>
  );

  // 🌟 予定がゼロの時の表示
  const renderEmpty = () => (
    <Text style={localStyles.emptyText}>予定はありません</Text>
  );

  // 🌟 FlatList で画面に見える分だけ爆速レンダリング！
  return (
    <FlatList
      data={dayEvents}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      renderItem={({ item }) => (
        <EventItem
          item={item}
          activeTags={activeTags}
          tagMaster={tagMaster}
          layerMaster={layerMaster}
          formatEventTime={formatEventTime}
          openEditModal={openEditModal}
          onLongPress={onLongPress}
        />
      )}
      contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 10 }}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    />
  );
});

// スタイル
const localStyles = StyleSheet.create({
  mainDateTitle: { fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  emptyText: {
    textAlign: "center",
    color: "#8E8E93",
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 40,
  },
});