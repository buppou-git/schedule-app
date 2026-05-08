import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { styles } from "./ConfigModal.styles";

interface SecuritySectionProps {
  isBiometricEnabled: boolean;
  setIsBiometricEnabled: (val: boolean) => void;
  isPinEnabled: boolean;
  setIsPinEnabled: (val: boolean) => void;
}

export const SecuritySection = React.memo(
  ({
    isBiometricEnabled,
    setIsBiometricEnabled,
    isPinEnabled,
    setIsPinEnabled,
  }: SecuritySectionProps) => {
    // 🌟 PIN設定用のStateもすべてこのコンポーネント内に閉じ込める！
    const [isPinSetupVisible, setIsPinSetupVisible] = useState(false);
    const [pinInput, setPinInput] = useState("");

    const handleBiometricToggle = useCallback(
      async (value: boolean) => {
        if (value) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (!hasHardware || !isEnrolled) {
            Alert.alert(
              "エラー",
              "この端末では生体認証やパスコードが設定されていません。",
            );
            return;
          }

          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "UniCalのロックを有効にする",
          });

          if (result.success) {
            setIsBiometricEnabled(true);
            await AsyncStorage.setItem("useBiometricLock", "true");
            Alert.alert(
              "セキュリティON",
              "アプリを開く際に認証が必要になりました。",
            );
          } else {
            setIsBiometricEnabled(false);
          }
        } else {
          setIsBiometricEnabled(false);
          await AsyncStorage.setItem("useBiometricLock", "false");
        }
      },
      [setIsBiometricEnabled],
    );

    const handlePinToggle = useCallback(
      async (value: boolean) => {
        if (value) {
          setIsPinSetupVisible(true);
        } else {
          setIsPinEnabled(false);
          await AsyncStorage.setItem("usePinLock", "false");
          await SecureStore.deleteItemAsync("app_pin_code");
        }
      },
      [setIsPinEnabled],
    );

    const savePin = useCallback(async () => {
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
    }, [pinInput, setIsPinEnabled]);

    return (
      <>
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

        {/* PIN設定用モーダル */}
        {isPinSetupVisible && (
          <Modal
            visible={isPinSetupVisible}
            transparent={true}
            animationType="fade"
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <View style={[styles.overlay, { justifyContent: "center" }]}>
                <View
                  style={[
                    styles.content,
                    { maxHeight: 380, marginBottom: 0, borderRadius: 24 },
                  ]}
                >
                  <Text style={styles.title}>PIN SETTING</Text>
                  <Text style={styles.subTitle}>
                    新しい暗証番号を決めてください
                  </Text>

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
                            pinInput.length === i && styles.pinBoxFocused,
                          ]}
                        >
                          {pinInput.length > i && (
                            <Text style={styles.pinDot}>●</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      gap: 16,
                      marginBottom: 20,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setIsPinSetupVisible(false);
                        setPinInput("");
                        setIsPinEnabled(false);
                      }}
                      style={{ padding: 10 }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#8E8E93",
                        }}
                      >
                        キャンセル
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={savePin}
                      style={{
                        backgroundColor: "#1C1C1E",
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#FFF",
                        }}
                      >
                        保存する
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}
      </>
    );
  },
);
