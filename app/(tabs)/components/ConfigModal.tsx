// components/ConfigModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ConfigModal({ visible, onClose, lastSyncedAt, onRestore }: any) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>設定</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={28} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll}>
          {/* データ管理セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>データ管理</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.rowTitle}>クラウド同期状態</Text>
                  <Text style={styles.rowSub}>最終同期: {lastSyncedAt || "未同期"}</Text>
                </View>
                <Ionicons name="cloud-done-outline" size={20} color="#34C759" />
              </View>
              
              <View style={styles.divider} />

              <TouchableOpacity 
                style={styles.row} 
                onPress={() => {
                  Alert.alert(
                    "データの復元",
                    "クラウドから最新データを読み込みます。現在の端末にある未保存のデータは上書きされますがよろしいですか？",
                    [
                      { text: "キャンセル", style: "cancel" },
                      { text: "復元する", style: "destructive", onPress: onRestore }
                    ]
                  );
                }}
              >
                <Text style={[styles.rowTitle, { color: "#007AFF" }]}>クラウドからデータを復元</Text>
                <Ionicons name="download-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 情報セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>アプリ情報</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>バージョン</Text>
                <Text style={styles.rowValue}>1.0.0</Text>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row}>
                <Text style={styles.rowTitle}>利用規約（準備中）</Text>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row}>
                <Text style={styles.rowTitle}>プライバシーポリシー（準備中）</Text>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footerText}>Developed by Kanta Hirano</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8'
  },
  title: { fontSize: 17, fontWeight: '600' },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  section: { marginTop: 25 },
  sectionLabel: { marginHorizontal: 20, marginBottom: 8, fontSize: 13, color: "#6E6E73", textTransform: 'uppercase' },
  card: { backgroundColor: "#FFF", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#C6C6C8" },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, minHeight: 44 },
  rowTitle: { fontSize: 16 },
  rowSub: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  rowValue: { fontSize: 16, color: "#8E8E93" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#C6C6C8", marginLeft: 20 },
  footerText: { textAlign: 'center', marginTop: 40, marginBottom: 20, color: "#8E8E93", fontSize: 12 }
});