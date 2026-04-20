import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

interface QuickActionModalProps {
  visible: boolean;
  onClose: () => void;
  item: any; // 選択された予定データ
  themeColor: string;
  onDelete: (item: any) => void;
  onEditDetail: (item: any) => void; // メインのScheduleModalを開く用
  onQuickSave: (item: any, newTitle: string) => void; // 名前だけサクッと変える用
}

export default function QuickActionModal({
  visible,
  onClose,
  item,
  themeColor,
  onDelete,
  onEditDetail,
  onQuickSave,
}: QuickActionModalProps) {
  const [quickTitle, setQuickTitle] = useState("");

  // モーダルが開くたびに、今のタイトルをセットする
  useEffect(() => {
    if (visible && item) {
      setQuickTitle(item.title || "");
    }
  }, [visible, item]);

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%", justifyContent: "flex-end" }}
        >
          <TouchableWithoutFeedback>
            <View style={styles.sheetContent}>
              
              {/* ドラッグできる風のバー（デザイン用） */}
              <View style={styles.dragHandle} />

              {/* サクッと名前変更エリア */}
              <View style={styles.quickEditRow}>
                <TextInput
                  style={[styles.quickInput, { color: themeColor }]}
                  value={quickTitle}
                  onChangeText={setQuickTitle}
                  placeholder="予定の名前"
                  autoFocus={false}
                />
                <TouchableOpacity
                  style={[styles.quickSaveBtn, { backgroundColor: themeColor }]}
                  onPress={() => {
                    onQuickSave(item, quickTitle);
                    onClose();
                  }}
                >
                  <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 12 }}>
                    保存
                  </Text>
                </TouchableOpacity>
              </View>

              {/* メニュー項目 */}
              <View style={styles.menuContainer}>
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => {
                    onClose();
                    setTimeout(() => onEditDetail(item), 300); // アニメーション終了後にメインモーダルを開く
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: themeColor + "15" }]}>
                    <Ionicons name="options-outline" size={20} color={themeColor} />
                  </View>
                  <Text style={styles.menuText}>詳細・繰り返し設定を編集</Text>
                  <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => {
                    onClose();
                    onDelete(item);
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: "#FF3B3015" }]}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </View>
                  <Text style={[styles.menuText, { color: "#FF3B30" }]}>
                    この予定を削除する
                  </Text>
                </TouchableOpacity>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end", // 下に寄せる
  },
  sheetContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E5EA",
    alignSelf: "center",
    marginBottom: 20,
  },
  quickEditRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  quickInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
    paddingVertical: 5,
  },
  quickSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  menuContainer: {
    backgroundColor: "#F8F8FA",
    borderRadius: 15,
    overflow: "hidden",
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "bold",
    color: "#1C1C1E",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginLeft: 60, // アイコンの右側から線を引くオシャレな処理
  },
});