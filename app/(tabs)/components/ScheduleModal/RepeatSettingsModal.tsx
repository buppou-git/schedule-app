import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { ModernDatePicker } from "./ModernDatePicker";
import { styles } from "./ScheduleModal.styles";

type RepeatType = "none" | "daily" | "weekly" | "monthly" | "custom";

interface RepeatSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    repeatType: RepeatType;
    repeatDays: number[];
    repeatInterval: number;
    repeatEndDate: Date | null;
    uiThemeColor: string;
    updateForm: (updates: any) => void;
}

const repeatOptions: { label: string; value: RepeatType }[] = [
    { label: "なし", value: "none" },
    { label: "毎日", value: "daily" },
    { label: "毎週", value: "weekly" },
    { label: "毎月", value: "monthly" },
    { label: "カスタム", value: "custom" },
];

export const RepeatSettingsModal = React.memo(
    ({
        visible,
        onClose,
        repeatType,
        repeatDays,
        repeatInterval,
        repeatEndDate,
        uiThemeColor,
        updateForm,
    }: RepeatSettingsModalProps) => {
        return (
            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={onClose}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onClose}
                    />

                    <View
                        style={[
                            styles.modalContent,
                            {
                                maxHeight: "75%",
                                height: undefined,
                                borderTopWidth: 8,
                                borderTopColor: uiThemeColor,
                            },
                        ]}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 20,
                            }}
                        >
                            <Text style={styles.modalTitle}>繰り返し設定</Text>

                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={26} color="#8E8E93" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.layerContainer}>
                                {repeatOptions.map((opt) => {
                                    const selected = repeatType === opt.value;

                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.layerChip,
                                                selected && { backgroundColor: uiThemeColor },
                                            ]}
                                            onPress={() => {
                                                updateForm({
                                                    repeatType: opt.value,
                                                    ...(opt.value === "none"
                                                        ? {
                                                            repeatDays: [],
                                                            repeatInterval: 1,
                                                            repeatEndDate: null,
                                                        }
                                                        : {}),
                                                });
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.layerChipText,
                                                    selected && { color: "#fff" },
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {repeatType === "custom" && (
                                <View style={styles.customRepeatArea}>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                            marginBottom: 12,
                                        }}
                                    >
                                        <Text style={styles.miniLabel}>曜日の選択</Text>

                                        <TouchableOpacity
                                            onPress={() =>
                                                updateForm({ repeatDays: [1, 2, 3, 4, 5] })
                                            }
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    color: uiThemeColor,
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                平日のみ選択
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.daySelectorRow}>
                                        {["日", "月", "火", "水", "木", "金", "土"].map(
                                            (day, idx) => {
                                                const isSelected = repeatDays.includes(idx);

                                                return (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={[
                                                            styles.dayCircle,
                                                            isSelected && {
                                                                backgroundColor: uiThemeColor,
                                                                borderColor: uiThemeColor,
                                                            },
                                                        ]}
                                                        onPress={() => {
                                                            const next = repeatDays.includes(idx)
                                                                ? repeatDays.filter((d) => d !== idx)
                                                                : [...repeatDays, idx];

                                                            updateForm({ repeatDays: next });
                                                        }}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.dayText,
                                                                isSelected && { color: "#FFF" },
                                                            ]}
                                                        >
                                                            {day}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            },
                                        )}
                                    </View>

                                    <View style={styles.intervalRow}>
                                        <Text style={styles.miniLabel}>繰り返しの間隔:</Text>

                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <TextInput
                                                style={styles.intervalInput}
                                                keyboardType="numeric"
                                                value={repeatInterval.toString()}
                                                onChangeText={(t) =>
                                                    updateForm({
                                                        repeatInterval: Math.max(
                                                            parseInt(t, 10) || 1,
                                                            1,
                                                        ),
                                                    })
                                                }
                                            />

                                            <Text
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: "bold",
                                                    color: "#1C1C1E",
                                                }}
                                            >
                                                週間ごと
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {repeatType !== "none" && (
                                <View
                                    style={{
                                        marginTop: 20,
                                        padding: 14,
                                        backgroundColor: uiThemeColor + "12",
                                        borderRadius: 14,
                                    }}
                                >
                                    {/* ✅ ① スイッチ追加 */}
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            marginBottom: 10,
                                        }}
                                    >
                                        <Text style={styles.miniLabel}>終了日を設定</Text>

                                        <Switch
                                            value={repeatEndDate !== null}
                                            onValueChange={(v) =>
                                                updateForm({
                                                    repeatEndDate: v ? new Date() : null,
                                                })
                                            }
                                            trackColor={{ false: "#CCC", true: uiThemeColor }}
                                        />
                                    </View>

                                    {/* ✅ ② ONのときだけ表示 */}
                                    {repeatEndDate && (
                                        <ModernDatePicker
                                            value={repeatEndDate}
                                            mode="date"
                                            onChange={(d) => updateForm({ repeatEndDate: d })}
                                            themeColor={uiThemeColor}
                                            icon="calendar-outline"
                                        />
                                    )}
                                </View>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.saveBtn,
                                    {
                                        backgroundColor: uiThemeColor,
                                        marginTop: 24,
                                        alignItems: "center",
                                    },
                                ]}
                                onPress={onClose}
                            >
                                <Text style={styles.saveBtnText}>完了</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    },
);