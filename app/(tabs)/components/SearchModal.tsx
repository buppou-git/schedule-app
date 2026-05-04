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
  tagMaster: { [key: string]: { layer: string; color: string } };
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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() && selectedFilters.length === 0) return [];

    const normalizedQuery = toHiragana(searchQuery.toLowerCase());
    const results: (ScheduleItem & { date: string })[] = [];

    Object.entries(scheduleData).forEach(([date, items]) => {
      items.forEach((item) => {
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
            if (filter === "todo") return item.isTodo;
            if (filter === "event") return item.isEvent;
            
            // 🌟 追加：外部予定をフィルターで拾えるようにする
            if (filter === "external") return !!item.externalEventId; 
            
            return itemTags.some(
              (tag) => tag === filter || tagMaster[tag]?.layer === filter,
            );
          });
          if (!matchFilter) return;
        }

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
      presentationStyle="pageSheet" // 🌟 変更：これで下にスワイプして閉じられるようになります
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* 🌟 追加：スワイプで閉じられることを示す「ハンドル（横線）」 */}
        <View style={styles.dragHandle} />

        <View style={styles.header}>
          {/* pageSheetにすると左上の「閉じる」ボタンが不要になるため、削除してスッキリさせます */}
          <View style={{ width: 50 }} />
          <Text style={styles.title}>検索</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={26} color="#E5E5EA" />
          </TouchableOpacity>
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
                autoFocus={true} // 🌟 開いた瞬間にキーボードを出す
              />
            </View>

            <TouchableOpacity
              style={[
                styles.filterToggleBtn,
                selectedFilters.length > 0 && {
                  backgroundColor: themeColor,
                  borderColor: themeColor,
                },
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
            keyboardDismissMode="on-drag" // 🌟 スクロールしたらキーボードを隠す
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
                  <Text style={styles.resultDateText}>
                    {item.date.replace(/-/g, "/")}
                  </Text>
                </View>
                {/* 🌟 変更：文字サイズを大きく */}
                <Text style={styles.resultTitleText}>{item.title}</Text>

                {/* 🌟 追加：予定のカテゴリなどを小さく表示するとより見やすくなります */}
                <View
                  style={{
                    flexDirection: "row",
                    marginTop: 6,
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {item.isEvent && (
                    <Ionicons name="calendar" size={12} color="#007AFF" />
                  )}
                  {item.isTodo && (
                    <Ionicons
                      name="checkbox-outline"
                      size={12}
                      color="#FF9500"
                    />
                  )}
                  <Text
                    style={{
                      fontSize: 11,
                      color: item.color || "#8E8E93",
                      fontWeight: "600",
                    }}
                  >
                    {item.tag || item.category || "予定"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* 検索結果が空の時の表示 */}
            {searchQuery.trim() !== "" && searchResults.length === 0 && (
              <Text
                style={{
                  textAlign: "center",
                  color: "#8E8E93",
                  marginTop: 40,
                  fontWeight: "600",
                }}
              >
                見つかりませんでした
              </Text>
            )}
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
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    リセット
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.chipGrid}>
                {/* 🌟 アイコン仕様に変更 */}
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
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={
                      selectedFilters.includes("event") ? "#FFF" : "#8E8E93"
                    }
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      selectedFilters.includes("event") && { color: "#FFF" },
                    ]}
                  >
                    予定
                  </Text>
                </TouchableOpacity>

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
                  <Ionicons
                    name="checkbox-outline"
                    size={16}
                    color={
                      selectedFilters.includes("todo") ? "#FFF" : "#8E8E93"
                    }
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      selectedFilters.includes("todo") && { color: "#FFF" },
                    ]}
                  >
                    TODO
                  </Text>
                </TouchableOpacity>

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
                  <Ionicons
                    name="wallet-outline"
                    size={16}
                    color={
                      selectedFilters.includes("money") ? "#FFF" : "#8E8E93"
                    }
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      selectedFilters.includes("money") && { color: "#FFF" },
                    ]}
                  >
                    家計簿
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
                    <Ionicons
                      name="layers-outline"
                      size={16}
                      color={
                        selectedFilters.includes(layer) ? "#FFF" : "#8E8E93"
                      }
                      style={{ marginRight: 4 }}
                    />
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

                {/* 🌟 追加：他のカテゴリと並列で「外部予定」も表示 */}
                <TouchableOpacity
                  style={[
                    styles.chip,
                    selectedFilters.includes("external") && {
                      backgroundColor: themeColor,
                      borderColor: themeColor,
                    },
                  ]}
                  onPress={() => toggleFilter("external")}
                >
                  <Ionicons
                    name="globe-outline" // 外部っぽさを表す地球儀アイコン
                    size={16}
                    color={
                      selectedFilters.includes("external") ? "#FFF" : "#8E8E93"
                    }
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      selectedFilters.includes("external") && { color: "#FFF" },
                    ]}
                  >
                    外部予定
                  </Text>
                </TouchableOpacity>
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
  dragHandle: {
    // 🌟 追加：引っ張るためのハンドル
    width: 40,
    height: 5,
    backgroundColor: "#C7C7CC",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#F2F2F7", // 🌟 変更：背景色と同化させてモダンに
  },
  title: { fontSize: 18, fontWeight: "800", color: "#1C1C1E" },
  closeBtn: { width: 50, alignItems: "flex-end" },
  searchBarRow: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingBottom: 15,
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
    height: 48, // 🌟 変更：少し高さを出して押しやすく
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  searchInput: { flex: 1, fontSize: 16, color: "#1C1C1E", marginLeft: 8 },
  filterToggleBtn: {
    width: 48, // 🌟 変更：高さを揃える
    height: 48,
    backgroundColor: "#FFF",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  filterBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "900" },
  resultList: { flex: 1, paddingHorizontal: 15 },
  resultCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  resultDateRow: { marginBottom: 6 },
  resultDateText: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "700",
    letterSpacing: 0.5,
  }, // 🌟 変更：大きく・太く
  resultTitleText: { fontSize: 18, fontWeight: "800", color: "#1C1C1E" }, // 🌟 変更：タイトルをかなり大きく強調

  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#1C1C1E" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row", // 🌟 追加：アイコンと文字を横並びに
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#F8F8FA",
  },
  chipText: { fontSize: 14, fontWeight: "700", color: "#8E8E93" },
  applyBtn: {
    marginTop: 30,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  applyBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
