// japanese-holidays.d.ts
declare module 'japanese-holidays' {
    /**
     * 指定した日付が祝日であれば祝日名を、祝日でなければ undefined を返します。
     */
    export function isJPHoliday(date: Date): string | undefined;
  
    /**
     * 指定した年の祝日一覧を取得します。
     */
    export function getHolidaysOf(year: number): any[];
  }