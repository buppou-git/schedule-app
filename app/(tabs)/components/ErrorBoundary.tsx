import { Ionicons } from "@expo/vector-icons";
import React, { ErrorInfo, ReactNode } from "react";
import { SafeAreaView, Text, TouchableOpacity } from "react-native";

import crashlytics from '@react-native-firebase/crashlytics';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

// 🌟 ErrorBoundary は React の仕様上、クラスコンポーネントで書く必要があります
export class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    // エラーをキャッチしたら状態を更新する
    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    // エラーのログを記録する
    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("【クラッシュ検知】:", error, errorInfo);

        // Crashlytics にエラーの報告を送信する
        crashlytics().recordError(error);

        // (オプション) エラーが起きたコンポーネントのツリー情報も送る
        crashlytics().log(errorInfo.componentStack || "スタック情報なし");
    }

    // 復帰ボタンを押したときの処理
    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F8FA", justifyContent: "center", alignItems: "center", padding: 20 }}>
                    <Ionicons name="warning" size={60} color="#FF3B30" style={{ marginBottom: 20 }} />
                    <Text style={{ fontSize: 20, fontWeight: "bold", color: "#1C1C1E", marginBottom: 10 }}>
                        問題が発生しました
                    </Text>
                    <Text style={{ fontSize: 14, color: "#8E8E93", textAlign: "center", marginBottom: 30, lineHeight: 20 }}>
                        画面の読み込み中に予期せぬエラーが起きました。{"\n"}ご不便をおかけして申し訳ありません。
                    </Text>
                    <TouchableOpacity
                        onPress={this.handleReset}
                        style={{ backgroundColor: "#007AFF", paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, shadowColor: "#007AFF", shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
                    >
                        <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "bold" }}>アプリを再読み込み</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}