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

export default function LayerManagementModal({
  visible,
  onClose,
  layerMaster,
  setLayerMaster,
  setHasUnsavedChanges,
}: any) {
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
    Alert.alert("確認", `カテゴリ「${name}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          const updated = { ...layerMaster };
          delete updated[name];
          setLayerMaster(updated);
          await AsyncStorage.setItem(
            "layerMasterData",
            JSON.stringify(updated),
          );
          setHasUnsavedChanges(true);
        },
      },
    ]);
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
              {/* 🌟 修正：日本語ラベルに変更 */}
              <Text style={styles.sectionLabel}>登録済み</Text>
              {Object.keys(layerMaster).map((layer) => (
                <View key={layer} style={styles.layerCard}>
                  <View
                    style={[
                      styles.cardAccentLine,
                      { backgroundColor: layerMaster[layer] },
                    ]}
                  />
                  <View style={styles.cardInfo}>
                    <Text style={styles.layerNameText}>{layer}</Text>
                    <Text style={styles.layerHexText}>
                      {layerMaster[layer].toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteLayer(layer)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons
                      name="remove-circle-outline"
                      size={20}
                      color="#1C1C1E"
                    />
                  </TouchableOpacity>
                </View>
              ))}

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
