import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { styles } from "./ScheduleModal.styles"; // 🌟 さっき作ったスタイルを読み込む

// 🌟 時間のフォーマット関数もここで管理するとスッキリします
export const formatTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// 🌟 TypeScriptの型を綺麗に分離
interface ModernDatePickerProps {
  value: Date;
  mode: "date" | "time";
  onChange: (d: Date) => void;
  themeColor: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

// 🌟 限界突破：コンポーネント全体を React.memo で包み、無駄な再描画を完全ブロック！
export const ModernDatePicker = React.memo(({
  value,
  mode,
  onChange,
  themeColor,
  icon,
}: ModernDatePickerProps) => {
  const [show, setShow] = useState(false);

  const formattedValue =
    mode === "date"
      ? `${value.getFullYear()}/${("0" + (value.getMonth() + 1)).slice(-2)}/${("0" + value.getDate()).slice(-2)}`
      : `${("0" + value.getHours()).slice(-2)}:${("0" + value.getMinutes()).slice(-2)}`;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.modernDateBtn,
          {
            borderColor: themeColor + "40",
            backgroundColor: themeColor + "0A",
          },
        ]}
        onPress={() => setShow(true)}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={16}
            color={themeColor}
            style={{ marginRight: 6 }}
          />
        )}
        <Text style={{ fontSize: 14, fontWeight: "700", color: themeColor }}>
          {formattedValue}
        </Text>
      </TouchableOpacity>

      {show && Platform.OS === "android" && (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          onChange={(e, d) => {
            setShow(false);
            if (e.type === "set" && d) onChange(d);
          }}
        />
      )}

      {show && Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="fade">
          <TouchableOpacity
            style={styles.iosPickerOverlay}
            activeOpacity={1}
            onPress={() => setShow(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.iosPickerContent}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity
                    onPress={() => setShow(false)}
                    style={{ padding: 8 }}
                  >
                    <Text
                      style={{
                        color: themeColor,
                        fontSize: 16,
                        fontWeight: "bold",
                      }}
                    >
                      完了
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <DateTimePicker
                    value={value}
                    mode={mode}
                    display="spinner"
                    onChange={(e, d) => {
                      if (d) onChange(d);
                    }}
                    textColor="#000"
                    style={{ height: 210, width: 320 }}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
});