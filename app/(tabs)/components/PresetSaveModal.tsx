import React from "react";
import {
    Keyboard,
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

// 🌟 このモーダルが動くために親(index.tsx)から受け取る必要があるものを定義
interface PresetSaveModalProps {
  visible: boolean;
  presetName: string;
  setPresetName: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function PresetSaveModal({
  visible,
  presetName,
  setPresetName,
  onClose,
  onSave,
}: PresetSaveModalProps) {
  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.namingOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.namingContent}>
                <Text style={styles.namingLabel}>SAVE_PRESET</Text>
                <Text style={styles.namingTitle}>プリセット名の入力</Text>

                <TextInput
                  style={styles.namingInput}
                  placeholder="PRESET_NAME..."
                  placeholderTextColor="#AEAEB2"
                  autoFocus={true}
                  value={presetName}
                  onChangeText={setPresetName}
                />

                <View style={styles.namingActionRow}>
                  <TouchableOpacity
                    style={styles.namingCancelBtn}
                    onPress={() => {
                      onClose();
                      Keyboard.dismiss();
                    }}
                  >
                    <Text style={styles.namingCancelText}>CANCEL</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.namingConfirmBtn}
                    onPress={() => {
                      onSave();
                      Keyboard.dismiss();
                    }}
                  >
                    <Text style={styles.namingConfirmText}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 🌟 index.tsxからこのモーダル用のスタイルだけをお引越し
const styles = StyleSheet.create({
  namingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  namingContent: {
    width: "80%",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
  },
  namingLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#C7C7CC",
    letterSpacing: 1.5,
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  namingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 20,
  },
  namingInput: {
    backgroundColor: "#F2F2F7",
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 20,
  },
  namingActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  namingCancelBtn: { padding: 10 },
  namingCancelText: { fontSize: 12, fontWeight: "700", color: "#8E8E93" },
  namingConfirmBtn: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  namingConfirmText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
});