// hooks/useAppModals.ts
import { useState } from "react";
import { ScheduleItem, SubTask } from "../types"; // パスは環境に合わせてください

export function useAppModals() {
  // ⚙️ 設定・その他系モーダル
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [layerModalVisible, setLayerModalVisible] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // 📅 スケジュール編集・追加系モーダル
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);

  // ⚡️ クイックアクション（簡易編集）
  const [quickActionVisible, setQuickActionVisible] = useState(false);
  const [quickActionItem, setQuickActionItem] = useState<ScheduleItem | null>(null);

  // 🌍 外部カレンダー専用モーダル
  const [externalModalVisible, setExternalModalVisible] = useState(false);
  const [selectedExternalItem, setSelectedExternalItem] = useState<ScheduleItem | null>(null);

  // ☑️ サブタスク編集モーダル
  const [subTaskModalVisible, setSubTaskModalVisible] = useState(false);
  const [editingSubTaskInfo, setEditingSubTaskInfo] = useState<{
    parentId: string;
    parentTitle: string;
    date: string;
    subTask: SubTask;
  } | null>(null);

  // 💾 プリセット関連モーダル
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [editPresetModalVisible, setEditPresetModalVisible] = useState(false);

  return {
    configModalVisible, setConfigModalVisible,
    layerModalVisible, setLayerModalVisible,
    onboardingVisible, setOnboardingVisible,
    searchModalVisible, setSearchModalVisible,
    filterModalVisible, setFilterModalVisible,
    modalVisible, setModalVisible,
    selectedItem, setSelectedItem,
    quickActionVisible, setQuickActionVisible,
    quickActionItem, setQuickActionItem,
    externalModalVisible, setExternalModalVisible,
    selectedExternalItem, setSelectedExternalItem,
    subTaskModalVisible, setSubTaskModalVisible,
    editingSubTaskInfo, setEditingSubTaskInfo,
    presetModalVisible, setPresetModalVisible,
    editPresetModalVisible, setEditPresetModalVisible,
  };
}