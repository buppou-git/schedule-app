import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";

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
  // 🌟 追加：引数に scheduleCount を追加
  const scheduleDailyNotification = async (
    time: Date,
    scheduleCount: number = 0,
  ) => {
    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return false;

    await Notifications.cancelAllScheduledNotificationsAsync();

    // 🌟 型定義を修正：type: 'daily' を明示
    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.getHours(),
      minute: time.getMinutes(),
      channelId: "default",
    };

    // 🌟 追加：件数に応じてメッセージを動的に変える
    const messageBody =
      scheduleCount > 0
        ? `本日は ${scheduleCount} 件の予定があります。アプリで詳細を確認しましょう！`
        : "本日は特に予定がありません。良い一日を！";

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "今日の予定を確認しよう！",
        body: messageBody, // 🌟 動的メッセージをセット
        sound: true,
      },
      trigger,
    });

    setIsNotificationEnabled(true);
    setNotificationTime(time);
    await AsyncStorage.setItem("isNotificationEnabled", "true");
    await AsyncStorage.setItem("notificationTime", time.toISOString());

    return true;
  };

  // 個別の予定の通知をセットする関数
  const scheduleItemNotification = async (
    title: string,
    body: string,
    triggerDate: Date,
  ) => {
    const hasPermission = await requestPermissionsAsync();
    if (!hasPermission) return null;

    const exactTriggerDate = new Date(triggerDate);
    exactTriggerDate.setSeconds(0, 0);
    if (exactTriggerDate.getTime() <= Date.now()) return null;

    // 🌟 型定義を修正：type: 'date' を明示
    const trigger: Notifications.DateTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE, // ここがポイント！
      date: exactTriggerDate,
      channelId: "default",
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: true,
      },
      trigger,
    });
    return id;
  };

  // 個別の予定の通知をキャンセルする関数
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
