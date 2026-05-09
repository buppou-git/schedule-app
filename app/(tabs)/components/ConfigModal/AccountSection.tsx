import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  GoogleAuthProvider,
  linkWithCredential,
  OAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../../../firebaseConfig";
import { styles } from "./ConfigModal.styles";

interface AccountSectionProps {
  isAnonymous: boolean;
  // 🌟 ここを追加！親の state を更新する関数を受け取る
  setIsAnonymous: (val: boolean) => void;
  onDeleteAccount: () => void;
}

export const AccountSection = React.memo(
  ({ isAnonymous, setIsAnonymous, onDeleteAccount }: AccountSectionProps) => {
    const [isLinking, setIsLinking] = useState(false);

    // 🌟 Googleログインロジック
    const handleGoogleSignIn = useCallback(async () => {
      setIsLinking(true);
      try {
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();
        const typedResponse = response as any;
        const id_token = typedResponse.data?.idToken || typedResponse.idToken;

        if (id_token && auth.currentUser) {
          const credential = GoogleAuthProvider.credential(id_token);
          try {
            await linkWithCredential(auth.currentUser, credential);
            setIsAnonymous(false); // 🌟 連携成功時に親の State を更新
            Alert.alert(
              "連携完了",
              "アカウントと紐付けられ、データが保護されました。",
            );
          } catch (linkError: any) {
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
                      setIsAnonymous(false); // 🌟 引き継ぎ成功時に親の State を更新
                      Alert.alert(
                        "完了",
                        "引き継ぎました！「クラウドからデータを復元」を押してください。",
                      );
                    },
                  },
                ],
              );
            } else {
              console.error("Google link error:", linkError);
              Alert.alert("エラー", "アカウント連携に失敗しました。");
            }
          }
        }
      } catch (error: any) {
        if (error.code !== "ASYNC_OP_IN_PROGRESS") {
          console.error("Google login error:", error);
          Alert.alert("エラー", "アカウント連携をキャンセル、または失敗しました。");
        }
      } finally {
        setIsLinking(false);
      }
    }, [setIsAnonymous]);

    // 🌟 Appleログインロジック
    const handleAppleSignIn = useCallback(async () => {
      setIsLinking(true);
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        if (credential.identityToken && auth.currentUser) {
          const provider = new OAuthProvider("apple.com");
          const firebaseCredential = provider.credential({
            idToken: credential.identityToken,
          });

          try {
            await linkWithCredential(auth.currentUser, firebaseCredential);
            setIsAnonymous(false); // 🌟 連携成功時に親の State を更新
            Alert.alert(
              "連携完了",
              "Appleアカウントと紐付けられ、データが保護されました。",
            );
          } catch (linkError: any) {
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
                      setIsAnonymous(false); // 🌟 引き継ぎ成功時に親の State を更新
                      Alert.alert(
                        "完了",
                        "引き継ぎました！「クラウドからデータを復元」を押してください。",
                      );
                    },
                  },
                ],
              );
            } else {
              console.error("Apple link error:", linkError);
              Alert.alert("エラー", "アカウント連携に失敗しました。");
            }
          }
        }
      } catch (error: any) {
        if (error.code !== "ERR_CANCELED") {
          console.error("Apple login error:", error);
          Alert.alert("エラー", "アカウント連携をキャンセル、または失敗しました。");
        }
      } finally {
        setIsLinking(false);
      }
    }, [setIsAnonymous]);

    return (
      <>
        {/* 🌟 ACCOUNT セクション */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name="person-circle-outline"
                size={20}
                color="#1C1C1E"
              />
              <Text style={styles.rowText}>ステータス</Text>
            </View>
            <Text
              style={[
                styles.timeText,
                {
                  color: isAnonymous ? "#8E8E93" : "#34C759",
                  fontWeight: "bold",
                },
              ]}
            >
              {isAnonymous ? "ゲスト (未連携)" : "クラウド 連携済"}
            </Text>
          </View>

          {isAnonymous && (
            <>
              {Platform.OS === "ios" && (
                <TouchableOpacity
                  style={[styles.row, styles.borderTop]}
                  disabled={isLinking}
                  onPress={handleAppleSignIn}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="logo-apple" size={20} color="#1C1C1E" />
                    <Text style={styles.rowText}>Appleでデータを保護</Text>
                  </View>
                  {isLinking ? (
                    <ActivityIndicator size="small" color="#1C1C1E" />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#C7C7CC"
                    />
                  )}
                </TouchableOpacity>
              )}

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
            </>
          )}
        </View>

        {/* 🌟 DANGER ZONE セクション */}
        <Text
          style={[styles.sectionLabel, { marginTop: 20, color: "#FF3B30" }]}
        >
          DANGER ZONE
        </Text>
        <View style={[styles.card, { borderColor: "#FF3B30", borderWidth: 1 }]}>
          <TouchableOpacity style={styles.row} onPress={onDeleteAccount}>
            <View style={styles.rowLeft}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text
                style={[
                  styles.rowText,
                  { color: "#FF3B30", fontWeight: "bold" },
                ]}
              >
                アカウントとデータを削除
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </>
    );
  },
);