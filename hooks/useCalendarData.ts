import * as JapaneseHolidays from "japanese-holidays";
import { useMemo } from "react";
import { ScheduleItem } from "../types";

export function useCalendarData(
  scheduleData: { [key: string]: ScheduleItem[] },
  activeMode: string,
  activeTags: string[],
  layerMaster: Record<string, string>,
  tagMaster: Record<string, { layer: string; color: string }>,
  selectedDate: string,
  hiddenExternalIds: string[] = [],
  isHolidayEnabled: boolean = true, // 🌟 追加：オンオフ設定の引数を受け取る
) {
  // 🧠 1. 繰り返し予定を自動生成するロジック（🔥 遅延評価アルゴリズム）
  const expandedScheduleData = useMemo(() => {
    const expanded: { [key: string]: ScheduleItem[] } = {};
    const targetDateObj = new Date(selectedDate);

    // 前後6ヶ月の限界ラインを設定
    const limitStartDate = new Date(targetDateObj);
    limitStartDate.setMonth(limitStartDate.getMonth() - 6);

    const limitEndDate = new Date(targetDateObj);
    limitEndDate.setMonth(limitEndDate.getMonth() + 6);

    Object.keys(scheduleData).forEach((dateStr) => {
      if (!expanded[dateStr]) expanded[dateStr] = [];

      const processedBaseItems = scheduleData[dateStr]
        .filter(
          (item) =>
            !item.exceptionDates?.includes(dateStr) &&
            !hiddenExternalIds.includes(item.id),
        )
        .map((item) => {
          if (item.repeatType) {
            const isSpecificDone =
              item.completedDates?.includes(dateStr) || false;
            return { ...item, isDone: isSpecificDone };
          }
          return item;
        });
      expanded[dateStr].push(...processedBaseItems);

      scheduleData[dateStr].forEach((item) => {
        if (item.repeatType) {
          let currentDate = new Date(dateStr);

          while (true) {
            if (item.repeatType === "daily")
              currentDate.setDate(currentDate.getDate() + 1);
            else if (item.repeatType === "weekly")
              currentDate.setDate(currentDate.getDate() + 7);
            else if (item.repeatType === "monthly")
              currentDate.setMonth(currentDate.getMonth() + 1);
            else if (item.repeatType === "custom") {
              currentDate.setDate(currentDate.getDate() + 1);
              const dayOfWeek = currentDate.getDay();
              const startDateTime = new Date(dateStr).getTime();
              const currentDateTime = currentDate.getTime();
              const diffWeeks = Math.floor(
                (currentDateTime - startDateTime) / (7 * 24 * 60 * 60 * 1000),
              );
              const isMatchDay = item.repeatDays?.includes(dayOfWeek);
              const isMatchInterval =
                diffWeeks % (item.repeatInterval || 1) === 0;
              if (!(isMatchDay && isMatchInterval)) continue;
            } else {
              // 🌟 追加：想定外の repeatType が来たら無限ループを防ぐために強制終了！
              break;
            }

            if (currentDate > limitEndDate) break;
            if (currentDate < limitStartDate) continue;

            const nextDateStr = currentDate.toISOString().split("T")[0];
            if (item.repeatEndDate && nextDateStr > item.repeatEndDate) break;
            if (item.exceptionDates?.includes(nextDateStr)) continue;
            if (!expanded[nextDateStr]) expanded[nextDateStr] = [];
            const exists = expanded[nextDateStr].some(
              (i) => i.id === item.id || i.linkedMasterId === item.id,
            );
            if (!exists) {
              const isSpecificDone =
                item.completedDates?.includes(nextDateStr) || false;
              expanded[nextDateStr].push({ ...item, isDone: isSpecificDone });
            }
          }
        }
      });
    });

    // --- 祝日の自動生成 ---
    let currentDate = new Date(limitStartDate);
    while (currentDate <= limitEndDate) {
      // 🌟 修正：スイッチがオンの時だけ祝日を判定・生成する
      const holidayName = isHolidayEnabled
        ? JapaneseHolidays.isHoliday(currentDate)
        : undefined;

      if (holidayName) {
        const dateStr = currentDate.toISOString().split("T")[0];
        if (!expanded[dateStr]) expanded[dateStr] = [];

        const holidayId = `holiday-${dateStr}`;
        const exists = expanded[dateStr].some((i) => i.id === holidayId);

        if (!exists) {
          // 🌟 究極のフィルター突破ロジック：
          // リスト表示側の裏側にある「実在するカレンダーチェック」を確実に突破させるため、
          // 単一レイヤーモードならそのレイヤー、全体表示ならlayerMasterに実在する最初のレイヤーに所属を動的に偽装します！
          const validLayers = Object.keys(layerMaster);
          const holidayLayer =
            activeTags.length === 1
              ? activeTags[0]
              : validLayers.length > 0
                ? validLayers[0]
                : "共通";

          const holidayItem: ScheduleItem = {
            id: holidayId,
            title: holidayName,
            startDate: `${dateStr}T00:00:00`,
            endDate: `${dateStr}T23:59:59`,
            isEvent: true,
            isTodo: false,
            color: "#FF3B30", // 祝日は真っ赤なデザイン
            tag: "祝日",

            // 🌟 フィルターをすり抜けるための正しいカレンダー情報を注入
            tags: [holidayLayer, "祝日"],
            layer: holidayLayer,
            category: "祝日",

            amount: 0,
            isDone: false,
            isExpense: false,
            subTasks: [],
            repeatType: undefined,
          };

          expanded[dateStr].unshift(holidayItem);
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return expanded;
    // 🌟 修正：設定（オンオフ）やカレンダー切り替え（activeTags）が変わった時にも即座に再計算を走らせる
  }, [
    scheduleData,
    selectedDate.substring(0, 7),
    isHolidayEnabled,
    activeTags,
    layerMaster,
    hiddenExternalIds,
  ]);

  // 🧠 2. カレンダーのドット（色）を計算するロジック
  const markedDatesBase = useMemo(() => {
    const marked: Record<string, { dots: { color: string }[] }> = {};
    const activeTagsSet = new Set(activeTags);
    const isAllLayers = activeTags.length === 0;

    Object.keys(expandedScheduleData).forEach((date) => {
      const dayDots = new Set<string>();
      expandedScheduleData[date].forEach((item) => {
        const matchesMode =
          (activeMode === "calendar" && item.isEvent) ||
          (activeMode === "todo" && item.isTodo) ||
          (activeMode === "money" && item.isExpense);
        if (!matchesMode) return;

        const itemTags =
          item.tags && item.tags.length > 0
            ? item.tags
            : item.tag
              ? [item.tag]
              : ["共通"];

        itemTags.forEach((tag: string) => {
          const info = tagMaster[tag] || { layer: tag };

          const finalColor =
            item.color || // ① 個別の色設定（外部カレンダーやカスタム色）
            tagMaster[tag]?.color || // ② タグごとの色
            layerMaster[info.layer] || // ③ レイヤー全体の色
            "#999"; // ④ どれもなければグレー

          // フィルタリング（表示設定）のチェック
          if (!isAllLayers && !activeTagsSet.has(info.layer) && tag !== "祝日")
            return;

          dayDots.add(finalColor);
        });
      });
      if (dayDots.size > 0)
        marked[date] = {
          dots: Array.from(dayDots).map((color) => ({ color })),
        };
    });
    return marked;
  }, [expandedScheduleData, activeTags, activeMode, layerMaster, tagMaster]);

  // 🧠 3. 選択された日付の背景色を追加するロジック
  const currentMarkedDates = useMemo(
    () => ({
      ...markedDatesBase,
      [selectedDate]: {
        ...(markedDatesBase[selectedDate] || {}),
        selected: true,
        selectedColor:
          activeTags.length === 1
            ? layerMaster[activeTags[0]] || "#1C1C1E"
            : "#1C1C1E",
      },
    }),
    [markedDatesBase, selectedDate, activeTags, layerMaster],
  );

  return { expandedScheduleData, currentMarkedDates };
}
