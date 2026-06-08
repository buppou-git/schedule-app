import { ScheduleItem } from "../types";

export function resolveTags(item: ScheduleItem) {
  const parent = item.layer || "共通";
  const sub = item.tags?.[1] || item.tag || parent;
  return { parent, sub };
}
