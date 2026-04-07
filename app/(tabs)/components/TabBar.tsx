import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface TabBarProps {
  activeMode: string;
  setActiveMode: (mode: string) => void;
}

export default function TabBar({ activeMode, setActiveMode }: TabBarProps) {
  return (
    <View style={styles.tabContainer}>
      {/* カレンダータブ */}
      <TouchableOpacity
        style={[styles.tabButton, activeMode === "calendar" && styles.activeTab]}
        onPress={() => setActiveMode("calendar")}
      >
        <Text style={[styles.tabText, activeMode === "calendar" && styles.activeTabText]}>
          📅 カレンダー
        </Text>
      </TouchableOpacity>

      {/* ToDoタブ */}
      <TouchableOpacity
        style={[styles.tabButton, activeMode === "todo" && styles.activeTab]}
        onPress={() => setActiveMode("todo")}
      >
        <Text style={[styles.tabText, activeMode === "todo" && styles.activeTabText]}>
          ✅ ToDo
        </Text>
      </TouchableOpacity>

      {/* 家計簿タブ */}
      <TouchableOpacity
        style={[styles.tabButton, activeMode === "money" && styles.activeTab]}
        onPress={() => setActiveMode("money")}
      >
        <Text style={[styles.tabText, activeMode === "money" && styles.activeTabText]}>
          💰 家計簿
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// デザイン
const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#007AFF",
  },
  tabText: {
    fontSize: 14,
    color: "#666666",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#007AFF",
    fontWeight: "bold",
  },
});