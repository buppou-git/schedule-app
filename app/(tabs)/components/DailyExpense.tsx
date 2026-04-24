import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppStore } from "../store/useAppStore";
import { ScheduleItem } from "../types";
import { getItemTotalExpense, getItemTotalIncome, PRESET_COLORS } from "../utils/helpers";

interface DailyExpenseProps {
  selectedDate: string;
  activeTags: string[];
  setHasUnsavedChanges: (val: boolean) => void;
}

export default function DailyExpense({
  selectedDate,
  activeTags,
  setHasUnsavedChanges,
}: DailyExpenseProps) {
  const {
    scheduleData,
    setScheduleData,
    layerMaster,
    tagMaster,
    setTagMaster,
  } = useAppStore();

  const [inputAmount, setInputAmount] = useState("");
  const [selectedMainTag, setSelectedMainTag] = useState("食費");
  const [selectedSubTag, setSelectedSubTag] = useState("");
  const [manualTag, setManualTag] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [isManualInput, setIsManualInput] = useState(false);

  const [quickMainTags, setQuickMainTags] = useState<{
    [key: string]: string[];
  }>({
    ALL_LAYERS: ["食費", "交通", "日用品", "交際費", "趣味", "その他"],
  });

  const [editQuickTagModal, setEditQuickTagModal] = useState(false);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [tempQuickTagText, setTempQuickTagText] = useState("");
  const [editingLayer, setEditingLayer] = useState("ALL_LAYERS");

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    item: ScheduleItem;
    date: string;
  } | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const [addSubTagModalVisible, setAddSubTagModalVisible] = useState(false);
  const [targetLayerForSubTag, setTargetLayerForSubTag] = useState("");
  const [newSubTagName, setNewSubTagName] = useState("");
  const [newSubTagColor, setNewSubTagColor] = useState("");

  const [editSubTagModalVisible, setEditSubTagModalVisible] = useState(false);
  const [editingSubTagOriginalName, setEditingSubTagOriginalName] = useState("");
  const [editingSubTagName, setEditingSubTagName] = useState("");
  const [editingSubTagColor, setEditingSubTagColor] = useState("");

  const handleLongPressSubTag = (tagName: string, color: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingSubTagOriginalName(tagName);
    setEditingSubTagName(tagName);
    setEditingSubTagColor(color);
    setEditSubTagModalVisible(true);
  };

  const saveEditedSubTag = async () => {
    const trimmed = editingSubTagName.trim();
    if (!trimmed) return;
    const newTagMaster = { ...tagMaster };

    if (trimmed !== editingSubTagOriginalName) {
      if (newTagMaster[trimmed]) return Alert.alert("エラー", "既に同じ名前が存在します");
      const oldLayer = newTagMaster[editingSubTagOriginalName].layer;
      delete newTagMaster[editingSubTagOriginalName];
      newTagMaster[trimmed] = { layer: oldLayer, color: editingSubTagColor };
      if (selectedSubTag === editingSubTagOriginalName) setSelectedSubTag(trimmed);
    } else {
      newTagMaster[trimmed].color = editingSubTagColor;
    }

    setTagMaster(newTagMaster);
    await AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
    setEditSubTagModalVisible(false);
  };

  const deleteSubTag = async () => {
    Alert.alert("確認", `属性「${editingSubTagOriginalName}」を削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除", style: "destructive", onPress: async () => {
          const newTagMaster = { ...tagMaster };
          delete newTagMaster[editingSubTagOriginalName];
          setTagMaster(newTagMaster);
          await AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
          if (selectedSubTag === editingSubTagOriginalName) setSelectedSubTag("");
          setEditSubTagModalVisible(false);
        }
      }
    ]);
  };

  // 🌟 修正：右側のカード幅をエリアの幅にピタリと合わせる
  const screenWidth = Dimensions.get("window").width;
  const rightAreaWidth = screenWidth * 0.62; // 左(35%) + 隙間(3%) の残り62%が右エリア
  const exactCardWidth = rightAreaWidth - 10; // marginRightの10pxを引くことで1枚ピッタリに

  const displayLayers = useMemo(
    () =>
      activeTags.length > 0
        ? activeTags
        : ["ALL_LAYERS", ...Object.keys(layerMaster)],
    [activeTags, layerMaster],
  );

  const currentActiveLayer = activeTags.length === 1 ? activeTags[0] : null;
  const themeColor = currentActiveLayer
    ? layerMaster[currentActiveLayer]
    : "#1C1C1E";


  useEffect(() => {
    const load = async () => {
      const q = await AsyncStorage.getItem("quickMainTagsData");
      if (q) setQuickMainTags(JSON.parse(q || "{}"));
    };
    load();
  }, []);


  const mainStats = useMemo(() => {
    let dExpense = 0;
    let dIncome = 0;
    (scheduleData[selectedDate] || []).forEach((item) => {
      const eTotal = getItemTotalExpense(item);
      const iTotal = getItemTotalIncome(item);
      if (eTotal === 0 && iTotal === 0) return;

      const itemTag = item.tags?.[0] || item.tag || "";
      const itemLayer = tagMaster[itemTag]?.layer || "共通";

      if (
        !item.isIncome &&
        activeTags.length > 0 &&
        !activeTags.includes(itemLayer)
      )
        return;

      dExpense += eTotal;
      dIncome += iTotal;
    });
    return { dailyExpense: dExpense, dailyIncome: dIncome };
  }, [selectedDate, scheduleData, activeTags, tagMaster]);

  const toggleManualMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isManualInput && selectedSubTag) setManualTag(selectedSubTag);
    setIsManualInput(!isManualInput);
  };

  const handleLongPressQuickTag = (
    index: number,
    currentText: string,
    targetLayer: string,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingLayer(targetLayer);
    setEditingTagIndex(index);
    setTempQuickTagText(currentText);
    setEditQuickTagModal(true);
  };

  const saveQuickTag = async () => {
    if (editingTagIndex === null || !tempQuickTagText.trim()) return;
    const newTags = { ...quickMainTags };
    if (!newTags[editingLayer]) {
      newTags[editingLayer] = [
        ...(quickMainTags["ALL_LAYERS"] || ["食費", "交通", "日用品", "交際費", "趣味", "その他"]),
      ];
    }
    newTags[editingLayer][editingTagIndex] = tempQuickTagText.trim();
    setQuickMainTags(newTags);
    await AsyncStorage.setItem("quickMainTagsData", JSON.stringify(newTags));
    setSelectedMainTag(tempQuickTagText.trim());
    setEditQuickTagModal(false);
  };

  const handleAddExpense = (target: string, color: string) => {
    const amountNum = parseInt(inputAmount);
    if (isNaN(amountNum) || amountNum <= 0)
      return Alert.alert("入力不足", "金額を入力してください。");

    const isAll = target === "ALL_LAYERS";
    let fTag = isManualInput ? manualTag.trim() : selectedSubTag;
    if (!fTag) fTag = isAll ? "共通出費" : target;

    if (fTag && !tagMaster[fTag]) {
      const assignLayer = isAll ? "共通" : target;
      const newTagMaster = {
        ...tagMaster,
        [fTag]: { layer: assignLayer, color: color },
      };
      setTagMaster(newTagMaster);
      AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
    }

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      category: selectedMainTag || "未分類",
      tag: fTag,
      tags: [fTag],
      title: isManualInput && manualTitle ? manualTitle : selectedMainTag,
      amount: amountNum,
      isDone: false,
      color: tagMaster[fTag]?.color || color,
      isEvent: false,
      isTodo: false,
      isExpense: true,
      isIncome: false,
    };

    const newData = {
      ...scheduleData,
      [selectedDate]: [...(scheduleData[selectedDate] || []), newItem],
    };
    setInputAmount("");
    setManualTitle("");
    setManualTag("");
    Keyboard.dismiss();
    setTimeout(() => {
      setScheduleData(newData);
      setHasUnsavedChanges(true);
    }, 100);
  };

  const executeAddSubTag = () => {
    const trimmed = newSubTagName.trim();
    if (!trimmed) return;
    if (tagMaster[trimmed]) {
      Alert.alert("エラー", "既に同じ名前の属性が存在します");
      return;
    }
    const newColor =
      newSubTagColor ||
      (targetLayerForSubTag === "共通"
        ? "#8E8E93"
        : layerMaster[targetLayerForSubTag] || "#8E8E93");
    const newTagMaster = {
      ...tagMaster,
      [trimmed]: { layer: targetLayerForSubTag, color: newColor },
    };
    setTagMaster(newTagMaster);
    AsyncStorage.setItem("tagMasterData", JSON.stringify(newTagMaster));
    setSelectedSubTag(trimmed);
    setNewSubTagName("");
    setNewSubTagColor("");
    setAddSubTagModalVisible(false);
  };

  const handleOpenEdit = (item: ScheduleItem, date: string) => {
    setEditingItem({ item, date });
    setEditAmount(item.amount.toString());
    setEditTitle(item.title || "");
    setEditModalVisible(true);
  };

  const handleUpdate = () => {
    if (!editingItem) return;
    const newAmount = parseInt(editAmount);
    if (isNaN(newAmount) || newAmount <= 0)
      return Alert.alert("エラー", "金額を正しく入力してください");
    const newData = { ...scheduleData };
    newData[editingItem.date] = newData[editingItem.date].map((i) =>
      i.id === editingItem.item.id
        ? { ...i, amount: newAmount, title: editTitle }
        : i,
    );
    setEditModalVisible(false);
    setTimeout(() => {
      setScheduleData(newData);
      setHasUnsavedChanges(true);
    }, 100);
  };

  return (
    <View style={styles.dailyContainer}>
      <View style={[styles.dailyLeft, { width: "35%" }]}>
        <View style={styles.iconTextRowSmall}>
          <Ionicons name="receipt-outline" size={12} color={themeColor} />
          <Text style={[styles.dailyLabel, { color: themeColor }]}>
            {selectedDate.split("-")[2]}日 収支
          </Text>
        </View>

        <Text style={[styles.dailyTotalText, { color: "#333" }]}>
          -¥{mainStats.dailyExpense.toLocaleString()}
        </Text>
        {mainStats.dailyIncome > 0 && (
          <Text
            style={[styles.dailyTotalText, { color: "#8E8E93", fontSize: 16 }]}
          >
            +¥{mainStats.dailyIncome.toLocaleString()}
          </Text>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {(scheduleData[selectedDate] || [])
            .filter(
              (i) => getItemTotalExpense(i) > 0 || getItemTotalIncome(i) > 0,
            )
            .map((i) => {
              const isIncome = i.isIncome;
              const itemTag = i.tags?.[0] || i.tag || "";
              const itemLayer = tagMaster[itemTag]?.layer || "共通";

              if (
                !isIncome &&
                activeTags.length > 0 &&
                !activeTags.includes(itemLayer)
              )
                return null;

              return (
                <TouchableOpacity
                  key={i.id}
                  style={styles.dailyItemRow}
                  onPress={() => handleOpenEdit(i, selectedDate)}
                >
                  <View style={styles.dailyItemInfo}>
                    <View
                      style={[
                        styles.dailyItemDot,
                        { backgroundColor: isIncome ? "#8E8E93" : i.color },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontWeight: "bold",
                          fontSize: 11,
                          color: isIncome ? "#8E8E93" : themeColor,
                        }}
                        numberOfLines={1}
                      >
                        {itemTag || i.category}
                      </Text>
                      <Text
                        style={{ fontSize: 9, color: "#888" }}
                        numberOfLines={1}
                      >
                        {i.title !== i.category && i.title}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.dailyItemAmount,
                        isIncome && { color: "#8E8E93" },
                      ]}
                    >
                      {isIncome ? "+" : ""}¥{i.amount.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </View>

      <View style={{ width: "3%" }} />

      <View style={[styles.dailyRight, { flex: 1 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={exactCardWidth + 10} // marginRight分の10pxを足す
          decelerationRate="fast"
          contentContainerStyle={{ paddingRight: 10 }}
          keyboardShouldPersistTaps="handled"
        >
          {displayLayers.map((l) => {
            const c =
              l === "ALL_LAYERS" ? "#8E8E93" : layerMaster[l] || themeColor;
            const isAll = l === "ALL_LAYERS";
            const qTags = quickMainTags[l] || quickMainTags["ALL_LAYERS"] || [];
            const sTags = isAll
              ? Object.keys(tagMaster).filter(
                (t) => tagMaster[t].layer === "共通",
              )
              : Object.keys(tagMaster).filter((t) => tagMaster[t].layer === l);

            return (
              <View
                key={l}
                style={[
                  styles.inputCard,
                  {
                    width: exactCardWidth, // 🌟 ここがポイント！ピッタリ1枚分に！
                    backgroundColor: c + "15",
                    borderColor: c + "30",
                  },
                ]}
              >
                <View style={styles.inputHeaderRow}>
                  <Text style={[styles.inputCardTitle, { color: c }]}>
                    {isAll ? "全体/共通" : l}
                  </Text>
                  {!isAll && (
                    <TouchableOpacity onPress={toggleManualMode}>
                      <Ionicons
                        name={isManualInput ? "flash" : "create-outline"}
                        size={16}
                        color={c}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                <View
                  style={[
                    styles.modernInputWrapper,
                    { borderColor: c + "30", backgroundColor: "#FFF" },
                  ]}
                >
                  <Text style={[styles.modernCurrency, { color: c }]}>¥</Text>
                  <TextInput
                    style={[styles.modernQuickInput, { color: c }]}
                    placeholder="0"
                    placeholderTextColor={c + "40"}
                    keyboardType="numeric"
                    value={inputAmount}
                    onChangeText={setInputAmount}
                  />
                </View>
                <View style={{ flex: 1, justifyContent: "space-between" }}>
                  <View>
                    {isAll || isManualInput ? (
                      <View style={{ gap: 4, marginTop: 4 }}>
                        <TextInput
                          style={[
                            styles.smallManualInput,
                            { color: c, borderColor: c + "30", borderWidth: 1 },
                          ]}
                          placeholder={
                            isAll
                              ? "属性(空欄でカテゴリ)"
                              : "属性(空欄でレイヤー名)"
                          }
                          placeholderTextColor={c + "60"}
                          value={manualTag}
                          onChangeText={setManualTag}
                        />
                        <TextInput
                          style={[
                            styles.smallManualInput,
                            { color: c, borderColor: c + "30", borderWidth: 1 },
                          ]}
                          placeholder="詳細メモ (任意)"
                          placeholderTextColor={c + "60"}
                          value={manualTitle}
                          onChangeText={setManualTitle}
                        />
                      </View>
                    ) : (
                      <>
                        <View style={styles.layerQuickChipsGrid}>
                          {qTags.map((tag, idx) => (
                            <TouchableOpacity
                              key={tag}
                              style={[
                                styles.layerQuickChip3Col,
                                {
                                  backgroundColor:
                                    selectedMainTag === tag ? c : "#FFF",
                                  borderColor:
                                    selectedMainTag === tag ? c : c + "30",
                                },
                              ]}
                              onPress={() => setSelectedMainTag(tag)}
                              onLongPress={() =>
                                handleLongPressQuickTag(idx, tag, l)
                              }
                            >
                              <Text
                                style={[
                                  styles.layerQuickChipText,
                                  {
                                    color: selectedMainTag === tag ? "#FFF" : c,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {tag}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View
                          style={[
                            styles.subTagSection,
                            { borderTopColor: c + "30" },
                          ]}
                        >
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.subTagScroll}
                            keyboardShouldPersistTaps="handled"
                          >
                            <TouchableOpacity
                              style={[
                                styles.subChip,
                                {
                                  backgroundColor: "transparent",
                                  borderColor: c,
                                  borderStyle: "dashed",
                                  borderWidth: 1.5,
                                },
                              ]}
                              onPress={() => {
                                setTargetLayerForSubTag(isAll ? "共通" : l);
                                setAddSubTagModalVisible(true);
                              }}
                            >
                              <Text style={[styles.subChipText, { color: c }]}>
                                + 新規追加
                              </Text>
                            </TouchableOpacity>

                            {sTags.map((sub) => (
                              <TouchableOpacity
                                key={sub}
                                style={[styles.subChip, { backgroundColor: selectedSubTag === sub ? c : "#FFF", borderColor: selectedSubTag === sub ? c : c + "30" }]}
                                onPress={() => setSelectedSubTag(sub)}
                                onLongPress={() => handleLongPressSubTag(sub, tagMaster[sub].color)} // 🌟 追加：長押しで編集
                              >
                                <Text style={[styles.subChipText, { color: selectedSubTag === sub ? "#FFF" : c }]}>{sub}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.addExecuteBtn, { backgroundColor: c }]}
                    onPress={() => handleAddExpense(l, c)}
                  >
                    <Ionicons name="checkmark-done" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <Modal visible={editModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>データの編集</Text>
            <Text style={styles.settingLabel}>詳細メモ</Text>
            <TextInput
              style={styles.editInputText}
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <Text style={styles.settingLabel}>金額</Text>
            <TextInput
              style={styles.editInputAmount}
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
            />
            <View style={styles.editActionRow}>
              <TouchableOpacity
                onPress={() => {
                  if (!editingItem) return;
                  const newData = { ...scheduleData };
                  newData[editingItem.date] = newData[editingItem.date].filter(
                    (i) => i.id !== editingItem.item.id,
                  );
                  setScheduleData(newData);
                  setEditModalVisible(false);
                }}
              >
                <Text style={{ color: "#FF3B30", fontWeight: "bold" }}>
                  削除
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: themeColor }]}
                onPress={handleUpdate}
              >
                <Text style={styles.saveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={editQuickTagModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditQuickTagModal(false)}
        >
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>{editingLayer}の項目を編集</Text>
            <TextInput
              style={styles.editInputText}
              value={tempQuickTagText}
              onChangeText={setTempQuickTagText}
              autoFocus
            />
            <View
              style={[
                styles.editActionRow,
                { justifyContent: "center", marginTop: 10 },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: themeColor,
                    width: "100%",
                    alignItems: "center",
                  },
                ]}
                onPress={saveQuickTag}
              >
                <Text style={styles.saveText}>保存する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={addSubTagModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAddSubTagModalVisible(false)}
        >
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>
              [{targetLayerForSubTag}] に追加
            </Text>
            <Text style={styles.settingLabel}>サブカテゴリ名</Text>
            <TextInput
              style={styles.editInputAmount}
              value={newSubTagName}
              onChangeText={setNewSubTagName}
              autoFocus
            />

            <Text style={styles.settingLabel}>カラーを選択（任意）</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
            >
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    {
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: color,
                      marginRight: 10,
                    },
                    newSubTagColor === color && {
                      borderWidth: 3,
                      borderColor: "#1C1C1E",
                    },
                  ]}
                  onPress={() => setNewSubTagColor(color)}
                />
              ))}
            </ScrollView>

            <View
              style={[
                styles.editActionRow,
                { justifyContent: "space-between" },
              ]}
            >
              <TouchableOpacity
                onPress={() => setAddSubTagModalVisible(false)}
                style={{ padding: 10 }}
              >
                <Text style={{ color: "#8E8E93", fontWeight: "bold" }}>
                  キャンセル
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor:
                      layerMaster[targetLayerForSubTag] || themeColor,
                  },
                ]}
                onPress={executeAddSubTag}
              >
                <Text style={styles.saveText}>追加</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={editSubTagModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditSubTagModalVisible(false)}>
          <View style={styles.editCardModal}>
            <Text style={styles.editTitle}>属性の編集</Text>
            
            <Text style={styles.settingLabel}>属性名</Text>
            <TextInput style={styles.editInputAmount} value={editingSubTagName} onChangeText={setEditingSubTagName} />
            
            <Text style={styles.settingLabel}>カラーを変更</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity key={color} style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, marginRight: 10 }, editingSubTagColor === color && { borderWidth: 3, borderColor: "#1C1C1E" }]} onPress={() => setEditingSubTagColor(color)} />
              ))}
            </ScrollView>
            
            <View style={[styles.editActionRow, { justifyContent: "space-between" }]}>
              <TouchableOpacity onPress={deleteSubTag} style={{ padding: 10 }}><Text style={{ color: "#FF3B30", fontWeight: "bold" }}>削除</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: editingSubTagColor || themeColor }]} onPress={saveEditedSubTag}><Text style={styles.saveText}>保存</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  dailyContainer: {
    flexDirection: "row",
    height: 320,
    width: "100%",
    justifyContent: "space-between",
  },
  dailyLeft: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    overflow: "hidden",
  },
  dailyRight: { backgroundColor: "transparent", overflow: "hidden" },
  iconTextRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  dailyLabel: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  dailyTotalText: { fontWeight: "bold", marginBottom: 2 },
  dailyItemRow: {
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F2F2F7",
  },
  dailyItemInfo: { flexDirection: "row", alignItems: "center" },
  dailyItemDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  dailyItemAmount: { fontSize: 11, fontWeight: "600" },
  inputCard: {
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    height: "100%",
    marginRight: 10,
    justifyContent: "space-between",
  },
  inputHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  inputCardTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  modernInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    marginVertical: 6,
    height: 48,
  },
  modernCurrency: { fontSize: 18, fontWeight: "900", marginRight: 4 },
  modernQuickInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
  },
  smallManualInput: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    marginBottom: 6,
    textAlign: "center",
    fontWeight: "600",
  },
  layerQuickChipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 6,
  },
  layerQuickChip3Col: {
    width: "31.5%",
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  layerQuickChipText: { fontSize: 10, fontWeight: "bold" },
  subTagSection: { borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  subTagScroll: { flexDirection: "row", height: 35 },
  subChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 6,
    height: 28,
    justifyContent: "center",
  },
  subChipText: { fontSize: 10, fontWeight: "bold" },
  noSubTagText: { fontSize: 10, fontStyle: "italic", paddingTop: 5 },
  addExecuteBtn: {
    marginTop: 8,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  editCardModal: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 25,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#333",
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
    marginTop: 10,
  },
  editInputText: {
    backgroundColor: "#F2F2F7",
    padding: 10,
    borderRadius: 10,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  editInputAmount: {
    backgroundColor: "#F2F2F7",
    padding: 15,
    borderRadius: 15,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  editActionRow: { flexDirection: "row" },
  saveBtn: { paddingHorizontal: 25, paddingVertical: 12, borderRadius: 15 },
  saveText: { color: "#fff", fontWeight: "bold" },
});