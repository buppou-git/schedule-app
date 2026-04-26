import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

const { width } = Dimensions.get("window");

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (setupData: { layers: any, presets: any }) => void;
}

type TemplateData = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  layers: { [key: string]: string };
  presets: { [key: string]: string[] };
};

const TEMPLATES: TemplateData[] = [
  {
    id: "oshi",
    name: "推し活・オタク趣味",
    icon: "heart",
    color: "#FF3B30",
    description: "ライブや遠征、グッズ販売などの予定を管理。",
    layers: { "ライブ・イベント": "#FF3B30", "グッズ・物販": "#AF52DE", "チケット・遠征": "#007AFF" },
    presets: { "推し活": ["ライブ・イベント", "グッズ・物販", "チケット・遠征"] }
  },
  {
    id: "work",
    name: "仕事・ビジネス",
    icon: "briefcase",
    color: "#007AFF",
    description: "会議や出張、締切タスクなど仕事専用のレイヤー。",
    layers: { "会議・MTG": "#007AFF", "仕事タスク": "#FF3B30", "出張・外出": "#FF9500" },
    presets: { "仕事": ["会議・MTG", "仕事タスク", "出張・外出"] }
  },
  {
    id: "student",
    name: "学生・学校",
    icon: "school",
    color: "#AF52DE",
    description: "授業の課題やバイト、サークル活動を整理。",
    layers: { "授業・課題": "#007AFF", "サークル": "#FF9500", "バイト": "#34C759" },
    presets: { "学校・バイト": ["授業・課題", "サークル", "バイト"] }
  },
  {
    id: "life",
    name: "日常・プライベート",
    icon: "cafe",
    color: "#34C759",
    description: "お出かけや家計簿など、日々の生活を管理。",
    layers: { "お出かけ": "#AF52DE", "家計簿・支払い": "#FF9500", "プライベート": "#34C759" },
    presets: { "日常": ["お出かけ", "家計簿・支払い", "プライベート"] }
  }
];

