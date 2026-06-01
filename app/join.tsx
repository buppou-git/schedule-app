import { Redirect, useLocalSearchParams } from 'expo-router';

export default function JoinScreen() {
  // URLのパラメータ（?room=xxx）を取得
  const params = useLocalSearchParams();

  // roomパラメータがあれば、それを付けたままホーム（/）にリダイレクト
  if (params.room) {
    return <Redirect href={`/?room=${params.room}`} />;
  }

  // なければそのままホームへ
  return <Redirect href="/" />;
}