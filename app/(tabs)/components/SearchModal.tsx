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
  onItemPress: (item: ScheduleItem, date: string) => void;
}

export default function SearchModal({
  visible,
  onClose,
  scheduleData,
  themeColor,
  onItemPress,
}: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // 🌟 検索ロジック（文字が入力されるたびに高速で絞り込む）
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: (ScheduleItem & { date: string })[] = [];

    Object.entries(scheduleData).forEach(([date, items]) => {
      items.forEach((item) => {
        // タイトルかメモに検索文字が含まれていたらヒット！
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchSubTask = item.subTasks?.some((sub) =>
          sub.title?.toLowerCase().includes(query),
        );

        if (matchTitle || matchSubTask) {
          results.push({ ...item, date });
        }
      });
    });

    // 日付が新しい順に並び替え
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }, [searchQuery, scheduleData]);

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
          <View style={{ width: 50 }} /> {/* レイアウト調整用 */}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.searchBarContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#8E8E93"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="タスク、予定、メモを検索..."
              placeholderTextColor="#AEAEB2"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              clearButtonMode="always"
            />
          </View>

          <ScrollView
            style={styles.resultList}
            keyboardShouldPersistTaps="handled"
          >
            {searchQuery.trim().length > 0 && searchResults.length === 0 ? (
              <Text style={styles.emptyText}>見つかりませんでした</Text>
            ) : (
              searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.resultCard}
                  onPress={() => {
                    onItemPress(item, item.date);
                    onClose(); // 🌟 タップしたら検索画面を閉じて詳細を開く
                  }}
                >
                  <View style={styles.resultDateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color="#8E8E93"
                    />
                    <Text style={styles.resultDateText}>{item.date}</Text>
                  </View>
                  <Text style={styles.resultTitleText} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    margin: 15,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: "#1C1C1E" },
  resultList: { flex: 1, paddingHorizontal: 15 },
  emptyText: {
    textAlign: "center",
    color: "#8E8E93",
    marginTop: 40,
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  resultDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  resultDateText: { fontSize: 12, color: "#8E8E93", fontWeight: "600" },
  resultTitleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  resultMemoText: { fontSize: 12, color: "#8E8E93", lineHeight: 16 },
});
