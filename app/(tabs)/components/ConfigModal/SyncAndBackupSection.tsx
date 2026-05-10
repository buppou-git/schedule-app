import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Calendar from "expo-calendar";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// 🌟 パスはご自身の環境に合わせて調整してください
import { useNotificationManager } from "../../../../hooks/useNotificationManager";
import { ScheduleItem } from "../../../../types";
import { styles } from "./ConfigModal.styles";

interface SyncAndBackupSectionProps {
  isCalendarSyncEnabled: boolean;
  setIsCalendarSyncEnabled: (val: boolean) => void;
  lastSyncedAt: string | null;
  onRestore: () => void;
  onBackup: () => void;
}

export const SyncAndBackupSection = React.memo(
  ({
    isCalendarSyncEnabled,
    setIsCalendarSyncEnabled,
    lastSyncedAt,
    onRestore,
    onBackup,
  }: SyncAndBackupSectionProps) => {
    // 🌟 通知関連のHookとStateをここに閉じ込める
    const {
      isNotificationEnabled,
      notificationTime,
      scheduleDailyNotification,
      cancelNotification,
    } = useNotificationManager();

    const [showTimePickerAndroid, setShowTimePickerAndroid] = useState(false);

    // 🌟 通知ON/OFF
    const handleToggleSwitch = useCallback(
      async (value: boolean) => {
        if (value) {
          await scheduleDailyNotification(notificationTime);
        } else {
          await cancelNotification();
        }
      },
      [scheduleDailyNotification, cancelNotification, notificationTime],
    );

    // 🌟 通知時間の変更
    const handleTimeChange = useCallback(
      async (event: { type: string }, selectedDate?: Date) => {
        if (Platform.OS === "android") setShowTimePickerAndroid(false);
        if (selectedDate) {
          await scheduleDailyNotification(selectedDate);
        }
      },
      [scheduleDailyNotification],
    );

    // 🌟 カレンダー同期ON/OFF
    const handleCalendarSyncToggle = useCallback(
      async (value: boolean) => {
        if (value) {
          const { status } = await Calendar.requestCalendarPermissionsAsync();
          if (status === "granted") {
            setIsCalendarSyncEnabled(true);
            await AsyncStorage.setItem("externalCalendarSync", "true");
            Alert.alert("同期ON", "標準カレンダーとの連携を有効にしました。");
          } else {
            Alert.alert(
              "権限エラー",
              "カレンダーへのアクセスが許可されませんでした。Androidの設定から許可してください。",
            );
            setIsCalendarSyncEnabled(false);
          }
        } else {
          setIsCalendarSyncEnabled(false);
          await AsyncStorage.setItem("externalCalendarSync", "false");
        }
      },
      [setIsCalendarSyncEnabled],
    );

    // 🌟 CSVエクスポート
    const handleExportCSV = useCallback(async () => {
      try {
        const dataStr = await AsyncStorage.getItem("myScheduleData");
        if (!dataStr) {
          Alert.alert("エラー", "出力するデータが見つかりません。");
          return;
        }

        const scheduleData = JSON.parse(dataStr);
        let csvContent = "\uFEFF日付,タイトル,タイプ,金額(円),ステータス\n";

        Object.keys(scheduleData).forEach((date) => {
          scheduleData[date].forEach((item: ScheduleItem) => {
            const title = item.title
              ? item.title.replace(/,/g, "，")
              : "名称未設定";
            let type = "その他";
            if (item.isEvent) type = "予定";
            if (item.isTodo) type = "ToDo";
            if (item.amount) type = "家計簿";

            const amount = item.amount || 0;
            const status = item.isDone ? "完了" : "未完了";

            csvContent += `${date},${title},${type},${amount},${status}\n`;
          });
        });

        // 🌟 修正ポイント：元のコードにあった「型エラー回避用」の記述に戻しました！
        const SafeFS = FileSystem as unknown as {
          documentDirectory: string | null;
          EncodingType: { UTF8: string };
          // 🌟 any を「ファイルパスと中身を受け取って保存する関数」の型に書き換え
          writeAsStringAsync: (fileUri: string, contents: string, options?: { encoding?: string }) => Promise<void>;
        };
        const fileUri = SafeFS.documentDirectory + "UniCal_Data.csv";

        await SafeFS.writeAsStringAsync(fileUri, csvContent, {
          encoding: SafeFS.EncodingType.UTF8,
        });

        await Sharing.shareAsync(fileUri);
      } catch (error) {
        console.error("CSV Export Error:", error);
        Alert.alert("エラー", "CSVの作成に失敗しました。");
      }
    }, []);

    return (
      <>
        {/* ========================================== */}
        {/* NOTIFICATIONS */}
        {/* ========================================== */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
          NOTIFICATIONS
        </Text>
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
                  style={{ width: 80 }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => setShowTimePickerAndroid(true)}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: "#007AFF",
                        fontWeight: "bold",
                      }}
                    >
                      {notificationTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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

        {/* ========================================== */}
        {/* CALENDAR SYNC */}
        {/* ========================================== */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
          CALENDAR SYNC
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="calendar-outline" size={20} color="#1C1C1E" />
              <Text style={styles.rowText}>標準カレンダーと同期</Text>
            </View>
            <Switch
              value={isCalendarSyncEnabled}
              onValueChange={handleCalendarSyncToggle}
              trackColor={{ false: "#E5E5EA", true: "#34C759" }}
            />
          </View>
        </View>

        {/* ========================================== */}
        {/* BACKUP */}
        {/* ========================================== */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>BACKUP</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={onBackup}>
            <View style={styles.rowLeft}>
              <Ionicons name="cloud-upload-outline" size={20} color="#007AFF" />
              <Text
                style={[
                  styles.rowText,
                  { color: "#007AFF", fontWeight: "bold" },
                ]}
              >
                クラウドにデータを保存
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.borderTop]}
            onPress={onRestore}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="cloud-download-outline"
                size={20}
                color="#1C1C1E"
              />
              <Text style={styles.rowText}>クラウドからデータを復元</Text>
            </View>
          </TouchableOpacity>
          {lastSyncedAt && (
            <View
              style={[
                styles.row,
                styles.borderTop,
                { justifyContent: "center" },
              ]}
            >
              <Text style={styles.timeText}>最終同期: {lastSyncedAt}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.row, styles.borderTop]}
            onPress={handleExportCSV}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#1C1C1E"
              />
              <Text style={styles.rowText}>データをCSVで書き出す</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </TouchableOpacity>
        </View>
      </>
    );
  },
);
