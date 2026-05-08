import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Share,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { styles } from "./ConfigModal.styles";

// 🌟 ConfigModal (親) から受け取るデータを定義
interface RoomSectionProps {
  sharedRooms: { [layerName: string]: string };
  onAddSharedRoom: (layerName: string, roomId: string) => void;
}

export const RoomSection = React.memo(
  ({ sharedRooms, onAddSharedRoom }: RoomSectionProps) => {
    // 🌟 部屋（Room）関連の 9つのState をこのファイルに集約
    const [createRoomVisible, setCreateRoomVisible] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");

    const [joinRoomVisible, setJoinRoomVisible] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState("");
    const [joinRoomName, setJoinRoomName] = useState("");

    const [shareRoomListVisible, setShareRoomListVisible] = useState(false);

    const [showCreatedRoomInfoVisible, setShowCreatedRoomInfoVisible] =
      useState(false);
    const [createdRoomName, setCreatedRoomName] = useState("");
    const [createdRoomId, setCreatedRoomId] = useState("");

    // 🌟 各種関数も useCallback で包んで移動
    const handleShareRoom = useCallback(
      async (roomName: string, roomId: string) => {
        try {
          await Share.share({
            message: `【UniCal】「${roomName}」の共有カレンダーに参加しよう！\n\nアプリを開いて以下のIDかURLを入力してね。\nID: ${roomId}\nリンク: unical://join?room=${roomId}`,
            title: "カレンダーの共有",
          });
          setShareRoomListVisible(false);
        } catch (error) {
          Alert.alert("エラー", "共有に失敗しました。");
        }
      },
      [],
    );

    const handleCreateRoom = useCallback(() => {
      if (!newRoomName.trim()) return;

      const generatedRoomId =
        "room_" +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 8);
      onAddSharedRoom(newRoomName.trim(), generatedRoomId);

      setCreatedRoomName(newRoomName.trim());
      setCreatedRoomId(generatedRoomId);
      setNewRoomName("");
      setCreateRoomVisible(false);

      setTimeout(() => {
        setShowCreatedRoomInfoVisible(true);
      }, 400);
    }, [newRoomName, onAddSharedRoom]);

    const handleJoinRoom = useCallback(() => {
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
    }, [joinRoomId, joinRoomName, onAddSharedRoom]);

    return (
      <>
        {/* 🌟 設定画面上の「SHARED CALENDAR」項目 */}
        <Text style={styles.sectionLabel}>SHARED CALENDAR</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setCreateRoomVisible(true)}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
              <Text
                style={[
                  styles.rowText,
                  { color: "#007AFF", fontWeight: "bold" },
                ]}
              >
                共有カレンダーを作成
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.borderTop]}
            onPress={() => setShareRoomListVisible(true)}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="share-social-outline" size={20} color="#1C1C1E" />
              <Text style={styles.rowText}>招待リンクを送信</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.borderTop]}
            onPress={() => setJoinRoomVisible(true)}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="enter-outline" size={20} color="#1C1C1E" />
              <Text style={styles.rowText}>リンク・IDで参加</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* 🌟 1. 共有カレンダー作成モーダル */}
        {createRoomVisible && (
          <Modal visible={createRoomVisible} transparent animationType="fade">
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <View style={[styles.overlay, { justifyContent: "center" }]}>
                <View style={[styles.subModalContent, { marginBottom: 0 }]}>
                  <Text style={styles.title}>NEW SHARED ROOM</Text>
                  <Text style={styles.subTitle}>
                    共有レイヤーの名前を決めてください
                  </Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="例：ゼミ、家族"
                    placeholderTextColor="#C7C7CC"
                    autoFocus
                    value={newRoomName}
                    onChangeText={setNewRoomName}
                  />
                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      onPress={() => setCreateRoomVisible(false)}
                    >
                      <Text style={styles.cancelText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={handleCreateRoom}
                    >
                      <Text style={styles.saveBtnText}>作成</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* 🌟 2. 共有カレンダー参加モーダル */}
        {joinRoomVisible && (
          <Modal visible={joinRoomVisible} transparent animationType="fade">
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
            >
              <View style={[styles.overlay, { justifyContent: "center" }]}>
                <View style={[styles.subModalContent, { marginBottom: 0 }]}>
                  <Text style={styles.title}>JOIN SHARED ROOM</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="URL または ID"
                    placeholderTextColor="#C7C7CC"
                    autoFocus
                    value={joinRoomId}
                    onChangeText={setJoinRoomId}
                  />
                  <TextInput
                    style={[styles.inputField, { marginTop: 10 }]}
                    placeholder="表示名（カテゴリ名）"
                    placeholderTextColor="#C7C7CC"
                    value={joinRoomName}
                    onChangeText={setJoinRoomName}
                  />
                  <View style={styles.modalActionRow}>
                    <TouchableOpacity onPress={() => setJoinRoomVisible(false)}>
                      <Text style={styles.cancelText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={handleJoinRoom}
                    >
                      <Text style={styles.saveBtnText}>参加</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* 🌟 3. リンク送信先選択モーダル */}
        {shareRoomListVisible && (
          <Modal
            visible={shareRoomListVisible}
            transparent
            animationType="slide"
          >
            <View style={[styles.overlay, { justifyContent: "center" }]}>
              <View
                style={[
                  styles.subModalContent,
                  { paddingBottom: 40, marginBottom: 0 },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                  }}
                >
                  <Text style={styles.title}>共有するカレンダーを選択</Text>
                  <TouchableOpacity
                    onPress={() => setShareRoomListVisible(false)}
                  >
                    <Ionicons name="close-circle" size={24} color="#C7C7CC" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 300 }}>
                  {Object.keys(sharedRooms).length === 0 ? (
                    <Text
                      style={{
                        textAlign: "center",
                        color: "#8E8E93",
                        marginTop: 20,
                      }}
                    >
                      共有中のカレンダーはありません
                    </Text>
                  ) : (
                    Object.keys(sharedRooms).map((layerName) => (
                      <TouchableOpacity
                        key={layerName}
                        style={{
                          paddingVertical: 15,
                          borderBottomWidth: 1,
                          borderBottomColor: "#F2F2F7",
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                        onPress={() =>
                          handleShareRoom(layerName, sharedRooms[layerName])
                        }
                      >
                        <View>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "bold",
                              color: "#1C1C1E",
                            }}
                          >
                            {layerName}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: "#8E8E93",
                              marginTop: 4,
                            }}
                          >
                            ID: {sharedRooms[layerName]}
                          </Text>
                        </View>
                        <Ionicons
                          name="share-outline"
                          size={20}
                          color="#007AFF"
                        />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* 🌟 4. 新規作成完了ポップアップ */}
        {showCreatedRoomInfoVisible && (
          <Modal
            visible={showCreatedRoomInfoVisible}
            transparent
            animationType="fade"
          >
            <View style={[styles.overlay, { justifyContent: "center" }]}>
              <View style={[styles.subModalContent, { marginBottom: 0 }]}>
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <Ionicons name="checkmark-circle" size={50} color="#34C759" />
                  <Text style={[styles.title, { marginTop: 10 }]}>
                    作成完了！
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 12, color: "#8E8E93", fontWeight: "bold" }}
                >
                  ルームID
                </Text>
                <View
                  style={{
                    backgroundColor: "#F2F2F7",
                    padding: 15,
                    borderRadius: 12,
                    marginTop: 5,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      color: "#1C1C1E",
                    }}
                    selectable={true}
                  >
                    {createdRoomId}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { marginTop: 25, width: "100%", alignItems: "center" },
                  ]}
                  onPress={() => setShowCreatedRoomInfoVisible(false)}
                >
                  <Text style={styles.saveBtnText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </>
    );
  },
);
