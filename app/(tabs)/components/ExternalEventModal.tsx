import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScheduleItem } from "../../../types";

interface ExternalEventModalProps {
    visible: boolean;
    onClose: () => void;
    item: ScheduleItem | null;
    onCopy: (item: ScheduleItem) => void;
    onHide: (item: ScheduleItem) => void;
    themeColor: string;
}

export default function ExternalEventModal({ visible, onClose, item, onCopy, onHide, themeColor }: ExternalEventModalProps) {
    if (!item) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <SafeAreaView style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>外部カレンダーの予定</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <Text style={styles.title}>{item.title}</Text>
                        <View style={styles.infoRow}>
                            <Ionicons name="time-outline" size={20} color="#8E8E93" />
                            <Text style={styles.infoText}>
                                {item.startDate ? new Date(item.startDate).toLocaleString() : "日時未設定"} 〜
                            </Text>
                        </View>

                        <View style={styles.warningBox}>
                            <Text style={styles.warningText}>
                                ※ 外部予定は直接編集できません。変更したい場合はアプリ内予定としてコピーしてください。
                            </Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { borderColor: themeColor }]}
                            onPress={() => onCopy(item)}
                        >
                            <Ionicons name="copy-outline" size={20} color={themeColor} />
                            <Text style={[styles.actionText, { color: themeColor }]}>アプリ内にコピーして編集</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, styles.hideBtn]}
                            onPress={() => onHide(item)}
                        >
                            <Ionicons name="eye-off-outline" size={20} color="#FF3B30" />
                            <Text style={[styles.actionText, { color: "#FF3B30" }]}>この予定を非表示にする</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    container: { backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: "50%" },
    header: { flexDirection: "row", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F2F2F7" },
    headerTitle: { fontSize: 16, fontWeight: "bold", color: "#8E8E93" },
    content: { padding: 24 },
    title: { fontSize: 24, fontWeight: "800", color: "#1C1C1E", marginBottom: 16 },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
    infoText: { fontSize: 16, color: "#3A3A3C" },
    warningBox: { backgroundColor: "#F2F2F7", padding: 16, borderRadius: 12 },
    warningText: { fontSize: 13, color: "#8E8E93", lineHeight: 18 },
    footer: { padding: 20, gap: 12 },
    actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 16, borderWidth: 1.5 },
    hideBtn: { borderColor: "#FF3B301A", backgroundColor: "#FF3B300A" },
    actionText: { fontSize: 16, fontWeight: "bold" },
});