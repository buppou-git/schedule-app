import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLOR_PALETTE = [
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#1C1C1E",
];

interface LayerManagementModalProps {
  visible: boolean;
  onClose: () => void;
  layerMaster: { [key: string]: string };
  setLayerMaster: (data: { [key: string]: string }) => void;
  setHasUnsavedChanges: (val: boolean) => void;
  sharedRooms: { [layerName: string]: string }; // ✅ 追加
  onDeleteSharedRoom: (layerName: string) => void; // ✅ 追加
  scheduleData: Record<string, any[]>; // 🌟 追加
  setScheduleData: (data: any) => void; // 🌟 追加
}

export default function LayerManagementModal({
  visible,
  onClose,
  layerMaster,
  setLayerMaster,
  setHasUnsavedChanges,
  sharedRooms, // ✅ 追加
  onDeleteSharedRoom, // ✅ 追加
  scheduleData, // 🌟 追加
  setScheduleData, // 🌟 追加
}: LayerManagementModalProps) {
  const [newLayerName, setNewLayerName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#007AFF");

  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // モーダル表示時に位置をリセット
  useEffect(() => {
    if (visible) {
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 45,
        friction: 9,
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(panY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          handleClose();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 10,
          }).start();
        }
      },
    }),
  ).current;

  const addLayer = async () => {
    if (!newLayerName.trim()) return;
    const updated = { ...layerMaster, [newLayerName.trim()]: selectedColor };
    setLayerMaster(updated);
    await AsyncStorage.setItem("layerMasterData", JSON.stringify(updated));
    setHasUnsavedChanges(true);
    setNewLayerName("");
    Keyboard.dismiss();
  };

  const deleteLayer = (name: string) => {
    // 共有カレンダーかどうかを判定
    const isShared = Object.keys(sharedRooms).includes(name);

    if (isShared) {
      Alert.alert(
        "共有カレンダーの削除",
        `「${name}」の共有設定とカテゴリを削除しますか？\n（※クラウド上のデータは消えず、この端末からの表示のみ解除されます）`,
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "削除する",
            style: "destructive",
            onPress: async () => {
              onDeleteSharedRoom(name); // 共有接続を解除
              const updated = { ...layerMaster };
              delete updated[name];
              setLayerMaster(updated); // ローカルカテゴリからも削除

              // 🌟 追加：このカテゴリに紐づく予定をすべて消去する！
              setScheduleData((prev: Record<string, any[]>) => {
                const next: Record<string, any[]> = {};
                Object.keys(prev).forEach((date) => {
                  next[date] = prev[date].filter((item) => {
                    const itemLayer =
                      item.layer ||
                      (item.tags && item.tags.length > 0
                        ? item.tags[0]
                        : item.tag);
                    return itemLayer !== name;
                  });
                });
                return next;
              });

              await AsyncStorage.setItem(
                "layerMasterData",
                JSON.stringify(updated),
              );
              setHasUnsavedChanges(true);
            },
          },
        ],
      );
    } else {
      // 🌟 確認メッセージも親切に強化
      Alert.alert(
        "確認",
        `カテゴリ「${name}」と、そこに含まれる【すべての予定】を削除しますか？\n（この操作は取り消せません）`,
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "一括削除", // 🌟 ボタン名もわかりやすく
            style: "destructive",
            onPress: async () => {
              const updated = { ...layerMaster };
              delete updated[name];
              setLayerMaster(updated);

              // 🌟 追加：このカテゴリに紐づく予定をすべて消去する！
              setScheduleData((prev: Record<string, any[]>) => {
                const next: Record<string, any[]> = {};
                Object.keys(prev).forEach((date) => {
                  next[date] = prev[date].filter((item) => {
                    const itemLayer =
                      item.layer ||
                      (item.tags && item.tags.length > 0
                        ? item.tags[0]
                        : item.tag);
                    return itemLayer !== name;
                  });
                });
                return next;
              });

              await AsyncStorage.setItem(
                "layerMasterData",
                JSON.stringify(updated),
              );
              setHasUnsavedChanges(true);
            },
          },
        ],
      );
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent={true}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <Animated.View
          style={[styles.content, { transform: [{ translateY: panY }] }]}
        >
          <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
            <View style={styles.dragHandle} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardContainer}
          >
            <View style={styles.header}>
              <View>
                {/* 🌟 修正：英語ラベルを削除し、タイトルを整理 */}
                <Text style={styles.title}>構成の管理</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close-outline" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sectionLabel}>登録済み</Text>

              {/* 🌟 修正：カテゴリ一覧と共有接続一覧を合体させて、隠れているゴーストもあぶり出す！ */}
              {Array.from(
                new Set([
                  ...Object.keys(layerMaster),
                  ...Object.keys(sharedRooms || {}),
                ]),
              ).map((layer) => {
                // このレイヤーが共有カレンダーかどうか判定
                const isShared = Object.keys(sharedRooms || {}).includes(layer);
                // 色データが消えてしまっているゴースト用の保険（標準の青色にする）
                const displayColor = layerMaster[layer] || "#007AFF";

                return (
                  <View key={layer} style={styles.layerCard}>
                    <View
                      style={[
                        styles.cardAccentLine,
                        { backgroundColor: displayColor },
                      ]}
                    />
                    <View style={styles.cardInfo}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text style={styles.layerNameText}>{layer}</Text>
                        {isShared && (
                          <Ionicons
                            name="cloud-outline"
                            size={16}
                            color="#007AFF"
                          />
                        )}
                      </View>
                      <Text style={styles.layerHexText}>
                        {isShared
                          ? `ID: ${sharedRooms[layer]}`
                          : displayColor.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteLayer(layer)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons
                        name={
                          isShared ? "trash-outline" : "remove-circle-outline"
                        }
                        size={20}
                        color={isShared ? "#FF3B30" : "#1C1C1E"}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <View style={styles.newLayerSection}>
                <Text style={styles.sectionLabel}>新規追加</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="レイヤー名を入力..."
                    placeholderTextColor="#C7C7CC"
                    value={newLayerName}
                    onChangeText={setNewLayerName}
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: selectedColor }]}
                    onPress={addLayer}
                  >
                    <Ionicons name="arrow-up-outline" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.paletteRow}>
                  {COLOR_PALETTE.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setSelectedColor(c)}
                      style={[
                        styles.paletteCircle,
                        { backgroundColor: c },
                        selectedColor === c && {
                          borderColor: "#1C1C1E",
                          borderWidth: 1.5,
                          transform: [{ scale: 1.2 }],
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  dragHandleArea: {
    width: "100%",
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: 30,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#D1D1D6",
  },
  content: {
    height: "90%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
  },
  keyboardContainer: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    marginTop: 10,
  },
  // 🌟 修正：「構成の管理」の太さを落とす
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    letterSpacing: -0.5,
  },
  closeBtn: { padding: 4 },

  scroll: { flex: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#C7C7CC",
    marginBottom: 15,
    letterSpacing: 1,
  },

  layerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#F2F2F7",
    paddingRight: 4,
  },
  cardAccentLine: { width: 3, height: 16, borderRadius: 1.5 },
  cardInfo: { flex: 1, paddingVertical: 18, paddingHorizontal: 16 },
  layerNameText: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  layerHexText: {
    fontSize: 10,
    color: "#AEAEB2",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  deleteBtn: { padding: 8 },

  newLayerSection: { marginTop: 35, paddingBottom: 60 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingLeft: 15,
    paddingRight: 5,
    paddingVertical: 5,
    marginBottom: 20,
  },
  input: { flex: 1, fontSize: 14, fontWeight: "700", color: "#1C1C1E" },
  addBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  paletteRow: { flexDirection: "row", justifyContent: "space-between" },
  paletteCircle: { width: 24, height: 24 },
});
