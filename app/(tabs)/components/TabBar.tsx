import { Ionicons } from "@expo/vector-icons"; // アイコン
import * as Haptics from "expo-haptics"; // 振動
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppStore } from "../../../store/useAppStore";

interface TabBarProps {
  themeColor: string;
}

export default function TabBar({ themeColor }: TabBarProps) {
  // ✅ 倉庫から直接取り出す！（親に頼らない）
  const { activeMode, setActiveMode } = useAppStore();

  const handlePress = (mode: string) => {
    if (activeMode !== mode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveMode(mode);
    }
  };

  return (
    <View style={[styles.tabContainer, { backgroundColor: "transparent" }]}>
      {/* 📅 カレンダー タブ */}
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeMode === "calendar" && { backgroundColor: themeColor + "1A" },
        ]}
        onPress={() => handlePress("calendar")}
      >
        <Ionicons
          name={activeMode === "calendar" ? "calendar" : "calendar-outline"}
          size={22}
          color={activeMode === "calendar" ? themeColor : "#8E8E93"}
        />
        <Text
          style={[
            styles.tabText,
            activeMode === "calendar" && {
              color: themeColor,
              fontWeight: "bold",
            },
          ]}
        >
          予定
        </Text>
      </TouchableOpacity>

      {/* ✅ ToDo タブ */}
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeMode === "todo" && { backgroundColor: themeColor + "1A" },
        ]}
        onPress={() => handlePress("todo")}
      >
        <Ionicons
          name={
            activeMode === "todo"
              ? "checkmark-circle"
              : "checkmark-circle-outline"
          }
          size={22}
          color={activeMode === "todo" ? themeColor : "#8E8E93"}
        />
        <Text
          style={[
            styles.tabText,
            activeMode === "todo" && { color: themeColor, fontWeight: "bold" },
          ]}
        >
          タスク
        </Text>
      </TouchableOpacity>

      {/* 💰 家計簿 タブ */}
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeMode === "money" && { backgroundColor: themeColor + "1A" },
        ]}
        onPress={() => handlePress("money")}
      >
        <Ionicons
          name={activeMode === "money" ? "wallet" : "wallet-outline"}
          size={22}
          color={activeMode === "money" ? themeColor : "#8E8E93"}
        />
        <Text
          style={[
            styles.tabText,
            activeMode === "money" && { color: themeColor, fontWeight: "bold" },
          ]}
        >
          家計簿
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA", // 背景になじませる
    paddingHorizontal: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA", // 下にうっすらと線を引いて区切る
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: "#E3F2FD", // 選ばれているタブだけ、うっすら青い背景にする
  },
  tabText: {
    fontSize: 11,
    marginTop: 4,
    color: "#8E8E93",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#007AFF",
    fontWeight: "bold",
  },
});