export default function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleFinish = () => {
    let finalLayers: { [key: string]: string } = { "ToDo": "#1C1C1E" };
    let finalPresets: { [key: string]: string[] } = {};

    if (selectedTemplateIds.length === 0) {
      finalLayers = { "予定": "#007AFF", "ToDo": "#FF3B30", "家計簿": "#34C759" };
      finalPresets = { "基本": ["予定", "ToDo", "家計簿"] };
    } else {
      selectedTemplateIds.forEach(id => {
        const template = TEMPLATES.find(t => t.id === id);
        if (template) {
          finalLayers = { ...finalLayers, ...template.layers };
          finalPresets = { ...finalPresets, ...template.presets };
        }
      });
      finalPresets["すべて"] = Object.keys(finalLayers);
    }

    onComplete({ layers: finalLayers, presets: finalPresets });
  };

  // 🌟 追加：テンプレートを使わずにスキップする処理
  const handleSkip = () => {
    onComplete({ 
      layers: { "予定": "#007AFF", "ToDo": "#FF3B30", "家計簿": "#34C759" }, 
      presets: { "基本": ["予定", "ToDo", "家計簿"] } 
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        
        {step === 1 && (
          <View style={styles.slide}>
            <View style={styles.iconCircle}>
              <Ionicons name="calendar" size={60} color="#1C1C1E" />
            </View>
            <Text style={styles.title}>Welcome to UniCal</Text>
            <Text style={styles.subTitle}>予定、ToDo、家計簿をこの1つに。</Text>
            
            <View style={styles.featureBox}>
              <Ionicons name="layers-outline" size={24} color="#007AFF" />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>すべてが重なるカレンダー</Text>
                <Text style={styles.featureDesc}>日々のスケジュールも、毎日の習慣も、出費も、アプリを分けずに同じカレンダーの上で直感的に管理できます。</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>次へ</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.slide}>
            <Text style={styles.title}>3つのコア機能</Text>
            <Text style={styles.subTitle}>生活のすべてを、ここで一元管理。</Text>
            
            <ScrollView style={{ width: '100%', marginTop: 10 }} showsVerticalScrollIndicator={false}>
              <View style={[styles.featureBox, { marginBottom: 15 }]}>
                <Ionicons name="calendar-outline" size={28} color="#007AFF" />
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>予定 (Schedule)</Text>
                  <Text style={styles.featureDesc}>情報科学の講義やゼミ、アルバイトなど、時間が決まっているスケジュールを管理します。</Text>
                </View>
              </View>

              <View style={[styles.featureBox, { marginBottom: 15 }]}>
                <Ionicons name="checkbox-outline" size={28} color="#FF3B30" />
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>ToDo・習慣 (Tasks)</Text>
                  <Text style={styles.featureDesc}>TOEIC900点に向けた学習タスクや、「スクワット100回・腕立て60回」のような毎日の筋トレルーティンも進捗管理できます。</Text>
                </View>
              </View>

              <View style={[styles.featureBox, { marginBottom: 15 }]}>
                <Ionicons name="wallet-outline" size={28} color="#34C759" />
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>家計簿 (Money)</Text>
                  <Text style={styles.featureDesc}>参考書の購入代や交際費など、日々の出費をカレンダーに直接記録し、予算を把握できます。</Text>
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 15, width: '100%', marginTop: 20 }}>
              <TouchableOpacity style={[styles.nextBtn, { flex: 1, backgroundColor: '#E5E5EA' }]} onPress={() => setStep(1)}>
                <Text style={[styles.nextBtnText, { color: '#1C1C1E' }]}>戻る</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.nextBtn, { flex: 2 }]} onPress={handleNext}>
                <Text style={styles.nextBtnText}>次へ</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.slide}>
            <View style={[styles.iconCircle, { backgroundColor: "#007AFF15" }]}>
              <Ionicons name="cloud-outline" size={60} color="#007AFF" />
            </View>
            <Text style={styles.title}>レイヤーと共有</Text>
            <Text style={styles.subTitle}>必要な情報だけを切り替えて表示。</Text>
            
            <View style={styles.featureBox}>
              <Ionicons name="people-outline" size={24} color="#FF9500" />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>仲間と繋がる共有カレンダー</Text>
                <Text style={styles.featureDesc}>「ゼミ合宿」や「家族の予定」などをレイヤーとして追加し、URL一つでシームレスに同期できます。</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 15, width: '100%' }}>
              <TouchableOpacity style={[styles.nextBtn, { flex: 1, backgroundColor: '#E5E5EA' }]} onPress={() => setStep(2)}>
                <Text style={[styles.nextBtnText, { color: '#1C1C1E' }]}>戻る</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.nextBtn, { flex: 2 }]} onPress={handleNext}>
                <Text style={styles.nextBtnText}>次へ</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.slide}>
            <Text style={styles.title}>あなたに合わせた設定を</Text>
            <Text style={styles.subTitle}>UniCalをどのような用途で使いますか？</Text>
            <Text style={styles.hintText}>複数選択可能です。選んだ用途に合わせて、カテゴリ（レイヤー）と表示プリセットを自動でセットアップします。</Text>

            <ScrollView style={{ width: '100%', marginTop: 20 }} showsVerticalScrollIndicator={false}>
              {TEMPLATES.map(template => {
                const isSelected = selectedTemplateIds.includes(template.id);
                return (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateCard,
                      isSelected && { borderColor: template.color, backgroundColor: template.color + "10" }
                    ]}
                    onPress={() => toggleTemplate(template.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.templateIcon, { backgroundColor: template.color + "20" }]}>
                      <Ionicons name={template.icon as any} size={24} color={template.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateDesc}>{template.description}</Text>
                    </View>
                    <Ionicons 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={28} 
                      color={isSelected ? template.color : "#E5E5EA"} 
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 15, width: '100%', marginTop: 20 }}>
              <TouchableOpacity style={[styles.nextBtn, { flex: 1, backgroundColor: '#E5E5EA' }]} onPress={() => setStep(3)}>
                <Text style={[styles.nextBtnText, { color: '#1C1C1E' }]}>戻る</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.nextBtn, { flex: 2, opacity: selectedTemplateIds.length > 0 ? 1 : 0.5 }]} 
                onPress={handleFinish}
                disabled={selectedTemplateIds.length === 0}
              >
                <Text style={styles.nextBtnText}>UniCal をはじめる</Text>
              </TouchableOpacity>
            </View>

            {/* 🌟 追加：スキップして自分で設定するボタン */}
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipBtnText}>テンプレートを使わずに自分で設定する</Text>
            </TouchableOpacity>

          </View>
        )}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, paddingTop: 80 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#F2F2F7", justifyContent: "center", alignItems: "center", marginBottom: 30 },
  title: { fontSize: 28, fontWeight: "900", color: "#1C1C1E", marginBottom: 10, textAlign: "center" },
  subTitle: { fontSize: 16, color: "#8E8E93", fontWeight: "600", marginBottom: 20, textAlign: "center" },
  
  featureBox: { flexDirection: "row", backgroundColor: "#F8F8FA", padding: 20, borderRadius: 16, width: "100%", alignItems: "center", gap: 15 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 16, fontWeight: "bold", color: "#1C1C1E", marginBottom: 5 },
  featureDesc: { fontSize: 13, color: "#8E8E93", lineHeight: 20 },
  
  hintText: { fontSize: 13, color: "#8E8E93", textAlign: "center", marginBottom: 10, lineHeight: 20 },
  
  templateCard: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 2, borderColor: "#F2F2F7", borderRadius: 16, marginBottom: 12, gap: 15 },
  templateIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  templateName: { fontSize: 16, fontWeight: "bold", color: "#1C1C1E", marginBottom: 4 },
  templateDesc: { fontSize: 12, color: "#8E8E93", lineHeight: 18 },

  nextBtn: { backgroundColor: "#1C1C1E", width: "100%", paddingVertical: 18, borderRadius: 16, alignItems: "center", marginTop: 'auto' },
  nextBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },

  skipBtn: { marginTop: 15, paddingVertical: 10, paddingHorizontal: 10, marginBottom: Platform.OS === 'ios' ? 20 : 10 },
  skipBtnText: { color: "#8E8E93", fontSize: 13, fontWeight: "bold", textAlign: "center", textDecorationLine: "underline" }
});