import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as Calendar from 'expo-calendar'; // 🌟 追加
import * as FileSystem from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing'; // 🌟 追加
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
  TextInput,
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

  //生体認証のオンオフ
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  //パスワードのオンオフ
  const [isPinEnabled, setIsPinEnabled] = useState(false);

  const [isPinSetupVisible, setIsPinSetupVisible] = useState(false);
  const [pinInput, setPinInput] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAnonymous(user?.isAnonymous ?? true);
    });

    // 🌟 追加：保存されているカレンダー同期設定を読み込む
    AsyncStorage.getItem("externalCalendarSync").then(val => {
      setIsCalendarSyncEnabled(val === "true");
    });

    AsyncStorage.getItem("useBiometricLock").then(val => {
      setIsBiometricEnabled(val === "true");
    });
    AsyncStorage.getItem("usePinLock").then(val => {
      setIsPinEnabled(val === "true");
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

  // 🌟 追加：カレンダー同期スイッチが押された時の処理
  const handleCalendarSyncToggle = async (value: boolean) => {
    if (value) {
      // スイッチをONにした瞬間、OSの権限要求ポップアップを出す
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        setIsCalendarSyncEnabled(true);
        await AsyncStorage.setItem("externalCalendarSync", "true");
        Alert.alert("同期ON", "標準カレンダーとの連携を有効にしました。");
      } else {
        Alert.alert("権限エラー", "カレンダーへのアクセスが許可されませんでした。Androidの設定から許可してください。");
        setIsCalendarSyncEnabled(false);
      }
    } else {
      setIsCalendarSyncEnabled(false);
      await AsyncStorage.setItem("externalCalendarSync", "false");
    }
  };


  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert("エラー", "この端末では生体認証やパスコードが設定されていません。");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "UniCalのロックを有効にする",
      });

      if (result.success) {
        setIsBiometricEnabled(true);
        await AsyncStorage.setItem("useBiometricLock", "true");
        Alert.alert("セキュリティON", "アプリを開く際に認証が必要になりました。");
      } else {
        setIsBiometricEnabled(false);
      }
    } else {
      setIsBiometricEnabled(false);
      await AsyncStorage.setItem("useBiometricLock", "false");
    }
  };

  const handlePinToggle = async (value: boolean) => {
    if (value) {
      setIsPinSetupVisible(true); // モーダルを開く
    } else {
      setIsPinEnabled(false);
      await AsyncStorage.setItem("usePinLock", "false");
      await SecureStore.deleteItemAsync("app_pin_code");
    }
  };

  // 🌟 追加：モーダルから呼ばれる保存処理
  const savePin = async () => {
    if (pinInput.length === 4 && /^\d+$/.test(pinInput)) {
      await SecureStore.setItemAsync("app_pin_code", pinInput);
      await AsyncStorage.setItem("usePinLock", "true");
      setIsPinEnabled(true);
      setIsPinSetupVisible(false);
      setPinInput("");
      Alert.alert("設定完了", "暗証番号ロックを有効にしました。");
    } else {
      Alert.alert("エラー", "4桁の数字を入力してください。");
    }
  };

  const handleExportCSV = async () => {
    try {
      // 1. ローカルに保存されているスケジュールデータを取得
      const dataStr = await AsyncStorage.getItem("myScheduleData");
      if (!dataStr) {
        Alert.alert("エラー", "出力するデータが見つかりません。");
        return;
      }
      
      const scheduleData = JSON.parse(dataStr);
      
      // 2. CSVのヘッダー（1行目）※先頭の \uFEFF はExcelでの文字化け防止用
      let csvContent = "\uFEFF日付,タイトル,タイプ,金額(円),ステータス\n";

      // 3. データをループしてCSV形式に変換
      Object.keys(scheduleData).forEach(date => {
        scheduleData[date].forEach((item: any) => {
          // カンマが含まれているとCSVが壊れるので除去または置換
          const title = item.title ? item.title.replace(/,/g, "，") : "名称未設定";
          
          let type = "その他";
          if (item.isEvent) type = "予定";
          if (item.isTodo) type = "ToDo";
          if (item.amount) type = "家計簿"; // 家計簿データの場合

          const amount = item.amount || 0;
          const status = item.isDone ? "完了" : "未完了";

          csvContent += `${date},${title},${type},${amount},${status}\n`;
        });
      });

     // 4. 一時ファイルとしてスマホ内に保存
      // 🌟 TSの型チェックを強制的に無視して実行させる
      const FS: any = FileSystem; 
      const fileUri = FS.documentDirectory + "UniCal_Data.csv";
      
      await FS.writeAsStringAsync(fileUri, csvContent, { 
        encoding: FS.EncodingType.UTF8 
      });

      // 5. スマホのシェア画面（AirDrop, LINE, メール等）を呼び出す
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'UniCalのデータをエクスポート',
          UTI: 'public.comma-separated-values-text' // iOS用
        });
      } else {
        Alert.alert("エラー", "この端末では共有機能がサポートされていません。");
      }

    } catch (error) {
      console.error("CSV Export Error:", error);
      Alert.alert("エラー", "CSVの作成に失敗しました。");
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

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

              {/* 🌟 修正：追加された「カレンダー連携」セクション */}
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



              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>SECURITY</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="finger-print-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>生体認証ロック</Text>
                  </View>
                  <Switch
                    value={isBiometricEnabled}
                    onValueChange={handleBiometricToggle}
                    trackColor={{ false: "#E5E5EA", true: "#34C759" }}
                  />
                </View>
                <View style={[styles.row, styles.borderTop]}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="keypad-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>暗証番号ロック</Text>
                  </View>
                  <Switch
                    value={isPinEnabled}
                    onValueChange={handlePinToggle}
                    trackColor={{ false: "#E5E5EA", true: "#34C759" }}
                  />
                </View>
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

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DATA SYNC</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="cloud-done-outline" size={20} color="#1C1C1E" />
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
                    <Ionicons name="cloud-download-outline" size={20} color="#007AFF" />
                    <Text style={[styles.rowText, { color: "#007AFF", fontWeight: "bold" }]}>
                      クラウドからデータを復元
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.row, styles.borderTop]}
                  onPress={handleExportCSV}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="document-text-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>データをCSVで出力</Text>
                  </View>
                  <Ionicons name="share-outline" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>LEGAL</Text>
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => Linking.openURL('https://www.notion.so/3466f7789c6e806f8880ed9241a38b99?source=copy_link')}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="document-text-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>利用規約</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.row, styles.borderTop]}
                  onPress={() => Linking.openURL('https://www.notion.so/3466f7789c6e80958ff2e31ae7f89e16?source=copy_link')}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>プライバシーポリシー</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </TouchableOpacity>
              </View>

              <Text style={styles.copyright}>Developed by Kanta Hirano</Text>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>

      <Modal visible={isPinSetupVisible} transparent={true} animationType="fade">
        <View style={styles.overlay}>
        <View style={[styles.content, { maxHeight: 350 }]}> {/* 高さを少し調整 */}
            <Text style={styles.title}>PIN SETTING</Text>
            <Text style={styles.subTitle}>新しい暗証番号を決めてください</Text>
            
            {/* 🌟 修正：スタイリッシュな丸枠デザインに変更 */}
            <View style={styles.pinInputWrapper}>
              {/* 実際の入力用（透明にして重ねる） */}
              <TextInput
                style={styles.hiddenTextInput}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
                value={pinInput}
                onChangeText={setPinInput}
              />
              
              {/* 見た目用（4つの丸枠を並べる） */}
              <View style={styles.pinDisplayContainer}>
                {[...Array(4)].map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.pinBox, 
                      // 現在入力中の枠を強調
                      pinInput.length === i && styles.pinBoxFocused
                    ]}
                  >
                    {pinInput.length > i && (
                      <Text style={styles.pinDot}>●</Text> // 入力されたら●を表示
                    )}
                  </View>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 16, marginBottom: 20 }}>
              <TouchableOpacity onPress={() => { setIsPinSetupVisible(false); setPinInput(""); setIsPinEnabled(false); }} style={{ padding: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#8E8E93" }}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={savePin} style={{ backgroundColor: "#1C1C1E", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFF" }}>保存する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  copyright: { textAlign: "center", fontSize: 12, color: "#C7C7CC", marginTop: 32, fontWeight: "600" },

  pinInputWrapper: { marginTop: 30, marginBottom: 30, justifyContent: 'center', alignItems: 'center' },
  hiddenTextInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0, zIndex: 1 },
  pinDisplayContainer: { flexDirection: 'row', gap: 15 },
  pinBox: { width: 55, height: 65, borderWidth: 1, borderRadius: 16, borderColor: '#C7C7CC', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  pinBoxFocused: { borderColor: '#1C1C1E', borderWidth: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  pinDot: { fontSize: 36, color: '#1C1C1E' },
});