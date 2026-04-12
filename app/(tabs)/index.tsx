import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";

import {
  CalendarList,
  CalendarProvider,
  WeekCalendar,
} from "react-native-calendars";

// 🌟 統一された型定義
interface ScheduleItem {
  id: string; title: string; tag?: string; tags?: string[]; amount: number; isDone: boolean;
  color: string; isEvent: boolean; isTodo: boolean; isExpense: boolean;
  category?: string; recurringGroupId?: string; repeatType?: "daily" | "weekly" | "monthly";
  isAllDay?: boolean; startTime?: string; endTime?: string;
}

import LayerManagementModal from "./components/LayerManagementModal";
import MoneyDashboard from "./components/MoneyDashboard";
import ScheduleModal from "./components/ScheduleModal";
import TabBar from "./components/TabBar";

const getTodayString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${("0" + (date.getMonth() + 1)).slice(-2)}-${("0" + date.getDate()).slice(-2)}`;
};

const getPastelColor = (hex: string) => {
  if (!hex || hex.length !== 7) return "#F8F9FA";
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const mix = 0.08;
  return `rgb(${Math.round(r * mix + 255 * (1 - mix))}, ${Math.round(g * mix + 255 * (1 - mix))}, ${Math.round(b * mix + 255 * (1 - mix))})`;
};

export default function Index() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [scheduleData, setScheduleData] = useState<{ [key: string]: ScheduleItem[] }>({});
  const [layerMaster, setLayerMaster] = useState<{ [key: string]: string }>({});
  const [tagMaster, setTagMaster] = useState<{ [key: string]: { layer: string; color: string } }>({});
  const [presets, setPresets] = useState<{ [key: string]: string[] }>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [activeMode, setActiveMode] = useState("calendar");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [layerModalVisible, setLayerModalVisible] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [tempPresetName, setTempPresetName] = useState("");
  const [tempActiveTags, setTempActiveTags] = useState<string[]>([]);

  const calendarKey = useMemo(() => activeMode, [activeMode]);

  // --- フィルターロジック ---
  const openFilterModal = useCallback(() => {
    setTempActiveTags(activeTags);
    setFilterModalVisible(true);
  }, [activeTags]);

  const toggleTempTag = useCallback((layer: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempActiveTags(prev => {
      const next = prev.includes(layer) ? prev.filter(t => t !== layer) : [...prev, layer];
      return next.length === Object.keys(layerMaster).length ? [] : next;
    });
  }, [layerMaster]);

  const applyFilters = useCallback(() => {
    setActiveTags(tempActiveTags);
    setFilterModalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [tempActiveTags]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, layers, pre, tags] = await Promise.all([
          AsyncStorage.getItem("myScheduleData"),
          AsyncStorage.getItem("layerMasterData"),
          AsyncStorage.getItem("filterPresets"),
          AsyncStorage.getItem("tagMasterData")
        ]);
        if (data) setScheduleData(JSON.parse(data));
        if (layers) setLayerMaster(JSON.parse(layers));
        else setLayerMaster({ "ライブ": "#34C759", "大学": "#007AFF", "生活": "#FF9500" });
        if (pre) setPresets(JSON.parse(pre));
        if (tags) setTagMaster(JSON.parse(tags));
      } catch (error) { console.error(error); }
    };
    loadData();
  }, []);

  // 🌟 パフォーマンス改善：Setを使って計算コストを劇的に削減
  const markedDatesBase = useMemo(() => {
    const marked: any = {};
    const activeTagsSet = new Set(activeTags);
    const isAllLayers = activeTags.length === 0;

    Object.keys(scheduleData).forEach((date) => {
      const dayDots = new Set<string>(); // 重複色を防ぐための集合
      
      scheduleData[date].forEach(item => {
        // 表示モードとアイテムの一致確認
        const matchesMode = (activeMode === "calendar" && item.isEvent) || 
                           (activeMode === "todo" && item.isTodo) || 
                           (activeMode === "money" && item.isExpense);
        if (!matchesMode) return;

        const itemTags = item.tags && item.tags.length > 0 ? item.tags : (item.tag ? [item.tag] : []);
        
        itemTags.forEach(tag => {
          const info = tagMaster[tag] || { layer: "生活", color: "#999" };
          // フィルター判定（Setで高速化）
          if (!isAllLayers && !activeTagsSet.has(info.layer)) return;
          
          const displayColor = isAllLayers ? (layerMaster[info.layer] || "#999") : info.color;
          dayDots.add(displayColor);
        });
      });

      if (dayDots.size > 0) {
        marked[date] = { dots: Array.from(dayDots).map(color => ({ color })) };
      }
    });
    return marked;
  }, [scheduleData, activeTags, activeMode, layerMaster, tagMaster]);

  const currentMarkedDates = useMemo(() => ({
    ...markedDatesBase,
    [selectedDate]: { 
      ...markedDatesBase[selectedDate], 
      selected: true, 
      selectedColor: activeTags.length === 1 ? (layerMaster[activeTags[0]] || "#1C1C1E") : "#1C1C1E" 
    }
  }), [markedDatesBase, selectedDate, activeTags, layerMaster]);

  const currentSolidColor = useMemo(() => activeTags.length === 1 ? layerMaster[activeTags[0]] : "#1C1C1E", [activeTags, layerMaster]);
  const currentBgColor = useMemo(() => activeTags.length === 1 ? getPastelColor(layerMaster[activeTags[0]]) : "#F8F9FA", [activeTags, layerMaster]);

  const handleOpenNewModal = () => { setSelectedItem(null); setModalVisible(true); };
  const openEditModal = (item: ScheduleItem) => { setSelectedItem(item); setModalVisible(true); };
  const toggleTodo = (date: string, id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScheduleData(prev => {
      const newData = { ...prev };
      if (newData[date]) newData[date] = newData[date].map(i => i.id === id ? { ...i, isDone: !i.isDone } : i);
      return newData;
    });
  };

  const confirmSavePreset = async () => {
    if (!tempPresetName.trim()) return;
    const newPresets = { ...presets, [tempPresetName.trim()]: tempActiveTags };
    setPresets(newPresets);
    await AsyncStorage.setItem("filterPresets", JSON.stringify(newPresets));
    setTempPresetName(""); setPresetModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderTodoItem = (item: any, itemDate: string) => {
    const itemTags = item.tags && item.tags.length > 0 ? item.tags : (item.tag ? [item.tag] : []);
    const displayColors = itemTags.map((tag: string) => {
        const info = tagMaster[tag] || { layer: "生活", color: "#999" };
        return activeTags.length === 0 ? (layerMaster[info.layer] || "#999") : info.color;
    });
    const uniqueColors = Array.from(new Set(displayColors)); 

    return (
      <TouchableOpacity key={item.id} style={[styles.todoCard, item.isDone && styles.todoCardDone]} onPress={() => openEditModal(item)} activeOpacity={0.7}>
        <View style={styles.stripeContainer}>
            {uniqueColors.map((color: any, idx: number) => (
                <View key={idx} style={[styles.todoAccent, { backgroundColor: color }]} />
            ))}
        </View>
        <View style={styles.todoContent}>
          <View style={styles.todoMainRow}>
            <Text style={[styles.todoTitle, item.isDone && styles.todoTitleDone]} numberOfLines={1}>{item.title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                {itemTags.map((tag: string, idx: number) => (
                    <View key={idx} style={[styles.miniTagBadge, { backgroundColor: displayColors[idx] + "15", borderColor: displayColors[idx] }]}>
                      <Text style={[styles.miniTagText, { color: displayColors[idx] }]}>{tag}</Text>
                    </View>
                ))}
            </ScrollView>
          </View>
          <View style={styles.todoSubRow}>
            {!item.isAllDay && item.startTime ? (
              <View style={styles.todoTimeRow}>
                <Ionicons name="time-outline" size={10} color="#8E8E93" />
                <Text style={styles.todoTimeText}>{item.startTime}{item.endTime ? ` - ${item.endTime}` : ""}</Text>
              </View>
            ) : itemDate !== selectedDate ? (
              <Text style={styles.todoTimeText}>📅 {itemDate.split('-')[1]}/{itemDate.split('-')[2]}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity style={styles.checkButton} onPress={() => toggleTodo(itemDate, item.id)}>
          <Ionicons name={item.isDone ? "checkmark-circle" : "ellipse-outline"} size={24} color={item.isDone ? "#34C759" : "#C7C7CC"} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentBgColor }]}>
      <TouchableOpacity style={[styles.header, { backgroundColor: currentBgColor }]} onPress={openFilterModal} activeOpacity={0.6}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerPrefix}>INDEX / CATEGORY</Text>
          <View style={styles.headerMainRow}>
            <Text style={styles.headerText} numberOfLines={1}>
              {activeTags.length === 0 ? "ALL_LAYERS" : activeTags.join(", ").toUpperCase()}
            </Text>
            <Ionicons name="chevron-down-outline" size={14} color="#C7C7CC" style={{ marginLeft: 6 }} />
          </View>
        </View>
      </TouchableOpacity>

      <TabBar activeMode={activeMode} setActiveMode={setActiveMode} themeColor={currentSolidColor} />

      <View style={styles.mainContent}>
        <View style={styles.calendarArea}>
          {activeMode === "money" ? (
            <View style={styles.weekCalendarWrapper}>
              <Text style={styles.monthLabel}>{parseInt(selectedDate.split('-')[1])}</Text>
              <CalendarProvider date={selectedDate} onDateChanged={setSelectedDate}>
                <WeekCalendar firstDay={1} markedDates={currentMarkedDates} theme={{ calendarBackground: 'transparent', todayTextColor: currentSolidColor, selectedDayBackgroundColor: currentSolidColor }} />
              </CalendarProvider>
            </View>
          ) : (
            <CalendarList
              key={calendarKey} markingType={"multi-dot"}
              renderHeader={(date) => (<View style={styles.monthHeaderContainer}><Text style={[styles.monthformat, { color: currentSolidColor }]}>{date.getMonth() + 1}</Text></View>)}
              horizontal pagingEnabled markedDates={currentMarkedDates} onDayPress={(day) => setSelectedDate(day.dateString)}
              theme={{ calendarBackground: "transparent", todayTextColor: currentSolidColor, selectedDayBackgroundColor: currentSolidColor }}
            />
          )}

          <ScrollView style={styles.scheduleList} contentContainerStyle={{ paddingBottom: 120 }} removeClippedSubviews={true}>
            {(() => {
              const items = scheduleData[selectedDate] || [];
              if (activeMode === "money") {
                return <MoneyDashboard scheduleData={scheduleData} setScheduleData={setScheduleData} selectedDate={selectedDate} tagMaster={tagMaster} activeTags={activeTags} layerMaster={layerMaster} setTagMaster={setTagMaster} />;
              }

              if (activeMode === "todo") {
                const dayTasks = items.filter((item) => {
                  if (!item.isTodo) return false;
                  const itemTags = item.tags && item.tags.length > 0 ? item.tags : (item.tag ? [item.tag] : []);
                  if (activeTags.length === 0) return true;
                  return itemTags.some(tag => activeTags.includes(tagMaster[tag]?.layer || "生活"));
                });

                const upcomingTasks = Object.keys(scheduleData).filter(date => date > selectedDate).sort().flatMap(date => scheduleData[date].map(task => ({ ...task, date })))
                    .filter(task => {
                        if (!task.isTodo || task.isDone) return false;
                        const itemTags = task.tags && task.tags.length > 0 ? task.tags : (task.tag ? [task.tag] : []);
                        if (activeTags.length === 0) return true;
                        return itemTags.some(tag => activeTags.includes(tagMaster[tag]?.layer || "生活"));
                    });

                const [y, m, d] = selectedDate.split('-');
                const totalDayTasks = dayTasks.length;
                const completedDayTasks = dayTasks.filter(t => t.isDone).length;
                const progress = totalDayTasks > 0 ? completedDayTasks / totalDayTasks : 0;

                return (
                  <View style={styles.todoRoot}>
                    <View style={styles.modernHeader}>
                      <View style={styles.headerLabelRow}>
                        <Text style={[styles.mainDateTitle, { color: currentSolidColor }]}>{parseInt(m)}月{parseInt(d)}日 の進捗</Text>
                        <Text style={styles.numericProgress}>{completedDayTasks} / {totalDayTasks}</Text>
                      </View>
                      {totalDayTasks > 0 && (
                        <View style={styles.thinProgressBg}>
                          <View style={[styles.thinProgressFill, { width: `${progress * 100}%`, backgroundColor: currentSolidColor }]} />
                        </View>
                      )}
                    </View>
                    {dayTasks.map(t => renderTodoItem(t, selectedDate))}
                    {upcomingTasks.length > 0 && (
                      <View style={styles.upcomingSection}>
                        <Text style={styles.upcomingMiniTitle}>今後の予定（未完了）</Text>
                        {upcomingTasks.map(t => renderTodoItem(t, t.date))}
                      </View>
                    )}
                  </View>
                );
              }

              const dayEvents = items.filter((item) => {
                if (!item.isEvent) return false;
                const itemTags = item.tags && item.tags.length > 0 ? item.tags : (item.tag ? [item.tag] : []);
                if (activeTags.length === 0) return true;
                return itemTags.some(tag => activeTags.includes(tagMaster[tag]?.layer || "生活"));
              });

              return (
                <View style={styles.listPadding}>
                  <Text style={styles.dateTitle}>{selectedDate} の予定</Text>
                  {dayEvents.map(item => {
                      const itemTags = item.tags && item.tags.length > 0 ? item.tags : (item.tag ? [item.tag] : []);
                      const displayColors = itemTags.map(tag => {
                          const info = tagMaster[tag] || { layer: "生活", color: "#999" };
                          return activeTags.length === 0 ? (layerMaster[info.layer] || "#999") : info.color;
                      });
                      return (
                        <TouchableOpacity key={item.id} style={styles.listItem} onPress={() => openEditModal(item)}>
                          <View style={{ flexDirection: 'row', gap: 4, marginRight: 8, flexWrap: 'wrap', width: '25%' }}>
                              {itemTags.map((tag, idx) => (
                                  <View key={idx} style={[styles.tagBadge, { backgroundColor: displayColors[idx] }]}>
                                      <Text style={styles.tagText}>{tag}</Text>
                                  </View>
                              ))}
                          </View>
                          <View style={styles.itemMain}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            {!item.isAllDay && item.startTime && (<Text style={styles.timeTextSmall}>{item.startTime}{item.endTime ? ` - ${item.endTime}` : ""}</Text>)}
                          </View>
                        </TouchableOpacity>
                      );
                  })}
                </View>
              );
            })()}
          </ScrollView>
        </View>
      </View>

      <Modal visible={filterModalVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.filterModalContent}>
              <View style={styles.filterModalHeader}>
                <View><Text style={styles.filterModalTitle}>表示カテゴリ</Text><Text style={styles.filterModalSubTitle}>PRESET / INDIVIDUAL</Text></View>
                <TouchableOpacity style={styles.enhancedSettingsBtn} onPress={() => { setFilterModalVisible(false); setTimeout(() => setLayerModalVisible(true), 400); }}>
                  <Ionicons name="settings-sharp" size={16} color="#1C1C1E" /><Text style={styles.settingsBtnLabel}>CONFIG</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.gridScrollArea} showsVerticalScrollIndicator={false}>
                <View style={styles.sectionTitleRow}><Text style={styles.modalSectionLabel}>PRESETS</Text>{tempActiveTags.length > 0 && (<TouchableOpacity style={styles.savePresetQuickBtn} onPress={() => setPresetModalVisible(true)}><Ionicons name="add" size={12} color={currentSolidColor} /><Text style={[styles.savePresetQuickText, { color: currentSolidColor }]}>SAVE_CURRENT</Text></TouchableOpacity>)}</View>
                <View style={styles.presetContainer}>{Object.keys(presets).map((pName) => { const isMatch = JSON.stringify(tempActiveTags.sort()) === JSON.stringify(presets[pName].sort()); return (<TouchableOpacity key={pName} style={[styles.presetBtn, isMatch && { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' }]} onPress={() => setTempActiveTags(presets[pName])}><Text style={[styles.presetBtnText, isMatch && { color: '#FFF' }]}>{pName.toUpperCase()}</Text></TouchableOpacity>); })}</View>
                <Text style={[styles.modalSectionLabel, { marginTop: 20 }]}>REGISTRY</Text>
                <View style={styles.gridContainer}><TouchableOpacity style={[styles.gridCard, tempActiveTags.length === 0 ? { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' } : styles.gridCardGhost]} onPress={() => setTempActiveTags([])}><Ionicons name={tempActiveTags.length === 0 ? "checkmark-circle" : "apps-outline"} size={20} color={tempActiveTags.length === 0 ? "#FFF" : "#1C1C1E"} /><Text style={[styles.gridCardText, tempActiveTags.length === 0 && { color: "#FFF" }]}>すべて表示</Text></TouchableOpacity>{Object.keys(layerMaster).map((layer) => { const isSelected = tempActiveTags.includes(layer); return (<TouchableOpacity key={layer} style={[styles.gridCard, isSelected ? { backgroundColor: layerMaster[layer], borderColor: layerMaster[layer] } : [styles.gridCardGhost, { borderColor: layerMaster[layer] + '40' }]]} onPress={() => toggleTempTag(layer)}><Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={18} color={isSelected ? "#FFF" : layerMaster[layer]} /><Text style={[styles.gridCardText, isSelected && { color: "#FFF" }]}>{layer}</Text></TouchableOpacity>); })}</View>
              </ScrollView>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: currentSolidColor }]} onPress={applyFilters}><Text style={styles.confirmBtnText}>表示を確定する</Text></TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Modal visible={presetModalVisible} transparent={true} animationType="fade">
        <View style={styles.namingOverlay}><View style={styles.namingContent}><Text style={styles.namingLabel}>SAVE_PRESET</Text><Text style={styles.namingTitle}>プリセット名の入力</Text><TextInput style={styles.namingInput} placeholder="PRESET_NAME..." placeholderTextColor="#AEAEB2" autoFocus={true} value={tempPresetName} onChangeText={setTempPresetName} /><View style={styles.namingActionRow}><TouchableOpacity style={styles.namingCancelBtn} onPress={() => { setPresetModalVisible(false); setTempPresetName(""); }}><Text style={styles.namingCancelText}>CANCEL</Text></TouchableOpacity><TouchableOpacity style={styles.namingConfirmBtn} onPress={confirmSavePreset}><Text style={styles.namingConfirmText}>SAVE</Text></TouchableOpacity></View></View></View>
      </Modal>

      <ScheduleModal visible={modalVisible} onClose={() => setModalVisible(false)} selectedDate={selectedDate} selectedItem={selectedItem} activeMode={activeMode} scheduleData={scheduleData} setScheduleData={setScheduleData} layerMaster={layerMaster} tagMaster={tagMaster} setTagMaster={setTagMaster} />
      <LayerManagementModal visible={layerModalVisible} onClose={() => setLayerModalVisible(false)} layerMaster={layerMaster} setLayerMaster={setLayerMaster} />

      <TouchableOpacity style={[styles.fab, { backgroundColor: currentSolidColor }]} onPress={handleOpenNewModal}><Text style={styles.fabText}>＋</Text></TouchableOpacity>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainContent: { flex: 1, backgroundColor: 'transparent' },
  calendarArea: { flex: 1, width: '100%' },
  weekCalendarWrapper: { height: 130 },
  monthLabel: { fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 20, marginTop: 10 },
  header: { paddingTop: 65, paddingBottom: 20, paddingHorizontal: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F2F7' },
  headerTitleContainer: { alignItems: 'flex-start' },
  headerPrefix: { fontSize: 10, fontWeight: "600", color: "#AEAEB2", letterSpacing: 2, marginBottom: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  headerMainRow: { flexDirection: 'row', alignItems: 'center' },
  headerText: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  scheduleList: { flex: 1, padding: 15 },
  listPadding: { paddingBottom: 20 },
  dateTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 12, color: "#666" },
  monthHeaderContainer: { width: "100%", alignItems: "flex-start" },
  monthformat: { fontSize: 28, paddingLeft: 10, paddingBottom: 5, fontWeight: "bold" },
  fab: { position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 5 },
  fabText: { fontSize: 28, color: "#fff" },
  
  todoRoot: { paddingHorizontal: 5 },
  modernHeader: { marginBottom: 20, marginTop: 5 },
  headerLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  mainDateTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  numericProgress: { fontSize: 13, fontWeight: "600", color: "#8E8E93" },
  thinProgressBg: { height: 4, backgroundColor: "#E5E5EA", borderRadius: 2, overflow: "hidden" },
  thinProgressFill: { height: "100%", borderRadius: 2 },
  upcomingSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#F2F2F7", paddingTop: 15 },
  upcomingMiniTitle: { fontSize: 12, fontWeight: "800", color: "#AEAEB2", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },

  todoCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F2F2F7", minHeight: 56 },
  todoCardDone: { backgroundColor: "transparent", borderColor: "transparent", opacity: 0.5 },
  stripeContainer: { flexDirection: 'row', height: '60%', marginLeft: 8, gap: 2 },
  todoAccent: { width: 4, height: "100%", borderRadius: 2 },
  todoContent: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  todoMainRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  todoTitle: { fontSize: 15, fontWeight: "600", color: "#1C1C1E", flex: 1, marginRight: 8 },
  todoTitleDone: { color: "#8E8E93", textDecorationLine: "line-through" },
  miniTagBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5 },
  miniTagText: { fontSize: 8, fontWeight: "bold" },
  todoSubRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  todoTimeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  todoTimeText: { fontSize: 10, color: "#8E8E93", fontWeight: "500" },
  checkButton: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: "center", alignItems: "center" },

  listItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: "#F2F2F7" },
  itemTitle: { flex: 1, fontSize: 15, color: "#333", fontWeight: 'bold' },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 2 },
  tagText: { color: "#fff", fontSize: 9, fontWeight: "bold" },
  itemMain: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeTextSmall: { fontSize: 10, color: "#8E8E93", fontWeight: "bold", marginLeft: 6 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center" },
  filterModalContent: { width: "90%", maxHeight: "80%", backgroundColor: "#FFF", borderRadius: 28, padding: 24 },
  filterModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  filterModalTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  filterModalSubTitle: { fontSize: 10, color: "#C7C7CC", textTransform: 'uppercase' },
  gridScrollArea: { marginBottom: 20 },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  gridCard: { width: "48%", paddingVertical: 16, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  gridCardGhost: { backgroundColor: 'transparent', borderColor: '#F2F2F7' },
  gridCardText: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  confirmBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  confirmBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  modalSectionLabel: { fontSize: 9, fontWeight: "800", color: "#C7C7CC", letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  presetContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F2F2F7', borderRadius: 10, borderWidth: 1, borderColor: '#F2F2F7' },
  presetBtnText: { fontSize: 10, fontWeight: '700', color: '#8E8E93' },
  enhancedSettingsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 6 },
  settingsBtnLabel: { fontSize: 10, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  savePresetQuickBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#F2F2F7' },
  savePresetQuickText: { fontSize: 9, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  namingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  namingContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 24 },
  namingLabel: { fontSize: 9, fontWeight: "800", color: "#C7C7CC", letterSpacing: 1.5, marginBottom: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  namingTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E", marginBottom: 20 },
  namingInput: { backgroundColor: '#F2F2F7', padding: 16, borderRadius: 12, fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 20 },
  namingActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  namingCancelBtn: { padding: 10 },
  namingCancelText: { fontSize: 12, fontWeight: '700', color: '#8E8E93' },
  namingConfirmBtn: { backgroundColor: '#1C1C1E', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  namingConfirmText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
});