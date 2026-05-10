import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ScheduleFormData } from "../../../../types"; // 🌟 追加
import { PRESET_COLORS } from "../../../../utils/helpers";
import { styles } from "./ScheduleModal.styles";

interface TagSectionProps {
  selectedLayer: string;
  setSelectedLayer: (l: string) => void;
  layerMaster: any;
  tagMaster: any;
  formDataTag: string;
  uiThemeColor: string;
  updateForm: (updates: Partial<ScheduleFormData>) => void; // 🌟 anyを修正
  isCreatingNewTag: boolean;
  setIsCreatingNewTag: (val: boolean) => void;
  newTagColor: string;
  setNewTagColor: (val: string) => void;
  handleLongPressSubTag: (tagName: string, color: string) => void;
}

export const TagSection = React.memo(
  ({
    selectedLayer,
    setSelectedLayer,
    layerMaster,
    tagMaster,
    formDataTag,
    uiThemeColor,
    updateForm,
    isCreatingNewTag,
    setIsCreatingNewTag,
    newTagColor,
    setNewTagColor,
    handleLongPressSubTag,
  }: TagSectionProps) => {
    return (
      <View>
        <Text style={styles.label}>カレンダーの種類</Text>
        <View style={styles.layerContainer}>
          {Object.keys(layerMaster).map((l) => (
            <TouchableOpacity
              key={l}
              style={[
                styles.layerChip,
                selectedLayer === l && { backgroundColor: layerMaster[l] },
              ]}
              onPress={() => setSelectedLayer(l)}
            >
              <Text
                style={[
                  styles.layerChipText,
                  selectedLayer === l && { color: "#fff" },
                ]}
              >
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tagSection}>
          <Text style={styles.label}>属性（任意）</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center" }}
          >
            <TouchableOpacity
              onPress={() => {
                const nextState = !isCreatingNewTag;
                setIsCreatingNewTag(nextState);
                if (!nextState) {
                  updateForm({ tag: "" });
                  setNewTagColor("");
                }
              }}
              style={[
                styles.addTagCircle,
                isCreatingNewTag && { backgroundColor: uiThemeColor },
              ]}
            >
              <Ionicons
                name={isCreatingNewTag ? "close" : "add"}
                size={22}
                color={isCreatingNewTag ? "#fff" : uiThemeColor}
              />
            </TouchableOpacity>

            {isCreatingNewTag && (
              <TextInput
                style={[
                  styles.newTagInput,
                  {
                    borderColor: newTagColor || uiThemeColor,
                    color: newTagColor || uiThemeColor,
                  },
                ]}
                placeholder="新しい属性..."
                placeholderTextColor={(newTagColor || uiThemeColor) + "70"}
                value={formDataTag}
                onChangeText={(t) => updateForm({ tag: t })}
                autoFocus
              />
            )}

            {Object.keys(tagMaster)
              .filter((t) => tagMaster[t].layer === selectedLayer)
              .map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => {
                    updateForm({ tag: t });
                    setIsCreatingNewTag(false);
                    setNewTagColor("");
                  }}
                  onLongPress={() =>
                    handleLongPressSubTag(t, tagMaster[t].color)
                  }
                  style={[
                    styles.tagChip,
                    formDataTag === t && {
                      backgroundColor: tagMaster[t].color,
                      borderColor: tagMaster[t].color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      formDataTag === t && { color: "#fff" },
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>

          {isCreatingNewTag && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>カラーを選択（任意）</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ paddingBottom: 5 }}
              >
                {PRESET_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      {
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: color,
                        marginRight: 10,
                      },
                      newTagColor === color && {
                        borderWidth: 3,
                        borderColor: "#1C1C1E",
                      },
                    ]}
                    onPress={() => setNewTagColor(color)}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  },
);
