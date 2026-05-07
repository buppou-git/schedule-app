// ExternalEventModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScheduleItem } from "../../../types";

interface ExternalEventModalProps {
    visible: boolean;
    onClose: () => void;
    item: ScheduleItem | null;
    onCopy: (item: ScheduleItem) => void;
    onHide: (item: ScheduleItem) => void;
    onSaveExpense: (item: ScheduleItem, amount: number, category: string) => void; // 🌟 支出保存用を追加
}

const EXTERNAL_COLOR = "#FF2D55"; // 🌟 カレンダーの外部予定と同じ赤

export default function ExternalEventModal({ visible, onClose, item, onCopy, onHide, onSaveExpense }: ExternalEventModalProps) {
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("食費");

    // モーダルが開くたびに初期値をセット
    useEffect(() => {
        if (item) {
            setAmount(item.amount ? item.amount.toString() : "");
            setCategory(item.category || "食費");
        }
    }, [item, visible]);

    if (!item) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <SafeAreaView style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>外部予定への支出登録</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <Text style={styles.title}>{item.title}</Text>
                        <View style={styles.infoRow}>
                            <Ionicons name="time-outline" size={18} color="#8E8E93" />
                            <Text style={styles.infoText}>
                                {item.startDate ? new Date(item.startDate).toLocaleDateString() : "日付未設定"}
                            </Text>
                        </View>

                        {/* 🌟 金額入力セクション */}
                        <View style={styles.expenseSection}>
                            <Text style={styles.label}>支出金額</Text>
                            <View style={styles.amountInputRow}>
                                <Text style={styles.currency}>¥</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={amount}
                                    onChangeText={setAmount}
                                    autoFocus={false}
                                />
                            </View>

                            <Text style={styles.label}>カテゴリ</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                                {["食費", "日用品", "交通費", "交際費", "趣味", "固定費"].map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setCategory(cat)}
                                        style={[styles.catChip, category === cat && { backgroundColor: EXTERNAL_COLOR, borderColor: EXTERNAL_COLOR }]}
                                    >
                                        <Text style={[styles.catText, category === cat && { color: "#FFF" }]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <TouchableOpacity
                            style={[styles.mainSaveBtn, { backgroundColor: EXTERNAL_COLOR }]}
                            onPress={() => onSaveExpense(item, parseInt(amount) || 0, category)}
                        >
                            <Text style={styles.mainSaveBtnText}>支出を保存する</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        {/* 既存のサブボタン */}
                        <View style={styles.subActionArea}>
                            <TouchableOpacity style={styles.subBtn} onPress={() => onCopy(item)}>
                                <Ionicons name="copy-outline" size={18} color="#8E8E93" />
                                <Text style={styles.subBtnText}>コピーして自由に編集</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.subBtn} onPress={() => onHide(item)}>
                                <Ionicons name="eye-off-outline" size={18} color="#FF3B30" />
                                <Text style={[styles.subBtnText, { color: "#FF3B30" }]}>この予定を非表示にする</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    container: { backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" },
    header: { flexDirection: "row", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F2F2F7" },
    headerTitle: { fontSize: 16, fontWeight: "bold", color: "#8E8E93" },
    content: { padding: 24 },
    title: { fontSize: 24, fontWeight: "800", color: "#1C1C1E", marginBottom: 8 },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 },
    infoText: { fontSize: 14, color: "#8E8E93" },
    label: { fontSize: 12, fontWeight: "bold", color: "#8E8E93", marginBottom: 8 },
    expenseSection: { marginBottom: 24 },
    amountInputRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2, borderBottomColor: "#F2F2F7", marginBottom: 20, paddingBottom: 8 },
    currency: { fontSize: 24, fontWeight: "bold", color: "#1C1C1E", marginRight: 8 },
    amountInput: { flex: 1, fontSize: 32, fontWeight: "bold", color: "#1C1C1E" },
    catScroll: { flexDirection: "row" },
    catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E5E5EA", marginRight: 8, backgroundColor: "#FFF" },
    catText: { fontSize: 13, fontWeight: "bold", color: "#8E8E93" },
    mainSaveBtn: { padding: 18, borderRadius: 16, alignItems: "center", marginBottom: 24 },
    mainSaveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
    divider: { height: 1, backgroundColor: "#F2F2F7", marginBottom: 20 },
    subActionArea: { gap: 12, paddingBottom: 40 },
    subBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
    subBtnText: { fontSize: 14, color: "#8E8E93", fontWeight: "600" },
});