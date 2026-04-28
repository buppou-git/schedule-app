import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { ScheduleItem } from "../../../types";

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  scheduleData: { [date: string]: ScheduleItem[] };
  themeColor: string;
  layerMaster: { [key: string]: string };
  tagMaster: any;
  onItemPress: (item: ScheduleItem, date: string) => void;
}

export default function SearchModal({
  visible,
  onClose,
  scheduleData,
  themeColor,
  layerMaster,
  tagMaster,
  onItemPress,
}: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const toHiragana = (str: string) => {
    return str.replace(/[\u30a1-\u30f6]/g, (match) =>
      String.fromCharCode(match.charCodeAt(0) - 0x60),
    );
  };

  const toggleFilter = (filter: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((f) => f !== filter)
        : [...prev, filter],
    );
  };

  // 🌟 検索＆絞り込みロジック
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() && selectedFilters.length === 0) return [];

    const normalizedQuery = toHiragana(searchQuery.toLowerCase());
    const results: (ScheduleItem & { date: string })[] = [];

    Object.entries(scheduleData).forEach(([date, items]) => {
      items.forEach((item) => {
        // 1. 絞り込みの判定
        if (selectedFilters.length > 0) {
          const itemTags =
            item.tags && item.tags.length > 0
              ? item.tags
              : item.tag
                ? [item.tag]
                : [];
          const isMoney = !!item.subTasks?.some(
            (sub) => sub.isExpense || sub.isIncome,
          );

          const matchFilter = selectedFilters.some((filter) => {
            if (filter === "money") return isMoney;
            if (filter === "todo") return item.isTodo; // 🌟 追加：TODOの判定
            if (filter === "event") return item.isEvent; // 🌟 追加：予定の判定
            return itemTags.some(
              (tag) => tag === filter || tagMaster[tag]?.layer === filter,
            );
          });
          if (!matchFilter) return;
        }

        // 2. 文字検索の判定
        if (searchQuery.trim()) {
          const normalizedTitle = item.title
            ? toHiragana(item.title.toLowerCase())
            : "";
          const matchTitle = normalizedTitle.includes(normalizedQuery);
          const matchSubTask = item.subTasks?.some((sub) =>
            toHiragana(sub.title?.toLowerCase() || "").includes(
              normalizedQuery,
            ),
          );
          if (!matchTitle && !matchSubTask) return;
        }

        results.push({ ...item, date });
      });
    });

    return results.sort((a, b) => b.date.localeCompare(a.date));
  }, [searchQuery, scheduleData, selectedFilters, tagMaster]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text
              style={{ color: themeColor, fontSize: 16, fontWeight: "600" }}
            >
              閉じる
            </Text>
          </TouchableOpacity>
          <Text style={styles.title}>検索</Text>
          <View style={{ width: 50 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.searchBarRow}>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={18} color="#8E8E93" />
              <TextInput
                style={styles.searchInput}
                placeholder="キーワードで検索..."
                placeholderTextColor="#AEAEB2"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.filterToggleBtn,
                selectedFilters.length > 0 && { backgroundColor: themeColor },
              ]}
              onPress={() => setIsFilterSheetVisible(true)}
            >
              <Ionicons
                name="options-outline"
                size={22}
                color={selectedFilters.length > 0 ? "#FFF" : "#1C1C1E"}
              />
              {selectedFilters.length > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {selectedFilters.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.resultList}
            keyboardShouldPersistTaps="handled"
          >
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.resultCard}
                onPress={() => {
                  onItemPress(item, item.date);
                  onClose();
                }}
              >
                <View style={styles.resultDateRow}>
                  <Text style={styles.resultDateText}>{item.date}</Text>
                </View>
                <Text style={styles.resultTitleText}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* 🌟 絞り込み専用のサブモーダル */}
        <Modal visible={isFilterSheetVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.sheetOverlay}
            activeOpacity={1}
            onPress={() => setIsFilterSheetVisible(false)}
          >
            <View style={styles.sheetContent}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>絞り込み</Text>
                <TouchableOpacity onPress={() => setSelectedFilters([])}>
                  <Text
                    style={{
                      color: "#FF3B30",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    リセット
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.chipGrid}>
                {/* 🌟 追加：予定フィルター */}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    selectedFilters.includes("event") && {
                      backgroundColor: "#007AFF",
                      borderColor: "#007AFF",
                    },
                  ]}
                  onPress={() => toggleFilter("event")}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedFilters.includes("event") && { color: "#FFF" },
                    ]}
                  >
                    📅 予定
                  </Text>
                </TouchableOpacity>

                {/* 🌟 追加：TODOフィルター */}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    selectedFilters.includes("todo") && {
                      backgroundColor: "#FF9500",
                      borderColor: "#FF9500",
                    },
                  ]}
                  onPress={() => toggleFilter("todo")}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedFilters.includes("todo") && { color: "#FFF" },
                    ]}
                  >
                    ✅ TODO
                  </Text>
                </TouchableOpacity>

                {/* 家計簿フィルター */}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    selectedFilters.includes("money") && {
                      backgroundColor: "#34C759",
                      borderColor: "#34C759",
                    },
                  ]}
                  onPress={() => toggleFilter("money")}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedFilters.includes("money") && { color: "#FFF" },
                    ]}
                  >
                    💰 家計簿
                  </Text>
                </TouchableOpacity>

                {/* レイヤーフィルター */}
                {Object.keys(layerMaster).map((layer) => (
                  <TouchableOpacity
                    key={layer}
                    style={[
                      styles.chip,
                      selectedFilters.includes(layer) && {
                        backgroundColor: layerMaster[layer],
                        borderColor: layerMaster[layer],
                      },
                    ]}
                    onPress={() => toggleFilter(layer)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedFilters.includes(layer) && { color: "#FFF" },
                      ]}
                    >
                      {layer}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: themeColor }]}
                onPress={() => setIsFilterSheetVisible(false)}
              >
                <Text style={styles.applyBtnText}>適用する</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },
  closeBtn: { width: 50 },
  searchBarRow: {
    flexDirection: "row",
    padding: 15,
    gap: 10,
    alignItems: "center",
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  searchInput: { flex: 1, fontSize: 16, color: "#1C1C1E", marginLeft: 8 },
  filterToggleBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#FFF",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
  resultList: { flex: 1, paddingHorizontal: 15 },
  resultCard: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  resultDateRow: { marginBottom: 4 },
  resultDateText: { fontSize: 12, color: "#8E8E93", fontWeight: "600" },
  resultTitleText: { fontSize: 16, fontWeight: "700", color: "#1C1C1E" },

  // 🌟 シートのスタイル
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: "bold" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#F8F8FA",
  },
  chipText: { fontSize: 14, fontWeight: "600", color: "#8E8E93" },
  applyBtn: {
    marginTop: 30,
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: "center",
  },
  applyBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
