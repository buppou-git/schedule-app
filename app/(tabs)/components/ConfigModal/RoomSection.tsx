import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage"; // 🌟 色を保存するために追加
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
import { PRESET_COLORS } from "../../../../utils/helpers"; // 🌟 カラーパレットを読み込み
import { styles } from "./ConfigModal.styles";

interface RoomSectionProps {
  sharedRooms: { [layerName: string]: string };
  // 🌟 3つ目の引数として color を追加
  onAddSharedRoom: (layerName: string, roomId: string, color?: string) => void;
}

export const RoomSection = React.memo(
  ({ sharedRooms, onAddSharedRoom }: RoomSectionProps) => {
    // 🌟 部屋（Room）関連のState
    const [createRoomVisible, setCreateRoomVisible] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [newRoomColor, setNewRoomColor] = useState(PRESET_COLORS[0]); // 🌟 作成時の色

    const [joinRoomVisible, setJoinRoomVisible] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState("");
    const [joinRoomName, setJoinRoomName] = useState("");
    const [joinRoomColor, setJoinRoomColor] = useState(PRESET_COLORS[0]); // 🌟 参加時の色

    const [shareRoomListVisible, setShareRoomListVisible] = useState(false);

    const [showCreatedRoomInfoVisible, setShowCreatedRoomInfoVisible] =
      useState(false);
    const [createdRoomName, setCreatedRoomName] = useState("");
    const [createdRoomId, setCreatedRoomId] = useState("");

    const handleShareRoom = useCallback(
      async (roomName: string, roomId: string) => {
        try {
          // 🌟 修正：URLの最後に「&name=エンコードした名前」を付け足すだけ！
          const url = `https://multi-calendar-app-1379f.web.app/join?room=${roomId}&name=${encodeURIComponent(roomName)}`;

          await Share.share({
            message: `【UniCal】「${roomName}」の共有カレンダーに参加しよう！
    
    下のリンクをタッチして参加！
    ${url}`,
            title: "カレンダーの共有",
          });

          setShareRoomListVisible(false);
        } catch (error) {
          Alert.alert("エラー", "共有に失敗しました。");
        }
      },
      [],
    );
    ``;

    const handleCreateRoom = useCallback(async () => {
      if (!newRoomName.trim()) return;

      const generatedRoomId =
        "room_" +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 8);

      onAddSharedRoom(newRoomName.trim(), generatedRoomId, newRoomColor);

      // 🌟 魔法の追加：裏側（AsyncStorage）に直接アクセスして、選んだ色を保存する！
      try {
        const storedStr = await AsyncStorage.getItem("layerMasterData");
        const currentLayers = storedStr ? JSON.parse(storedStr) : {};
        currentLayers[newRoomName.trim()] = newRoomColor;
        await AsyncStorage.setItem(
          "layerMasterData",
          JSON.stringify(currentLayers),
        );
      } catch (e) {
        console.error("Color save error:", e);
      }

      setCreatedRoomName(newRoomName.trim());
      setCreatedRoomId(generatedRoomId);
      setNewRoomName("");
      setCreateRoomVisible(false);

      setTimeout(() => {
        setShowCreatedRoomInfoVisible(true);
      }, 400);
    }, [newRoomName, newRoomColor, onAddSharedRoom]);

    const handleJoinRoom = useCallback(async () => {
      if (!joinRoomName.trim() || !joinRoomId.trim()) return;

      let extractedId = joinRoomId.trim();
      if (extractedId.includes("room=")) {
        extractedId = extractedId.split("room=")[1].split("&")[0];
      }

      onAddSharedRoom(joinRoomName.trim(), extractedId, joinRoomColor);

      // 🌟 参加時も同じように色を保存する！
      try {
        const storedStr = await AsyncStorage.getItem("layerMasterData");
        const currentLayers = storedStr ? JSON.parse(storedStr) : {};
        currentLayers[joinRoomName.trim()] = joinRoomColor;
        await AsyncStorage.setItem(
          "layerMasterData",
          JSON.stringify(currentLayers),
        );
      } catch (e) {
        console.error("Color save error:", e);
      }

      setJoinRoomVisible(false);
      setJoinRoomId("");
      setJoinRoomName("");
      Alert.alert(
        "参加完了",
        "共有カレンダーを追加しました！\n（※色が反映されない場合は一度アプリを再起動してください）",
      );
    }, [joinRoomId, joinRoomName, joinRoomColor, onAddSharedRoom]);

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
                    共有レイヤーの名前とカラーを決めてください
                  </Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="例：ゼミ、家族"
                    placeholderTextColor="#C7C7CC"
                    autoFocus
                    value={newRoomName}
                    onChangeText={setNewRoomName}
                  />

                  {/* 🌟 カラーパレット追加 */}
                  <Text
                    style={[
                      styles.sectionLabel,
                      { marginTop: 15, marginLeft: 0 },
                    ]}
                  >
                    カラーを選択
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 10 }}
                  >
                    {PRESET_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          {
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: color,
                            marginRight: 10,
                          },
                          newRoomColor === color && {
                            borderWidth: 3,
                            borderColor: "#1C1C1E",
                          },
                        ]}
                        onPress={() => setNewRoomColor(color)}
                      />
                    ))}
                  </ScrollView>

                  <View style={styles.modalActionRow}>
                    <TouchableOpacity
                      onPress={() => setCreateRoomVisible(false)}
                    >
                      <Text style={styles.cancelText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        { backgroundColor: newRoomColor },
                      ]} // 🌟 選んだ色がボタンにも反映される！
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

                  {/* 🌟 参加時もカラーパレットで自分の好きな色を選べる！ */}
                  <Text
                    style={[
                      styles.sectionLabel,
                      { marginTop: 15, marginLeft: 0 },
                    ]}
                  >
                    カラーを選択
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 10 }}
                  >
                    {PRESET_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          {
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: color,
                            marginRight: 10,
                          },
                          joinRoomColor === color && {
                            borderWidth: 3,
                            borderColor: "#1C1C1E",
                          },
                        ]}
                        onPress={() => setJoinRoomColor(color)}
                      />
                    ))}
                  </ScrollView>

                  <View style={styles.modalActionRow}>
                    <TouchableOpacity onPress={() => setJoinRoomVisible(false)}>
                      <Text style={styles.cancelText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.saveBtn,
                        { backgroundColor: joinRoomColor },
                      ]} // 🌟 選んだ色が反映される！
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
                    {
                      marginTop: 25,
                      width: "100%",
                      alignItems: "center",
                      backgroundColor: "#1C1C1E",
                    },
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
