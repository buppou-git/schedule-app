import "react-native-get-random-values";

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { auth } from "../../../../firebaseConfig";

import { AccountSection } from "./AccountSection";
import { styles } from "./ConfigModal.styles";
import { RoomSection } from "./RoomSection";
import { SecuritySection } from "./SecuritySection";
import { SyncAndBackupSection } from "./SyncAndBackupSection";

interface ConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onExternalSyncChange?: (val: boolean) => void;
  lastSyncedAt: string | null;
  onRestore: () => void;
  onBackup: () => void;
  onDeleteAccount: () => void;
  sharedRooms: { [layerName: string]: string };
  onAddSharedRoom: (layerName: string, roomId: string) => void;
  onDeleteSharedRoom: (layerName: string) => void;
}

const WEB_CLIENT_ID =
  "633661996714-j5cb16hjn156oeqf51pi384e0hh7b158.apps.googleusercontent.com";

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
});

export default function ConfigModal({
  visible,
  onClose,
  onExternalSyncChange,
  lastSyncedAt,
  onRestore,
  onBackup,
  onDeleteAccount,
  sharedRooms,
  onAddSharedRoom,
}: ConfigModalProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (visible) {
      // 開くアニメーションが終わってから中身を描画する指示
      const task = InteractionManager.runAfterInteractions(() => {
        setIsReady(true);
      });
      return () => task.cancel();
    } else {
      setIsReady(false);
    }
  }, [visible]);

  const [isLinking, setIsLinking] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(
    auth.currentUser?.isAnonymous ?? true,
  );

  const [isCalendarSyncEnabled, setIsCalendarSyncEnabled] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isPinEnabled, setIsPinEnabled] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAnonymous(user?.isAnonymous ?? true);
    });

    // 🌟 修正：Promise.all で同時に読み込み、setStateの回数を減らす
    const loadSettings = async () => {
      const [calendar, bio, pin] = await Promise.all([
        AsyncStorage.getItem("externalCalendarSync"),
        AsyncStorage.getItem("useBiometricLock"),
        AsyncStorage.getItem("usePinLock"),
      ]);

      setIsCalendarSyncEnabled(calendar === "true");
      setIsBiometricEnabled(bio === "true");
      setIsPinEnabled(pin === "true");
    };

    loadSettings();

    return unsubscribe;
  }, []);

  return (
    <>
      {/* 🌟 変更：animationType="none" にしてカクつきを防ぐ */}
      <Modal visible={visible} transparent={true} animationType="none">
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

              {/* 🌟 追加：準備ができるまではローディングを表示 */}
              {!isReady ? (
                <View
                  style={{
                    height: 300,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color="#1C1C1E" />
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  <RoomSection
                    sharedRooms={sharedRooms}
                    onAddSharedRoom={onAddSharedRoom}
                  />

                  <AccountSection
                    isAnonymous={isAnonymous}
                    setIsAnonymous={setIsAnonymous}
                    onDeleteAccount={onDeleteAccount}
                  />

                  <SecuritySection
                    isBiometricEnabled={isBiometricEnabled}
                    setIsBiometricEnabled={setIsBiometricEnabled}
                    isPinEnabled={isPinEnabled}
                    setIsPinEnabled={setIsPinEnabled}
                  />

                  <SyncAndBackupSection
                    isCalendarSyncEnabled={isCalendarSyncEnabled}
                    setIsCalendarSyncEnabled={(val) => {
                      setIsCalendarSyncEnabled(val);
                      // 🌟 追加：スイッチが切り替わった瞬間に親（index.tsx）に報告する
                      if (onExternalSyncChange) onExternalSyncChange(val);
                    }}
                    lastSyncedAt={lastSyncedAt}
                    onRestore={onRestore}
                    onBackup={onBackup}
                  />

                  <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                    LEGAL
                  </Text>
                  <View style={styles.card}>
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() =>
                        Linking.openURL(
                          "https://www.notion.so/3466f7789c6e806f8880ed9241a38b99?source=copy_link",
                        )
                      }
                    >
                      <View style={styles.rowLeft}>
                        <Ionicons
                          name="document-text-outline"
                          size={20}
                          color="#1C1C1E"
                        />
                        <Text style={styles.rowText}>利用規約</Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#C7C7CC"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.row, styles.borderTop]}
                      onPress={() =>
                        Linking.openURL(
                          "https://www.notion.so/3466f7789c6e80958ff2e31ae7f89e16?source=copy_link",
                        )
                      }
                    >
                      <View style={styles.rowLeft}>
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={20}
                          color="#1C1C1E"
                        />
                        <Text style={styles.rowText}>プライバシーポリシー</Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#C7C7CC"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.copyright}>
                    UniCal
                  </Text>

                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
