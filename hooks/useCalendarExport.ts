// hooks/useCalendarExport.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

export const exportToStandardCalendar = async (
  title: string,
  startDate: Date,
  endDate: Date,
  isAllDay: boolean,
  existingEventId?: string, // 🌟 追加：上書き用のID
): Promise<string | null> => {
  try {
    const isSyncEnabled = await AsyncStorage.getItem("externalCalendarSync");
    if (isSyncEnabled !== "true") return null;

    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== "granted") return null;

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );
    let targetCalendarId = null;

    if (Platform.OS === "ios") {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      targetCalendarId = defaultCalendar.id;
    } else {
      const primaryCalendars = calendars.filter((c) => c.isPrimary);
      if (primaryCalendars.length > 0)
        targetCalendarId = primaryCalendars[0].id;
      else if (calendars.length > 0) targetCalendarId = calendars[0].id;
    }

    if (targetCalendarId) {
      const eventDetails = {
        title: title,
        startDate: startDate,
        endDate: endDate,
        allDay: isAllDay,
      };

      if (existingEventId) {
        // 🌟 すでにIDがある場合は上書き
        await Calendar.updateEventAsync(existingEventId, eventDetails);
        return existingEventId;
      } else {
        // 🌟 新規作成してIDを返す
        const newId = await Calendar.createEventAsync(
          targetCalendarId,
          eventDetails,
        );
        return newId;
      }
    }
    return null;
  } catch (error) {
    console.error("カレンダーエクスポートエラー:", error);
    return null;
  }
};
