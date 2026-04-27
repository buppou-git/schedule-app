import 'react-native-get-random-values';

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import CryptoJS from 'crypto-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Calendar from 'expo-calendar';
import * as FileSystem from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { GoogleAuthProvider, linkWithCredential, OAuthProvider, signInWithCredential } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
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
  onBackup: () => void;
  onDeleteAccount: () => void;
  sharedRooms: { [layerName: string]: string };
  onAddSharedRoom: (layerName: string, roomId: string) => void;
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
  onBackup,
  onDeleteAccount,
  sharedRooms,
  onAddSharedRoom,
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

  const [isCalendarSyncEnabled, setIsCalendarSyncEnabled] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [isPinSetupVisible, setIsPinSetupVisible] = useState(false);
  const [pinInput, setPinInput] = useState("");

  const [createRoomVisible, setCreateRoomVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  
  const [joinRoomVisible, setJoinRoomVisible] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinRoomName, setJoinRoomName] = useState("");

  const [shareRoomListVisible, setShareRoomListVisible] = useState(false);

  // 🌟 追加：作成完了後の情報を表示するためのステート
  const [showCreatedRoomInfoVisible, setShowCreatedRoomInfoVisible] = useState(false);
  const [createdRoomName, setCreatedRoomName] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAnonymous(user?.isAnonymous ?? true);
    });

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

      if (id_token && auth.currentUser) {
        const credential = GoogleAuthProvider.credential(id_token);
        try {
          // 1. まずは新しいデータとの「連携」を試みる
          await linkWithCredential(auth.currentUser, credential);
          setIsAnonymous(false);
          Alert.alert("連携完了", "アカウントと紐付けられ、データが保護されました。");
        } catch (linkError: any) {
          // 🌟 2. 既に連携済み（＝機種変更してきたユーザー）の場合、引き継ぎ処理へ
          if (linkError.code === "auth/credential-already-in-use") {
            Alert.alert(
              "データ引き継ぎ",
              "このアカウントには過去のデータがあります。この端末に引き継ぎますか？",
              [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "引き継ぐ",
                  onPress: async () => {
                    await signInWithCredential(auth, credential);
                    setIsAnonymous(false);
                    Alert.alert("完了", "引き継ぎました！「クラウドからデータを復元」を押してください。");
                  }
                }
              ]
            );
          } else {
            throw linkError; // その他のエラーは外のcatchへ
          }
        }
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      Alert.alert("エラー", "アカウント連携をキャンセル、または失敗しました。");
    } finally {
      setIsLinking(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLinking(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken && auth.currentUser) {
        const provider = new OAuthProvider('apple.com');
        const firebaseCredential = provider.credential({
          idToken: credential.identityToken,
        });

        try {
          await linkWithCredential(auth.currentUser, firebaseCredential);
          setIsAnonymous(false);
          Alert.alert("連携完了", "Appleアカウントと紐付けられ、データが保護されました。");
        } catch (linkError: any) {
          // 🌟 機種変更ユーザーの場合
          if (linkError.code === "auth/credential-already-in-use") {
            Alert.alert(
              "データ引き継ぎ",
              "このAppleアカウントには過去のデータがあります。引き継ぎますか？",
              [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "引き継ぐ",
                  onPress: async () => {
                    await signInWithCredential(auth, firebaseCredential);
                    setIsAnonymous(false);
                    Alert.alert("完了", "引き継ぎました！「クラウドからデータを復元」を押してください。");
                  }
                }
              ]
            );
          } else {
            throw linkError;
          }
        }
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        console.error(e);
        Alert.alert("エラー", "Appleでのログインに失敗しました。");
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

  const handleCalendarSyncToggle = async (value: boolean) => {
    if (value) {
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
      setIsPinSetupVisible(true);
    } else {
      setIsPinEnabled(false);
      await AsyncStorage.setItem("usePinLock", "false");
      await SecureStore.deleteItemAsync("app_pin_code");
    }
  };

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
      const dataStr = await AsyncStorage.getItem("myScheduleData");
      if (!dataStr) {
        Alert.alert("エラー", "出力するデータが見つかりません。");
        return;
      }

      const scheduleData = JSON.parse(dataStr);
      let csvContent = "\uFEFF日付,タイトル,タイプ,金額(円),ステータス\n";

      Object.keys(scheduleData).forEach(date => {
        scheduleData[date].forEach((item: any) => {
          const title = item.title ? item.title.replace(/,/g, "，") : "名称未設定";
          let type = "その他";
          if (item.isEvent) type = "予定";
          if (item.isTodo) type = "ToDo";
          if (item.amount) type = "家計簿";

          const amount = item.amount || 0;
          const status = item.isDone ? "完了" : "未完了";

          csvContent += `${date},${title},${type},${amount},${status}\n`;
        });
      });

      const FS: any = FileSystem;
      const fileUri = FS.documentDirectory + "UniCal_Data.csv";

      await FS.writeAsStringAsync(fileUri, csvContent, {
        encoding: FS.EncodingType.UTF8
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'UniCalのデータをエクスポート',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert("エラー", "この端末では共有機能がサポートされていません。");
      }

    } catch (error) {
      console.error("CSV Export Error:", error);
      Alert.alert("エラー", "CSVの作成に失敗しました。");
    }
  };

  const handleShareRoom = async (roomName: string, roomId: string) => {
    try {
      await Share.share({
        message: `【UniCal】「${roomName}」の共有カレンダーに参加しよう！\n\nアプリを開いて以下のIDかURLを入力してね。\nID: ${roomId}\nリンク: unical://join?room=${roomId}`,
        title: "カレンダーの共有",
      });
      setShareRoomListVisible(false);
    } catch (error) {
      Alert.alert("エラー", "共有に失敗しました。");
    }
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    
    // IDの生成と登録
    const generatedRoomId = "room_" + CryptoJS.lib.WordArray.random(8).toString();
    onAddSharedRoom(newRoomName.trim(), generatedRoomId);
    
    // 🌟 変更：作成画面を閉じて、新しい「作成完了ポップアップ」を開く準備をする
    setCreatedRoomName(newRoomName.trim());
    setCreatedRoomId(generatedRoomId);
    setNewRoomName("");
    setCreateRoomVisible(false);
    
    // 少し遅延させてから完了画面を開く（モーダルの重なりエラーを防ぐため）
    setTimeout(() => {
      setShowCreatedRoomInfoVisible(true);
    }, 400);
  };

  const handleJoinRoom = () => {
    if (!joinRoomName.trim() || !joinRoomId.trim()) return;
    
    let extractedId = joinRoomId.trim();
    
    if (extractedId.includes("room=")) {
      extractedId = extractedId.split("room=")[1].split("&")[0];
    }
    
    onAddSharedRoom(joinRoomName.trim(), extractedId);
    setJoinRoomVisible(false);
    setJoinRoomId("");
    setJoinRoomName("");
    Alert.alert("参加完了", "共有カレンダーをレイヤーに追加しました！");
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

              <Text style={styles.sectionLabel}>SHARED CALENDAR</Text>
              <View style={styles.card}>
                <TouchableOpacity style={styles.row} onPress={() => setCreateRoomVisible(true)}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                    <Text style={[styles.rowText, { color: "#007AFF", fontWeight: "bold" }]}>共有カレンダーを作成</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.row, styles.borderTop]} onPress={() => setShareRoomListVisible(true)}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="share-social-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>招待リンクを送信</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.row, styles.borderTop]} onPress={() => setJoinRoomVisible(true)}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="enter-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>共有カレンダーに参加</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>INTEGRATION</Text>
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
                    {isAnonymous ? "ゲスト (未連携)" : "クラウド 連携済"}
                  </Text>
                </View>

                {/* 🌟 変更：匿名ユーザーの場合はAppleとGoogleの両方を表示 */}
                {isAnonymous && (
                  <>
                    {/* Apple サインインボタン */}
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity style={[styles.row, styles.borderTop]} disabled={isLinking} onPress={handleAppleSignIn}>
                        <View style={styles.rowLeft}>
                          <Ionicons name="logo-apple" size={20} color="#1C1C1E" />
                          <Text style={styles.rowText}>Appleでデータを保護</Text>
                        </View>
                        {isLinking ? <ActivityIndicator size="small" color="#1C1C1E" /> : <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
                      </TouchableOpacity>
                    )}

                    {/* Google サインインボタン */}
                    <TouchableOpacity style={[styles.row, styles.borderTop]} disabled={isLinking} onPress={handleGoogleSignIn}>
                      <View style={styles.rowLeft}>
                        <Ionicons name="logo-google" size={20} color="#1C1C1E" />
                        <Text style={styles.rowText}>Googleでデータを保護</Text>
                      </View>
                      {isLinking ? <ActivityIndicator size="small" color="#1C1C1E" /> : <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
                    </TouchableOpacity>
                  </>
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
                    <Ionicons name="time-outline" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>最終同期</Text>
                  </View>
                  <Text style={styles.timeText}>
                    {lastSyncedAt ? lastSyncedAt : "未同期"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.row, styles.borderTop]}
                  onPress={onBackup}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="cloud-upload-outline" size={20} color="#007AFF" />
                    <Text style={[styles.rowText, { color: "#007AFF", fontWeight: "bold" }]}>
                      手動でバックアップ
                    </Text>
                  </View>
                </TouchableOpacity>

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

              <Text style={[styles.sectionLabel, { marginTop: 20, color: "#FF3B30" }]}>DANGER ZONE</Text>
              <View style={[styles.card, { borderColor: "#FF3B30", borderWidth: 1 }]}>
                <TouchableOpacity style={styles.row} onPress={onDeleteAccount}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    <Text style={[styles.rowText, { color: "#FF3B30", fontWeight: "bold" }]}>アカウントとデータを削除</Text>
                  </View>
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

      {/* PIN設定用モーダル */}
      <Modal visible={isPinSetupVisible} transparent={true} animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.content, { maxHeight: 350 }]}>
            <Text style={styles.title}>PIN SETTING</Text>
            <Text style={styles.subTitle}>新しい暗証番号を決めてください</Text>

            <View style={styles.pinInputWrapper}>
              <TextInput
                style={styles.hiddenTextInput}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
                value={pinInput}
                onChangeText={setPinInput}
              />
              <View style={styles.pinDisplayContainer}>
                {[...Array(4)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pinBox,
                      pinInput.length === i && styles.pinBoxFocused
                    ]}
                  >
                    {pinInput.length > i && (
                      <Text style={styles.pinDot}>●</Text>
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

      {/* 🌟 1. 共有カレンダー作成モーダル */}
      <Modal visible={createRoomVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.overlay}>
            <View style={styles.subModalContent}>
              <Text style={styles.title}>NEW SHARED ROOM</Text>
              <Text style={styles.subTitle}>新しい共有レイヤーの名前を決めてください</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="例：ゼミ合宿、家族の予定" 
                placeholderTextColor="#C7C7CC" 
                autoFocus 
                value={newRoomName} 
                onChangeText={setNewRoomName} 
              />
              <View style={styles.modalActionRow}>
                <TouchableOpacity onPress={() => setCreateRoomVisible(false)}><Text style={styles.cancelText}>キャンセル</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateRoom}><Text style={styles.saveBtnText}>作成</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🌟 2. 共有カレンダー参加モーダル */}
      <Modal visible={joinRoomVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.overlay}>
            <View style={styles.subModalContent}>
              <Text style={styles.title}>JOIN SHARED ROOM</Text>
              <Text style={styles.subTitle}>送られたURLかIDを貼り付けてください</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="URL または ID" 
                placeholderTextColor="#C7C7CC" 
                autoFocus 
                value={joinRoomId} 
                onChangeText={setJoinRoomId} 
              />
              <Text style={[styles.subTitle, {marginTop: 15}]}>自分のアプリでの表示名（レイヤー名）</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="例：サークル用カレンダー" 
                placeholderTextColor="#C7C7CC" 
                value={joinRoomName} 
                onChangeText={setJoinRoomName} 
              />
              <View style={styles.modalActionRow}>
                <TouchableOpacity onPress={() => setJoinRoomVisible(false)}><Text style={styles.cancelText}>キャンセル</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleJoinRoom}><Text style={styles.saveBtnText}>参加</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🌟 3. リンク送信先選択モーダル */}
      <Modal visible={shareRoomListVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.subModalContent, { paddingBottom: 40 }]}>
            <Text style={styles.title}>SHARE LINK</Text>
            <Text style={styles.subTitle}>招待したいカレンダーを選んでください</Text>
            <ScrollView style={{ marginTop: 20, maxHeight: 200 }}>
              {Object.keys(sharedRooms).length === 0 && (
                <Text style={{ textAlign: "center", color: "#8E8E93", marginVertical: 20 }}>共有カレンダーがありません</Text>
              )}
              {Object.entries(sharedRooms).map(([name, roomId]) => (
                <TouchableOpacity key={roomId} style={styles.roomListItem} onPress={() => handleShareRoom(name, roomId)}>
                  <Ionicons name="cloud-outline" size={20} color="#007AFF" />
                  <Text style={styles.roomListText}>{name}</Text>
                  <Ionicons name="share-outline" size={18} color="#C7C7CC" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, { marginTop: 20, width: "100%", alignItems: 'center' }]} onPress={() => setShareRoomListVisible(false)}>
              <Text style={styles.saveBtnText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🌟 4. 新規追加：作成完了＆ID確認モーダル（URLが使えない人向け） */}
      <Modal visible={showCreatedRoomInfoVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.subModalContent}>
            
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <Ionicons name="checkmark-circle" size={50} color="#34C759" />
              <Text style={[styles.title, { marginTop: 10 }]}>作成完了！</Text>
              <Text style={[styles.subTitle, { textAlign: "center", marginTop: 5 }]}>
                カレンダーを共有するには、以下の情報をメンバーに伝えてください。
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: "#8E8E93", fontWeight: "bold", marginBottom: 5 }}>カレンダー名</Text>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#1C1C1E", marginBottom: 20 }}>{createdRoomName}</Text>

            <Text style={{ fontSize: 12, color: "#8E8E93", fontWeight: "bold", marginBottom: 5 }}>ルームID (長押しでコピー)</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F7", padding: 15, borderRadius: 12 }}>
              <Text 
                style={{ flex: 1, fontSize: 16, fontWeight: "bold", color: "#1C1C1E", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }} 
                selectable={true} 
              >
                {createdRoomId}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: 25, width: "100%", alignItems: "center" }]}
              onPress={() => setShowCreatedRoomInfoVisible(false)}
            >
              <Text style={styles.saveBtnText}>閉じる</Text>
            </TouchableOpacity>

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
  
  subModalContent: { backgroundColor: "#FFF", width: "90%", alignSelf: "center", borderRadius: 20, padding: 24, marginBottom: "50%", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 },
  inputField: { backgroundColor: "#F2F2F7", padding: 15, borderRadius: 12, marginTop: 15, fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  modalActionRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 20, gap: 15 },
  cancelText: { fontSize: 14, fontWeight: "700", color: "#8E8E93", padding: 10 },
  saveBtn: { backgroundColor: "#1C1C1E", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  saveBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  roomListItem: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5EA", gap: 10 },
  roomListText: { flex: 1, fontSize: 16, fontWeight: "600", color: "#1C1C1E" }
});