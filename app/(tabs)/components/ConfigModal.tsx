import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useNotificationManager } from "../../../hooks/useNotificationManager";

interface ConfigModalProps {
  visible: boolean;
  onClose: () => void;
  lastSyncedAt: string | null;
  onRestore: () => void;
}

export default function ConfigModal({
  visible,
  onClose,
  lastSyncedAt,
  onRestore,
}: ConfigModalProps) {
  // 🌟 さっき作った「通知の脳みそ」を呼び出す！
  const {
    isNotificationEnabled,
    notificationTime,
    scheduleDailyNotification,
    cancelNotification,
  } = useNotificationManager();

  // Android用の時計モーダル表示フラグ
  const [showTimePickerAndroid, setShowTimePickerAndroid] = useState(false);

  const handleToggleSwitch = async (value: boolean) => {
    if (value) {
      await scheduleDailyNotification(notificationTime);
    } else {
      await cancelNotification();
    }
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowTimePickerAndroid(false);
    if (selectedDate) {
      // 通知がONの時だけ、時間変更と同時に通知を再セットする
      if (isNotificationEnabled) {
        await scheduleDailyNotification(selectedDate);
      }
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableWithoutFeedback>
          <View style={styles.content}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>CONFIG</Text>
                <Text style={styles.subTitle}>設定とバックアップ</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            {/* 🌟 通知設定セクション */}
            <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color="#1C1C1E"
                  />
                  <Text style={styles.rowText}>毎日のリマインダー</Text>
                </View>
                <Switch
                  value={isNotificationEnabled}
                  onValueChange={handleToggleSwitch}
                  trackColor={{ false: "#E5E5EA", true: "#34C759" }}
                />
              </View>

              {/* 通知がONの時だけ時間を表示 */}
              {isNotificationEnabled && (
                <View style={[styles.row, styles.borderTop]}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="time-outline" size={20} color="#8E8E93" />
                    <Text style={[styles.rowText, { color: "#8E8E93" }]}>
                      通知時間
                    </Text>
                  </View>

                  {Platform.OS === "ios" ? (
                    <DateTimePicker
                      value={notificationTime}
                      mode="time"
                      display="default"
                      onChange={handleTimeChange}
                      style={{ width: 90 }}
                    />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.timeBtnAndroid}
                        onPress={() => setShowTimePickerAndroid(true)}
                      >
                        <Text style={styles.timeBtnTextAndroid}>
                          {("0" + notificationTime.getHours()).slice(-2)}:
                          {("0" + notificationTime.getMinutes()).slice(-2)}
                        </Text>
                      </TouchableOpacity>
                      {showTimePickerAndroid && (
                        <DateTimePicker
                          value={notificationTime}
                          mode="time"
                          display="default"
                          onChange={handleTimeChange}
                        />
                      )}
                    </>
                  )}
                </View>
              )}
            </View>

            {/* 既存のバックアップセクション */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
              DATA SYNC
            </Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons
                    name="cloud-done-outline"
                    size={20}
                    color="#1C1C1E"
                  />
                  <Text style={styles.rowText}>最終同期</Text>
                </View>
                <Text style={styles.timeText}>
                  {lastSyncedAt ? lastSyncedAt : "未同期"}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.row, styles.borderTop]}
                onPress={onRestore}
              >
                <View style={styles.rowLeft}>
                  <Ionicons
                    name="cloud-download-outline"
                    size={20}
                    color="#007AFF"
                  />
                  <Text
                    style={[
                      styles.rowText,
                      { color: "#007AFF", fontWeight: "bold" },
                    ]}
                  >
                    クラウドからデータを復元
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.copyright}>Developed by Kanta Hirano</Text>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#F2F2F7",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: "50%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#1C1C1E" },
  subTitle: { fontSize: 12, color: "#8E8E93", fontWeight: "600", marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: "#E5E5EA",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 8,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  borderTop: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { fontSize: 16, fontWeight: "500", color: "#1C1C1E" },
  timeText: { fontSize: 14, color: "#8E8E93", fontWeight: "500" },
  timeBtnAndroid: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeBtnTextAndroid: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  copyright: {
    textAlign: "center",
    fontSize: 12,
    color: "#C7C7CC",
    marginTop: 32,
    fontWeight: "600",
  },
});
