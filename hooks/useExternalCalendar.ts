import AsyncStorage from '@react-native-async-storage/async-storage'; // 🌟 追加
import * as Calendar from 'expo-calendar';
import { useEffect, useState } from 'react';
import { ScheduleItem } from '../types';

export function useExternalCalendar(selectedDate: string) {
  const [externalEvents, setExternalEvents] = useState<{ [date: string]: ScheduleItem[] }>({});

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // 🌟 追加：同期スイッチがONか確認する
        const isSyncEnabled = await AsyncStorage.getItem("externalCalendarSync");
        if (isSyncEnabled !== "true") {
          setExternalEvents({}); // OFFなら空にする
          return;
        }

        const { status } = await Calendar.getCalendarPermissionsAsync();
        if (status !== 'granted') return;

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calendarIds = calendars.map(c => c.id);
        if (calendarIds.length === 0) return;

        const calendarColorMap: { [id: string]: string } = {};
        calendars.forEach(c => { calendarColorMap[c.id] = c.color; });

        const targetDate = new Date(selectedDate);
        const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
        const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 2, 0);

        const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
        const newExternalEvents: { [date: string]: ScheduleItem[] } = {};

        events.forEach(event => {
          const eventStart = new Date(event.startDate);
          const eventEnd = new Date(event.endDate);
          const dateStr = `${eventStart.getFullYear()}-${String(eventStart.getMonth() + 1).padStart(2, "0")}-${String(eventStart.getDate()).padStart(2, "0")}`;

          const formattedEvent: ScheduleItem = {
            id: `ext_${event.id}`,
            title: event.title,
            amount: 0,
            isDone: false,
            color: calendarColorMap[event.calendarId] || "#8E8E93",
            isEvent: true,
            isTodo: false,
            isExpense: false,
            tag: "外部予定",
            tags: ["外部予定"],
            category: "外部カレンダー",
            isAllDay: event.allDay,
            startDate: dateStr,
            endDate: `${eventEnd.getFullYear()}-${String(eventEnd.getMonth() + 1).padStart(2, "0")}-${String(eventEnd.getDate()).padStart(2, "0")}`,
            startTime: event.allDay ? undefined : `${String(eventStart.getHours()).padStart(2, "0")}:${String(eventStart.getMinutes()).padStart(2, "0")}`,
            endTime: event.allDay ? undefined : `${String(eventEnd.getHours()).padStart(2, "0")}:${String(eventEnd.getMinutes()).padStart(2, "0")}`,
          };

          if (!newExternalEvents[dateStr]) newExternalEvents[dateStr] = [];
          newExternalEvents[dateStr].push(formattedEvent);
        });

        setExternalEvents(newExternalEvents);
      } catch (error) {
        console.error("External Calendar Error: ", error);
      }
    };

    fetchEvents();
  }, [selectedDate]);

  return { externalEvents };
}