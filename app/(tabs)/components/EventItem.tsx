import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LayerMaster, ScheduleItem, TagMaster } from "../../../types";

interface EventItemProps {
  item: ScheduleItem; // 🌟 any を撃退！
  activeTags: string[];
  tagMaster: TagMaster; // 🌟
  layerMaster: LayerMaster; // 🌟
  formatEventTime: (item: ScheduleItem) => string; // 🌟
  openEditModal: (item: ScheduleItem) => void; // 🌟
  onLongPress: (item: ScheduleItem) => void; // 🌟
}

export default function EventItem({
  item,
  activeTags,
  tagMaster,
  layerMaster,
  formatEventTime,
  openEditModal,
  onLongPress,
}: EventItemProps) {
  const itemTags =
    item.tags && item.tags.length > 0 ? item.tags : item.tag ? [item.tag] : [];

  const displayColors = itemTags.map((tag: string) => {
    const info = tagMaster[tag] || {
      layer: tag,
      color: layerMaster[tag] || "#999",
    };
    // フィルター（activeTags）が設定されていなければ元の色を、
    // 設定されていればその色を使用するロジック
    return activeTags.length === 0
      ? layerMaster[info.layer] || "#999"
      : info.color;
  });

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
      onLongPress={() => onLongPress(item)}
      delayLongPress={300}
    >
      <View style={styles.tagContainer}>
        {itemTags.map((tag: string, idx: number) => (
          <View
            key={idx}
            style={[styles.tagBadge, { backgroundColor: displayColors[idx] }]}
          >
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={styles.itemMain}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.timeTextSmall}>{formatEventTime(item)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  tagContainer: {
    flexDirection: "row",
    gap: 4,
    marginRight: 8,
    flexWrap: "wrap",
    width: "25%",
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  tagText: { color: "#fff", fontSize: 9, fontWeight: "bold" },
  itemMain: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: { flex: 1, fontSize: 15, color: "#333", fontWeight: "bold" },
  timeTextSmall: {
    fontSize: 10,
    color: "#8E8E93",
    fontWeight: "bold",
    marginLeft: 6,
  },
});
