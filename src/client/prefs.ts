/**
 * dsh-voice-announcer — client prefs (localStorage).
 *
 * 偏好全部存在浏览器 localStorage 里，零后端。loadPrefs 必须返回稳定引用
 * （React 的 useSyncExternalStore 用 Object.is 比较快照）。
 */

/** 每类事件的播报方式。 */
export type SoundMode = 'off' | 'beep' | 'tts' | 'custom'

export interface EventSoundConfig {
  /** 播报方式：off=关闭 / beep=合成音效 / tts=浏览器朗读 / custom=自定义音频 URL。 */
  mode: SoundMode
  /** custom 模式：音频文件 URL（http(s) 或 data: 均可）。 */
  customUrl: string
  /** tts 模式：朗读的文本（空则用默认文案）。 */
  ttsText: string
}

export interface AnnouncerPrefs {
  /** 总开关。 */
  enabled: boolean
  /** 音量 0~1。 */
  volume: number
  /** 连续触发去抖毫秒数：同一事件在窗口期内只播一次。 */
  debounceMs: number
  /** 任务开始播报。 */
  start: EventSoundConfig
  /** 任务完成播报。 */
  complete: EventSoundConfig
  /** 任务失败播报。 */
  error: EventSoundConfig
}

export const DEFAULT_PREFS: AnnouncerPrefs = {
  enabled: true,
  volume: 0.7,
  debounceMs: 1500,
  start: { mode: 'beep', customUrl: '', ttsText: '任务开始' },
  complete: { mode: 'tts', customUrl: '', ttsText: '任务已完成' },
  error: { mode: 'tts', customUrl: '', ttsText: '任务失败，请检查' },
}

export const PREFS_KEY = 'dsh-voice-announcer.prefs'

function isSoundMode(value: unknown): value is SoundMode {
  return value === 'off' || value === 'beep' || value === 'tts' || value === 'custom'
}

function mergeEventConfig(
  raw: unknown,
  fallback: EventSoundConfig,
): EventSoundConfig {
  const input = (raw ?? {}) as Partial<EventSoundConfig>
  return {
    mode: isSoundMode(input.mode) ? input.mode : fallback.mode,
    customUrl: typeof input.customUrl === 'string' ? input.customUrl : fallback.customUrl,
    ttsText: typeof input.ttsText === 'string' ? input.ttsText : fallback.ttsText,
  }
}

function mergePrefs(raw: unknown): AnnouncerPrefs {
  const input = (raw ?? {}) as Partial<AnnouncerPrefs>
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_PREFS.enabled,
    volume: typeof input.volume === 'number' && input.volume >= 0 && input.volume <= 1
      ? input.volume
      : DEFAULT_PREFS.volume,
    debounceMs: typeof input.debounceMs === 'number' && input.debounceMs >= 0
      ? input.debounceMs
      : DEFAULT_PREFS.debounceMs,
    start: mergeEventConfig(input.start, DEFAULT_PREFS.start),
    complete: mergeEventConfig(input.complete, DEFAULT_PREFS.complete),
    error: mergeEventConfig(input.error, DEFAULT_PREFS.error),
  }
}

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

let current: AnnouncerPrefs = (() => {
  const store = storage()
  if (store !== undefined) {
    try {
      const raw = store.getItem(PREFS_KEY)
      if (raw !== null) return mergePrefs(JSON.parse(raw) as unknown)
    } catch {
      // 损坏的 JSON 直接回退默认值
    }
  }
  return { ...DEFAULT_PREFS }
})()

export function loadPrefs(): AnnouncerPrefs {
  return current
}

export function updatePrefs(patch: Partial<AnnouncerPrefs>): AnnouncerPrefs {
  const next = mergePrefs({ ...current, ...patch })
  current = next
  const store = storage()
  if (store !== undefined) {
    try {
      store.setItem(PREFS_KEY, JSON.stringify(next))
    } catch {
      // 隐私模式 / 存储满：仅保留内存态
    }
  }
  notifyPrefsChanged()
  return next
}

const listeners = new Set<() => void>()

export function subscribePrefs(callback: () => void): () => void {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}

export function notifyPrefsChanged(): void {
  for (const listener of [...listeners]) listener()
}
