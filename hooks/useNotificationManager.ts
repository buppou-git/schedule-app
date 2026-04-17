import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native"; // 🌟 Platform を追加！

// アプリを開いている最中（フォアグラウンド）に通知が来た時の振る舞い
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const useNotificationManager = () => {
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  // デフォルトの通知時間は朝の7時に設定
  const [notificationTime, setNotificationTime] = useState<Date>(
    new Date(new Date().setHours(7, 0, 0, 0)),
  );

  // アプリ起動時に、保存されている通知設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      const savedEnabled = await AsyncStorage.getItem("isNotificationEnabled");
      const savedTime = await AsyncStorage.getItem("notificationTime");

      if (savedEnabled === "true") setIsNotificationEnabled(true);
      if (savedTime) setNotificationTime(new Date(savedTime));
    };
    loadSettings();
  }, []);

  // スマホに「通知を送ってもいいですか？」と許可を求める関数
  const requestPermissionsAsync = async () => {
    if (!Device.isDevice) {
      Alert.alert(
        "エラー",
        "シミュレーターでは通知機能が使えません。実機で試してください📱",
      );
      return false;
    }

    // 🌟 追加：Android向け「通知の通り道（チャンネル）」の作成
    // これがないとAndroidは通知をブロックしてしまいます！
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      Alert.alert(
        "設定が必要です",
        "スマホの設定アプリから、このアプリの通知を許可してください🙇‍♂️",
      );
      return false;
    }
    return true;
  };

  // 毎日決まった時間に通知をセットする関数
  const scheduleDailyNotification = async (time: Date) => {
    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return false;

    // バグ（通知が何個も鳴る）を防ぐため、一旦古い通知予約を全部キャンセルする
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 新しい通知をセット
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "今日の予定を確認しよう！📅",
        body: "司令塔を開いて、今日のタスクとお金をチェックしましょう🚀",
        sound: true,
      },
      // 🌟 追加：通知の「通り道（channelId）」を指定してあげる
      trigger: {
        channelId: "default",
        hour: time.getHours(),
        minute: time.getMinutes(),
        repeats: true,
      } as any,
    });

    // 設定を保存
    setIsNotificationEnabled(true);
    setNotificationTime(time);
    await AsyncStorage.setItem("isNotificationEnabled", "true");
    await AsyncStorage.setItem("notificationTime", time.toISOString());

    return true;
  };

  const scheduleItemNotification = async (title: string, triggerDate: Date) => {
    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return null;

    // triggerDate（指定した日時）に1回だけ鳴る通知をセット！
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ リマインダー",
        body: title,
        sound: true,
      },
      // 🌟 ここを修正！「date」プロパティにして、channelIdと as any を追加！
      trigger: {
        date: triggerDate,
        channelId: "default",
      } as any,
    });
    return id; // この受付番号（ID）をScheduleItemに保存します
  };

  // 🌟 ここから追加！：個別の予定の通知をキャンセルする関数
  const cancelItemNotification = async (notificationId: string) => {
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
  };

  // 通知を完全にオフにする関数
  const cancelNotification = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    setIsNotificationEnabled(false);
    await AsyncStorage.setItem("isNotificationEnabled", "false");
  };

  return {
    isNotificationEnabled,
    notificationTime,
    scheduleDailyNotification,
    cancelNotification,
    scheduleItemNotification,
    cancelItemNotification,
  };
};
