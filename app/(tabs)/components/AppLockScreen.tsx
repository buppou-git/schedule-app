import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

interface AppLockScreenProps {
  currentSolidColor: string;
  pinForUnlock: string;
  setPinForUnlock: (text: string) => void;
  authenticatePin: (pin: string) => void;
  handleAuthenticate: () => void;
}

export default function AppLockScreen({
  currentSolidColor,
  pinForUnlock,
  setPinForUnlock,
  authenticatePin,
  handleAuthenticate,
}: AppLockScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="lock-closed" size={50} color={currentSolidColor} />
        <Text style={styles.title}>UniCal Locked</Text>
        <Text style={styles.subTitle}>パスコードを入力してください</Text>

        <View style={styles.pinInputWrapper}>
          <TextInput
            style={styles.hiddenTextInput}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            autoFocus
            value={pinForUnlock}
            onChangeText={(text) => {
              setPinForUnlock(text);
              if (text.length === 4) authenticatePin(text);
            }}
          />
          <View style={styles.pinDisplayContainer}>
            {[...Array(4)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pinBox,
                  pinForUnlock.length === i && styles.pinBoxFocused,
                ]}
              >
                {pinForUnlock.length > i && <Text style={styles.pinDot}>●</Text>}
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.bioBtn} onPress={handleAuthenticate}>
          <Text style={[styles.bioBtnText, { color: currentSolidColor }]}>
            生体認証を使用する
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  card: {
    backgroundColor: "#FFF",
    padding: 30,
    borderRadius: 30,
    alignItems: "center",
    width: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  title: { marginTop: 15, fontSize: 18, fontWeight: "800", color: "#1C1C1E" },
  subTitle: { fontSize: 12, color: "#8E8E93", marginBottom: 25, marginTop: 5 },
  pinInputWrapper: {
    marginTop: 10,
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  hiddenTextInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
    zIndex: 1,
  },
  pinDisplayContainer: { flexDirection: "row", gap: 15 },
  pinBox: {
    width: 55,
    height: 65,
    borderWidth: 1,
    borderRadius: 16,
    borderColor: "#C7C7CC",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  pinBoxFocused: {
    borderColor: "#1C1C1E",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  pinDot: { fontSize: 36, color: "#1C1C1E" },
  bioBtn: { marginTop: 25, padding: 10 },
  bioBtnText: { fontWeight: "700", fontSize: 14 },
});