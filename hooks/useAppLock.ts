import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

export function useAppLock() {
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [pinForUnlock, setPinForUnlock] = useState("");
  const appState = useRef(AppState.currentState);

  const handleAuthenticate = async () => {
    const useBio = await AsyncStorage.getItem("useBiometricLock");
    const usePin = await AsyncStorage.getItem("usePinLock");

    if (useBio !== "true" && usePin !== "true") {
      setIsAppLocked(false);
      return;
    }

    // 🌟 修正：Face IDなどの認証ポップアップを出す「前」に、アプリをロック画面状態にする！
    setIsAppLocked(true);

    // 🌟 超重要：Reactが「ロック画面（AppLockScreen）」を描画し終わるのを待つ
    // これがないと、裏側にカレンダーが透けたままポップアップが出てしまいます
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (useBio === "true") {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "認証してUniCalを開く",
        fallbackLabel: "パスコードを入力",
      });
      if (result.success) {
        setIsAppLocked(false);
        setPinForUnlock("");
        return;
      }
    }
  };

  const authenticatePin = async (pin: string) => {
    const savedPin = await SecureStore.getItemAsync("app_pin_code");
    if (pin === savedPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsAppLocked(false);
      setPinForUnlock("");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("エラー", "暗証番号が違います");
      setPinForUnlock("");
    }
  };

  useEffect(() => {
    handleAuthenticate(); // 初回起動時

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // バックグラウンドから戻ってきた時
      if (appState.current === "background" && nextAppState === "active") {
        handleAuthenticate();
      }
      // バックグラウンドに行った時にロックをかける
      else if (nextAppState === "background") {
        AsyncStorage.getItem("useBiometricLock").then((val) => {
          if (val === "true") setIsAppLocked(true);
        });
        AsyncStorage.getItem("usePinLock").then((val) => {
          if (val === "true") setIsAppLocked(true);
        });
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return {
    isAppLocked,
    pinForUnlock,
    setPinForUnlock,
    handleAuthenticate,
    authenticatePin,
  };
}