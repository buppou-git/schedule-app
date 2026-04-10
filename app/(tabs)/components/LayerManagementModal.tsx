import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
    Alert,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

interface LayerManagementModalProps {
  visible: boolean;
  onClose: () => void;
  layerMaster: { [key: string]: string };
  setLayerMaster: (data: { [key: string]: string }) => void;
}

export default function LayerManagementModal({
  visible,
  onClose,
  layerMaster,
  setLayerMaster,
}: LayerManagementModalProps) {
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerColor, setNewLayerColor] = useState("#FF3B30");

  // ScheduleModalと同じ、美しい11色のパレット
  const COLOR_PALETTE = [
    { code: "#FF3B30", name: "レッド" },
    { code: "#FF9500", name: "オレンジ" },
    { code: "#FFCC00", name: "イエロー" },
    { code: "#34C759", name: "グリーン" },
    { code: "#5AC8FA", name: "水色" },
    { code: "#007AFF", name: "ブルー" },
    { code: "#5856D6", name: "インディゴ" },
    { code: "#AF52DE", name: "パープル" },
    { code: "#FF2D55", name: "ピンク" },
    { code: "#A2845E", name: "ブラウン" },
    { code: "#8E8E93", name: "グレー" },
  ];

  // 🌟 追加処理
  const handleAddLayer = async () => {
    if (!newLayerName.trim()) {
      Alert.alert("エラー", "レイヤー名を入力してください");
      return;
    }
    if (layerMaster[newLayerName]) {
      Alert.alert("エラー", "そのレイヤー名は既に存在します");
      return;
    }

    const newMaster = { ...layerMaster, [newLayerName]: newLayerColor };
    setLayerMaster(newMaster);
    await AsyncStorage.setItem("layerMasterData", JSON.stringify(newMaster));
    
    // 入力欄をリセット
    setNewLayerName("");
    Keyboard.dismiss();
  };

  // 🌟 削除処理
  const handleDeleteLayer = (layerName: string) => {
    Alert.alert(
      "レイヤーを削除",
      `「${layerName}」を削除してもよろしいですか？\n※このレイヤーに属していたタグは「生活」レイヤーに一時的に分類されます。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: async () => {
            const newMaster = { ...layerMaster };
            delete newMaster[layerName];
            setLayerMaster(newMaster);
            await AsyncStorage.setItem("layerMasterData", JSON.stringify(newMaster));
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              
              <View style={styles.header}>
                <Text style={styles.modalTitle}>⚙️ レイヤーの編集</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>完了</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                
                {/* 既存のレイヤー一覧 */}
                <Text style={styles.sectionTitle}>現在のレイヤー</Text>
                <View style={styles.layerList}>
                  {Object.keys(layerMaster).map((layer) => (
                    <View key={layer} style={styles.layerItem}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={[styles.colorDot, { backgroundColor: layerMaster[layer] }]} />
                        <Text style={styles.layerName}>{layer}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteLayer(layer)}>
                        <Text style={styles.deleteText}>✕ 削除</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* 新しいレイヤーの追加エリア */}
                <View style={styles.addSection}>
                  <Text style={styles.sectionTitle}>✨ 新しいレイヤーを作成</Text>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="レイヤー名（例：バイト、趣味）"
                    value={newLayerName}
                    onChangeText={setNewLayerName}
                  />

                  <Text style={styles.label}>テーマカラー</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                    <View style={{ flexDirection: "row", paddingHorizontal: 5, paddingBottom: 5 }}>
                      {COLOR_PALETTE.map((colorObj) => (
                        <TouchableOpacity
                          key={colorObj.code}
                          style={{ alignItems: "center", width: 55, marginRight: 5 }}
                          onPress={() => setNewLayerColor(colorObj.code)}
                        >
                          <View
                            style={[
                              styles.colorCircle,
                              { backgroundColor: colorObj.code },
                              newLayerColor === colorObj.code && styles.selectedCircle,
                            ]}
                          />
                          <Text style={{ fontSize: 9, color: "#999", marginTop: 4 }}>{colorObj.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  <TouchableOpacity style={styles.addButton} onPress={handleAddLayer}>
                    <Text style={styles.addButtonText}>＋ レイヤーを追加</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#F8F9FA", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: "80%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  closeButton: { padding: 8, backgroundColor: "#E5E5EA", borderRadius: 15, paddingHorizontal: 15 },
  closeButtonText: { fontWeight: "bold", color: "#333" },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#666", marginBottom: 10, marginTop: 10 },
  layerList: { backgroundColor: "#fff", borderRadius: 12, padding: 10, marginBottom: 20, borderWidth: 1, borderColor: "#E5E5EA" },
  layerItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  colorDot: { width: 16, height: 16, borderRadius: 8, marginRight: 12 },
  layerName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  deleteText: { color: "#FF3B30", fontWeight: "bold", fontSize: 12, paddingHorizontal: 8 },
  addSection: { backgroundColor: "#fff", borderRadius: 12, padding: 15, borderWidth: 1, borderColor: "#E5E5EA" },
  input: { backgroundColor: "#F0F0F5", padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 15 },
  label: { fontSize: 12, fontWeight: "bold", color: "#666", marginBottom: 8 },
  colorCircle: { width: 30, height: 30, borderRadius: 15 },
  selectedCircle: { borderWidth: 3, borderColor: "#333" },
  addButton: { backgroundColor: "#007AFF", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 5 },
  addButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});