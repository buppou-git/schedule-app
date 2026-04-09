import { Ionicons } from "@expo/vector-icons"; // アイコン
import * as Haptics from "expo-haptics"; // 振動
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// 親（Index.tsx）から受け取るデータのルール
interface TabBarProps {
    activeMode: string;
    setActiveMode: (mode: string) => void;
  }
  
  export default function TabBar({ activeMode, setActiveMode }: TabBarProps) {
    
    // タブが押された時の処理
    const handlePress = (mode: string) => {
      if (activeMode !== mode) {
        // タブが切り替わる時だけ「コッ」と心地よく振動させる
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveMode(mode);
      }
    };
  
    return (
      <View style={styles.tabContainer}>
        {/* 📅 カレンダー タブ */}
        <TouchableOpacity
          style={[styles.tabButton, activeMode === "calendar" && styles.activeTabButton]}
          onPress={() => handlePress("calendar")}
        >
          <Ionicons
            name={activeMode === "calendar" ? "calendar" : "calendar-outline"}
            size={22}
            color={activeMode === "calendar" ? "#007AFF" : "#8E8E93"}
          />
          <Text style={[styles.tabText, activeMode === "calendar" && styles.activeTabText]}>
            予定
          </Text>
        </TouchableOpacity>
  
        {/* ✅ ToDo タブ */}
        <TouchableOpacity
          style={[styles.tabButton, activeMode === "todo" && styles.activeTabButton]}
          onPress={() => handlePress("todo")}
        >
          <Ionicons
            name={activeMode === "todo" ? "checkmark-circle" : "checkmark-circle-outline"}
            size={22}
            color={activeMode === "todo" ? "#007AFF" : "#8E8E93"}
          />
          <Text style={[styles.tabText, activeMode === "todo" && styles.activeTabText]}>
            タスク
          </Text>
        </TouchableOpacity>
  
        {/* 💰 家計簿 タブ */}
        <TouchableOpacity
          style={[styles.tabButton, activeMode === "money" && styles.activeTabButton]}
          onPress={() => handlePress("money")}
        >
          <Ionicons
            name={activeMode === "money" ? "wallet" : "wallet-outline"}
            size={22}
            color={activeMode === "money" ? "#007AFF" : "#8E8E93"}
          />
          <Text style={[styles.tabText, activeMode === "money" && styles.activeTabText]}>
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