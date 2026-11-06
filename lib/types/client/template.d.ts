/**
 * dsh-voice-announcer — announcement text helpers.
 *
 * 播报文案模板渲染（{{title}} / {{duration}} / {{error}}）、
 * 用时格式化、免打扰时段判断。纯函数，无副作用。
 */
/**
 * 把模板里的 {{var}} 替换成实际值。缺失（或为空）的变量会连同紧邻的成对
 * 标点一起剔除，避免出现「任务「」已完成」这类空壳文案：
 *   「任务「{{title}}」已完成」 在 title 缺失时 → 「任务已完成」
 *   末尾残留的「原因：」也会被清掉。
 */
export declare function renderTemplate(template: string, vars: Record<string, string>): string;
/** 把毫秒时长格式化成中文口语（如「3 分 25 秒」「1 小时 5 分」）。 */
export declare function formatDuration(ms: number): string;
/**
 * 是否处于免打扰时段。start <= end 表示同一天内区间；start > end 表示跨午夜
 * （如 23:00–08:00）。不启用或时间非法时一律返回 false。
 */
export declare function isInQuietHours(enabled: boolean, start: string, end: string, now?: Date): boolean;
