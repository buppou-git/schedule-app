import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import CryptoJS from "crypto-js";
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
        const typedResponse = response as {
          data?: { idToken: string | null };
          idToken?: string | null;
        };
        const id_token = typedResponse.data?.idToken || typedResponse.idToken;

        if (id_token && auth.currentUser) {
          const credential = GoogleAuthProvider.credential(id_token);
          try {
            await linkWithCredential(auth.currentUser, credential);
            setIsAnonymous(false);
            Alert.alert(
              "連携完了",
              "アカウントと紐付けられ、データが保護されました。",
            );
          } catch (linkError: unknown) {
            // 🌟 unknown に変更
            const err = linkError as { code?: string }; // 🌟 エラーコードを取り出す準備
            if (err.code === "auth/credential-already-in-use") {
              Alert.alert(
                "データ引き継ぎ",
                "このアカウントには過去のデータがあります。この端末に引き継ぎますか？",
                [
                  { text: "キャンセル", style: "cancel" },
                  {
                    text: "引き継ぐ",
                    onPress: async () => {
                      setIsLinking(true);
                      try {
                        await signInWithCredential(auth, credential);
                        setIsAnonymous(false); // 🌟 引き継ぎ成功時に親の State を更新
                        Alert.alert(
                          "完了",
                          "引き継ぎました！「クラウドからデータを復元」を押してください。",
                        );
                      } catch (error: unknown) {
                        Alert.alert(
                          "エラー",
                          "引き継ぎに失敗しました。もう一度連携ボタンを押してください。",
                        );
                      } finally {
                        setIsLinking(false);
                      }
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
      } catch (error: unknown) {
        // 🌟 unknown に変更
        const err = error as { code?: string };
        if (err.code !== "ASYNC_OP_IN_PROGRESS") {
          console.error("Google login error:", err); // 🌟 エラー本体ではなくerrを出力
          Alert.alert(
            "エラー",
            "アカウント連携をキャンセル、または失敗しました。",
          );
        }
      } finally {
        setIsLinking(false);
      }
    }, [setIsAnonymous]);

    // 🌟 Appleログインロジック
    const handleAppleSignIn = useCallback(async () => {
      setIsLinking(true);
      try {
        // 1. 初回のNonce作成
        const rawNonce =
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);
        const hashedNonce = CryptoJS.SHA256(rawNonce).toString(
          CryptoJS.enc.Hex,
        );

        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce,
        });

        if (credential.identityToken && auth.currentUser) {
          const provider = new OAuthProvider("apple.com");
          const firebaseCredential = provider.credential({
            idToken: credential.identityToken,
            rawNonce: rawNonce,
          });

          try {
            await linkWithCredential(auth.currentUser, firebaseCredential);
            setIsAnonymous(false);
            Alert.alert(
              "連携完了",
              "Appleアカウントと紐付けられ、データが保護されました。",
            );
          } catch (linkError: unknown) {
            const err = linkError as { code?: string };
            if (err.code === "auth/credential-already-in-use") {
              Alert.alert(
                "データ引き継ぎ",
                "このAppleアカウントには過去のデータがあります。引き継ぎますか？",
                [
                  { text: "キャンセル", style: "cancel" },
                  {
                    text: "引き継ぐ",
                    onPress: async () => {
                      setIsLinking(true);
                      try {
                        // 🌟 重要：引き継ぎ（再ログイン）用にもう一度「新品のNonce」と「新品のトークン」を取得する
                        const newRawNonce =
                          Math.random().toString(36).substring(2, 15) +
                          Math.random().toString(36).substring(2, 15);
                        const newHashedNonce = CryptoJS.SHA256(
                          newRawNonce,
                        ).toString(CryptoJS.enc.Hex);

                        const newCredential =
                          await AppleAuthentication.signInAsync({
                            requestedScopes: [
                              AppleAuthentication.AppleAuthenticationScope
                                .FULL_NAME,
                              AppleAuthentication.AppleAuthenticationScope
                                .EMAIL,
                            ],
                            nonce: newHashedNonce,
                          });

                        if (newCredential.identityToken) {
                          // 新しいトークンでクレデンシャルを再作成
                          const newFirebaseCredential = provider.credential({
                            idToken: newCredential.identityToken,
                            rawNonce: newRawNonce,
                          });

                          // 新しいクレデンシャルでサインインを実行
                          await signInWithCredential(
                            auth,
                            newFirebaseCredential,
                          );
                          setIsAnonymous(false);
                          Alert.alert(
                            "完了",
                            "引き継ぎました！「クラウドからデータを復元」を押してください。",
                          );
                        }
                      } catch (error: unknown) {
                        const signInErr = error as { code?: string };
                        if (signInErr.code !== "ERR_CANCELED") {
                          Alert.alert(
                            "引き継ぎエラー",
                            "再認証に失敗しました。もう一度お試しください。",
                          );
                        }
                      } finally {
                        setIsLinking(false);
                      }
                    },
                  },
                ],
              );
            } else {
              Alert.alert("エラー", "アカウント連携に失敗しました。");
            }
          }
        }
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code !== "ERR_CANCELED") {
          Alert.alert("エラー", "キャンセル、または失敗しました。");
        }
      } finally {
        setIsLinking(false);
      }
    }, [setIsAnonymous]);

    return (
      <>
        {/* 🌟 ACCOUNT セクション（marginTop: 35 で上のセクションと綺麗に離しました！） */}
        <Text style={[styles.sectionLabel, { marginTop: 35 }]}>ACCOUNT</Text>
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
