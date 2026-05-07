import { useMemo } from "react";
import { ScheduleItem } from "../types";

// 🌟 ① データマージ＆フィルタリング専用のフック
export function useDisplayData(
  scheduleData: { [key: string]: ScheduleItem[] },
  externalEvents: { [key: string]: ScheduleItem[] },
  roomSchedules: { [roomId: string]: { [date: string]: ScheduleItem[] } },
  activeTags: string[],
  tagMaster: { [key: string]: any }
) {
  // 💣 爆弾撤去 1: 「データの結合」は、予定が追加・編集された時だけ実行する！
  const mergedAllData = useMemo(() => {
    const combinedMap: { [date: string]: Map<string, ScheduleItem> } = {};

    const getMapForDate = (date: string) => {
      if (!combinedMap[date]) combinedMap[date] = new Map();
      return combinedMap[date];
    };

    Object.keys(externalEvents).forEach((date) => {
      const map = getMapForDate(date);
      externalEvents[date].forEach((item) => {
        const rawId = item.id.replace("ext_", "");
        map.set(rawId, { ...item, externalEventId: rawId, color: "#FF2D55", isEvent: true });
      });
    });

    Object.keys(scheduleData).forEach((date) => {
      const map = getMapForDate(date);
      scheduleData[date].forEach((item) => {
        const key = item.externalEventId ? item.externalEventId : item.id;
        if (item.category === "外部カレンダー" || item.externalEventId) {
          item.color = "#FF2D55";
        }
        map.set(key, item);
      });
    });

    Object.values(roomSchedules).forEach((roomData) => {
      Object.keys(roomData).forEach((date) => {
        const map = getMapForDate(date);
        roomData[date].forEach((item) => {
          const key = item.externalEventId ? item.externalEventId : item.id;
          map.set(key, item);
        });
      });
    });

    return combinedMap;
  }, [scheduleData, externalEvents, roomSchedules]);

  // 💣 爆弾撤去 2: レイヤーを切り替えた時は「フィルター」だけを実行する！（爆速化）
  const displayData = useMemo(() => {
    const result: { [date: string]: ScheduleItem[] } = {};
    Object.keys(mergedAllData).forEach((date) => {
      const items = Array.from(mergedAllData[date].values());
      result[date] = items.filter((item) => {
        let itemLayer = "共通";

        if (item.category === "外部カレンダー" || item.externalEventId) {
          itemLayer = "外部予定";
        } else {
          const itemTags = item.tags && item.tags.length > 0 ? item.tags : (item.tag ? [item.tag] : []);
          if (itemTags.length > 0) {
            itemLayer = tagMaster[itemTags[0]]?.layer || "共通";
          }
        }

        if (activeTags.length === 0) return true;
        return activeTags.includes(itemLayer);
      });
    });
    return result;
  }, [mergedAllData, activeTags, tagMaster]);

  return displayData;
}

// 🌟 ② 1日の予定・今後のタスク仕分け専用のフック
export function useDailyItems(
  expandedScheduleData: { [date: string]: ScheduleItem[] },
  displayData: { [date: string]: ScheduleItem[] },
  selectedDate: string,
  activeTags: string[],
  activeMode: string,
  tagMaster: { [key: string]: any }
) {
  return useMemo(() => {
    const items = expandedScheduleData[selectedDate] || [];
    const isAllLayers = activeTags.length === 0;
    const activeTagsSet = new Set(activeTags);

    const dTasks: ScheduleItem[] = [];
    const dEvents: ScheduleItem[] = [];

    items.forEach((item: ScheduleItem) => {
      const itemTags = item.tags && item.tags.length > 0 ? item.tags : item.tag ? [item.tag] : [];
      const isExternal = item.category === "外部カレンダー" || !!item.externalEventId;
      const matchLayer =
        isAllLayers ||
        (isExternal && activeTagsSet.has("外部予定")) ||
        itemTags.some((tag: string) => {
          if (tag === "祝日") return true;
          const parentLayer = tagMaster[tag]?.layer || tag;
          return activeTagsSet.has(parentLayer);
        });
      if (matchLayer) {
        if (item.isTodo) dTasks.push(item);
        if (item.isEvent) dEvents.push(item);
      }
    });

    const uTasks: (ScheduleItem & { date: string })[] = [];
    const dayTaskIds = new Set(dTasks.map((t) => t.id));
    const addedUpcomingIds = new Set<string>();

    if (activeMode === "todo") {
      const sortedDates = Object.keys(expandedScheduleData).sort();
      sortedDates.forEach((date) => {
        if (date > selectedDate) {
          (displayData[date] || []).forEach((task) => {
            if (
              task.isTodo &&
              !task.isDone &&
              !task.repeatType &&
              !dayTaskIds.has(task.id) &&
              !addedUpcomingIds.has(task.id)
            ) {
              const itemTags = task.tags && task.tags.length > 0 ? task.tags : task.tag ? [task.tag] : [];
              if (
                isAllLayers ||
                itemTags.some((tag) => {
                  const parentLayer = tagMaster[tag]?.layer || tag;
                  return activeTagsSet.has(parentLayer);
                })
              ) {
                uTasks.push({ ...task, date });
                addedUpcomingIds.add(task.id);
              }
            }
          });
        }
      });
    }

    const sortByTime = (a: ScheduleItem, b: ScheduleItem) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      const timeA = a.startTime || "24:00";
      const timeB = b.startTime || "24:00";
      return timeA.localeCompare(timeB);
    };

    dTasks.sort(sortByTime);
    dEvents.sort(sortByTime);
    uTasks.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return sortByTime(a, b);
    });

    return { dayTasks: dTasks, upcomingTasks: uTasks, dayEvents: dEvents };
  }, [expandedScheduleData, selectedDate, activeTags, activeMode, tagMaster, displayData]);
}