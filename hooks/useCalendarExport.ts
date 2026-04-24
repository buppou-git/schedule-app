// hooks/useCalendarExport.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export const exportToStandardCalendar = async (
  title: string,
  startDate: Date,
  endDate: Date,
  isAllDay: boolean
) => {
  try {
    // 同期スイッチがONか確認
    const isSyncEnabled = await AsyncStorage.getItem("externalCalendarSync");
    if (isSyncEnabled !== "true") return; // OFFなら何もしない

    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== 'granted') return;

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    let targetCalendarId = null;

    if (Platform.OS === 'ios') {
      // iPhoneの場合、デフォルトカレンダーを取得
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      targetCalendarId = defaultCalendar.id;
    } else {
      // Androidの場合、メインのアカウント（Google等）のカレンダーを探す
      const primaryCalendars = calendars.filter(c => c.isPrimary);
      if (primaryCalendars.length > 0) {
        targetCalendarId = primaryCalendars[0].id;
      } else if (calendars.length > 0) {
        targetCalendarId = calendars[0].id;
      }
    }

    if (targetCalendarId) {
      await Calendar.createEventAsync(targetCalendarId, {
        title: title,
        startDate: startDate,
        endDate: endDate,
        allDay: isAllDay,
      });
      console.log("外部カレンダーへのエクスポート成功！🚀");
    }
  } catch (error) {
    console.error("カレンダーエクスポートエラー:", error);
  }
};