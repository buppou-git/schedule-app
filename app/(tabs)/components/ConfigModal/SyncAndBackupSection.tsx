import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Calendar from "expo-calendar";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react"; // 🌟 useRef を追加！
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

    // 🌟 追加：一時的に画面の表示だけを変えるための仮ステート
    const [tempTime, setTempTime] = useState<Date>(notificationTime);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 🌟 修正1：本体(notificationTime)がロード/変更されたら、画面表示(tempTime)も同期させる！
    // これにより、タスクキル後に古い初期値（朝7時など）に戻ってしまうのを防ぎます。
    useEffect(() => {
      setTempTime(notificationTime);
    }, [notificationTime]);

    // 🌟 通知ON/OFF
    const handleToggleSwitch = useCallback(
      async (value: boolean) => {
        if (value) {
          // 秒とミリ秒を強制的に「0」にリセットする
          const exactTime = new Date(tempTime);
          exactTime.setSeconds(0, 0);
          await scheduleDailyNotification(exactTime);
        } else {
          await cancelNotification();
        }
      },
      [scheduleDailyNotification, cancelNotification, tempTime],
    );

    // 🌟 通知時間の変更（最強の誤爆防止システム）
    const handleTimeChange = useCallback(
      async (event: { type: string }, selectedDate?: Date) => {
        if (Platform.OS === "android") setShowTimePickerAndroid(false);
        if (selectedDate) {
          // 1. 画面の見た目（tempTime）は一瞬で切り替える
          const exactTime = new Date(selectedDate);
          exactTime.setSeconds(0, 0);
          setTempTime(exactTime);

          // 2. 指を動かしている最中の連続保存をキャンセルする
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
          }

          // 3. 指を止めてから 1秒後 に初めて通知を保存・セットする
          saveTimerRef.current = setTimeout(async () => {
            if (isNotificationEnabled) {
              await scheduleDailyNotification(exactTime);
            }
          }, 1000);
        }
      },
      [scheduleDailyNotification, isNotificationEnabled], // 🌟 依存配列に isNotificationEnabled を明記
    );

    // ... (これ以降のカレンダー同期、CSVエクスポート等の関数はそのまま) ...
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

        const SafeFS = FileSystem as unknown as {
          documentDirectory: string | null;
          EncodingType: { UTF8: string };
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
                  value={tempTime} // 🌟 表示する時間を tempTime に変更
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
                      {tempTime.toLocaleTimeString([], { // 🌟 表示する時間を tempTime に変更
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                  {showTimePickerAndroid && (
                    <DateTimePicker
                      value={tempTime} // 🌟 表示する時間を tempTime に変更
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