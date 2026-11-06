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
export function renderTemplate(template: string, vars: Record<string, string>): string {
  const MISSING = '\u0000'
  const withSentinels = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key]
    return value !== undefined && value !== '' ? value : MISSING
  })
  return withSentinels
    .replace(/[「（(]\u0000[」）)]/g, '')
    .replace(/[「（(]\u0000/g, '')
    .replace(/\u0000[」）)]/g, '')
    .replace(/(?:[，,：:]\u0000|\u0000[，,：:])/g, '')
    .replace(/\u0000/g, '')
    .replace(/[，,：:]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 把毫秒时长格式化成中文口语（如「3 分 25 秒」「1 小时 5 分」）。 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`
}

/** 'HH:MM' → 当天分钟数（0..1439）。非法输入返回 undefined。 */
function timeToMinutes(hhmm: string): number | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (match === null) return undefined
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * 是否处于免打扰时段。start <= end 表示同一天内区间；start > end 表示跨午夜
 * （如 23:00–08:00）。不启用或时间非法时一律返回 false。
 */
export function isInQuietHours(
  enabled: boolean,
  start: string,
  end: string,
  now: Date = new Date(),
): boolean {
  if (!enabled) return false
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  if (startMin === undefined || endMin === undefined) return false
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin
  }
  // 跨午夜：如 23:00–08:00，23:00 之后或 08:00 之前都在时段内
  return nowMin >= startMin || nowMin < endMin
}
