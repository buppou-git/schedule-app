import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as Calendar from 'expo-calendar';
import { GoogleAuthProvider, linkWithCredential } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { useNotificationManager } from "../../../hooks/useNotificationManager";
import { auth } from "../firebaseConfig";

interface ConfigModalProps {
  visible: boolean;
  onClose: () => void;
  lastSyncedAt: string | null;
  onRestore: () => void;
}

const WEB_CLIENT_ID = "633661996714-j5cb16hjn156oeqf51pi384e0hh7b158.apps.googleusercontent.com";

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
});

export default function ConfigModal({
  visible,
  onClose,
  lastSyncedAt,
  onRestore,
}: ConfigModalProps) {
  const {
    isNotificationEnabled,
    notificationTime,
    scheduleDailyNotification,
    cancelNotification,
  } = useNotificationManager();

  const [showTimePickerAndroid, setShowTimePickerAndroid] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(auth.currentUser?.isAnonymous ?? true);

  // 🌟 追加：カレンダー同期のON/OFF状態
  const [isCalendarSyncEnabled, setIsCalendarSyncEnabled] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAnonymous(user?.isAnonymous ?? true);
    });

    // 🌟 追加：現在のカレンダー同期設定を読み込む
    AsyncStorage.getItem("externalCalendarSync").then(val => {
      setIsCalendarSyncEnabled(val === "true");
    });

    return unsubscribe;
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLinking(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const anyResponse = response as any;
      const id_token = anyResponse.data?.idToken || anyResponse.idToken;

      if (id_token) {
        const credential = GoogleAuthProvider.credential(id_token);
        if (auth.currentUser) {
          await linkWithCredential(auth.currentUser, credential);
          setIsAnonymous(false);
          Alert.alert("連携完了", "アカウントと紐付けられ、データが保護されました。");
        }
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      if (error.code === "auth/credential-already-in-use") {
        Alert.alert("エラー", "このアカウントは既に別のデータと紐付いています。");
      } else {
        Alert.alert("エラー", "アカウント連携をキャンセル、または失敗しました。");
      }
    } finally {
      setIsLinking(false);
    }
  };

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
      if (isNotificationEnabled) {
        await scheduleDailyNotification(selectedDate);
      }
    }
  };

  // 🌟 追加：カレンダー同期スイッチの処理
  const handleCalendarSyncToggle = async (value: boolean) => {
    if (value) {
      // ONにした瞬間、OSの権限ポップアップを呼び出す
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        setIsCalendarSyncEnabled(true);
        await AsyncStorage.setItem("externalCalendarSync", "true");
        Alert.alert("同期オン", "標準カレンダーとの連携を有効にしました。\n※反映にはアプリの再起動が必要な場合があります。");
      } else {
        Alert.alert("権限エラー", "カレンダーへのアクセスが許可されませんでした。");
        setIsCalendarSyncEnabled(false);
        await AsyncStorage.setItem("externalCalendarSync", "false");
      }
    } else {
      setIsCalendarSyncEnabled(false);
      await AsyncStorage.setItem("externalCalendarSync", "false");
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
                <Text style={styles.subTitle}>設定と連携</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

              {/* 🌟 追加：カレンダー連携セクション */}
              <Text style={styles.sectionLabel}>INTEGRATION</Text>
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

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ACCOUNT</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="person-circle-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>ステータス</Text>
                  </View>
                  <Text style={[styles.timeText, { color: isAnonymous ? "#8E8E93" : "#34C759", fontWeight: "bold" }]}>
                    {isAnonymous ? "ゲスト (未連携)" : "Google 連携済"}
                  </Text>
                </View>

                {isAnonymous && (
                  <TouchableOpacity
                    style={[styles.row, styles.borderTop]}
                    disabled={isLinking}
                    onPress={handleGoogleSignIn}
                  >
                    <View style={styles.rowLeft}>
                      <Ionicons name="logo-google" size={20} color="#1C1C1E" />
                      <Text style={styles.rowText}>Googleでデータを保護</Text>
                    </View>
                    {isLinking ? (
                      <ActivityIndicator size="small" color="#1C1C1E" />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>NOTIFICATIONS</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="notifications-outline" size={20} color="#1C1C1E" />
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
                      <Text style={[styles.rowText, { color: "#8E8E93" }]}>通知時間</Text>
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
                        <TouchableOpacity style={styles.timeBtnAndroid} onPress={() => setShowTimePickerAndroid(true)}>
                          <Text style={styles.timeBtnTextAndroid}>
                            {("0" + notificationTime.getHours()).slice(-2)}:{("0" + notificationTime.getMinutes()).slice(-2)}
                          </Text>
                        </TouchableOpacity>
                        {showTimePickerAndroid && (
                          <DateTimePicker value={notificationTime} mode="time" display="default" onChange={handleTimeChange} />
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DATA SYNC</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="cloud-done-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>最終同期</Text>
                  </View>
                  <Text style={styles.timeText}>{lastSyncedAt ? lastSyncedAt : "未同期"}</Text>
                </View>
                <TouchableOpacity style={[styles.row, styles.borderTop]} onPress={onRestore}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="cloud-download-outline" size={20} color="#007AFF" />
                    <Text style={[styles.rowText, { color: "#007AFF", fontWeight: "bold" }]}>クラウドからデータを復元</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>LEGAL</Text>
              <View style={styles.card}>
                <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://www.notion.so/3466f7789c6e806f8880ed9241a38b99?source=copy_link')}>
                  <View style={styles.rowLeft}><Ionicons name="document-text-outline" size={20} color="#1C1C1E" /><Text style={styles.rowText}>利用規約</Text></View>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.row, styles.borderTop]} onPress={() => Linking.openURL('https://www.notion.so/3466f7789c6e80958ff2e31ae7f89e16?source=copy_link')}>
                  <View style={styles.rowLeft}><Ionicons name="shield-checkmark-outline" size={20} color="#1C1C1E" /><Text style={styles.rowText}>プライバシーポリシー</Text></View>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              </View>

              <Text style={styles.copyright}>Developed by Kanta Hirano</Text>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  content: { backgroundColor: "#F2F2F7", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingHorizontal: 24, maxHeight: "90%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "800", color: "#1C1C1E" },
  subTitle: { fontSize: 12, color: "#8E8E93", fontWeight: "600", marginTop: 2 },
  closeBtn: { width: 32, height: 32, backgroundColor: "#E5E5EA", borderRadius: 16, justifyContent: "center", alignItems: "center" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#8E8E93", letterSpacing: 1, marginBottom: 8, marginLeft: 8 },
  card: { backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  borderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E5EA" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { fontSize: 16, fontWeight: "500", color: "#1C1C1E" },
  timeText: { fontSize: 14, color: "#8E8E93", fontWeight: "500" },
  timeBtnAndroid: { backgroundColor: "#F2F2F7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  timeBtnTextAndroid: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  copyright: { textAlign: "center", fontSize: 12, color: "#C7C7CC", marginTop: 32, fontWeight: "600", marginBottom: 20 },
});