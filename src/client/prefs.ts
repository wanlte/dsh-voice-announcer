/**
 * dsh-voice-announcer — client prefs (localStorage).
 *
 * 偏好全部存在浏览器 localStorage 里，零后端。loadPrefs 必须返回稳定引用
 * （React 的 useSyncExternalStore 用 Object.is 比较快照）。
 */

import { VOICE_PACK_IDS, type VoicePackId } from './voicepacks.ts'

/** 每类事件的播报方式。 */
export type SoundMode = 'off' | 'beep' | 'pack' | 'tts' | 'custom'

/** 合成音效的风格预设（Web Audio 实时合成，零文件）。 */
export type BeepPreset = 'classic' | 'chime' | 'marimba' | 'bell' | 'pulse' | 'coin'

export const BEEP_PRESETS: readonly BeepPreset[] = ['classic', 'chime', 'marimba', 'bell', 'pulse', 'coin']

export interface EventSoundConfig {
  /** 播报方式：off=关闭 / beep=合成音效 / pack=内置人声语音包 / tts=浏览器朗读 / custom=自定义音频 URL。 */
  mode: SoundMode
  /** beep 模式：音效风格预设。 */
  beepPreset: BeepPreset
  /** pack 模式：内置语音包 id。 */
  packId: VoicePackId
  /** custom 模式：音频文件 URL（http(s) 或 data: 均可）。 */
  customUrl: string
  /** tts 模式：朗读的文本（空则用默认文案；旧版本字段，v0.2 起推荐用 template）。 */
  ttsText: string
  /**
   * tts 模式播报文案模板，支持变量：
   *   {{title}}    任务名（会话标题，取不到时为空）
   *   {{duration}} 用时（如「3 分 25 秒」，开始事件无意义）
   *   {{error}}    错误原因（仅失败事件）
   *   {{text}}     提问内容（仅对话提问事件）
   *   {{tool}}     待确认的操作名（仅对话确认事件）
   * 空模板回退 ttsText，再回退默认文案。
   */
  template: string
}

/** 免打扰时段：每天在 [start, end) 内静音。start > end 表示跨午夜。 */
export interface QuietHours {
  enabled: boolean
  /** 24h 'HH:MM'，如 '23:00'。 */
  start: string
  /** 24h 'HH:MM'，如 '08:00'。 */
  end: string
}

/** TTS 朗读的音色与语调（全局，三类事件共用）。 */
export interface TtsSettings {
  /** 语音名称（speechSynthesis.getVoices() 的 voice.name）；空 = 系统默认。 */
  voiceName: string
  /** 语速 0.5~2.0。 */
  rate: number
  /** 音调 0.5~2.0。 */
  pitch: number
}

export interface AnnouncerPrefs {
  /** 总开关。 */
  enabled: boolean
  /** 音量 0~1。 */
  volume: number
  /** 连续触发去抖毫秒数：同一事件在窗口期内只播一次。 */
  debounceMs: number
  /** 免打扰时段：期间所有事件静音。 */
  quietHours: QuietHours
  /** TTS 音色与语调。 */
  tts: TtsSettings
  /** 任务开始播报。 */
  start: EventSoundConfig
  /** 任务完成播报。 */
  complete: EventSoundConfig
  /** 任务失败播报。 */
  error: EventSoundConfig
  /** 对话提醒：AI 停下来向你提问（ask_user_question）时。 */
  question: EventSoundConfig
  /** 对话提醒：AI 要执行敏感操作、等你授权（审批请求）时。 */
  approval: EventSoundConfig
}

export const DEFAULT_PREFS: AnnouncerPrefs = {
  enabled: true,
  volume: 0.7,
  debounceMs: 1500,
  quietHours: { enabled: false, start: '23:00', end: '08:00' },
  tts: { voiceName: '', rate: 1, pitch: 1 },
  start: { mode: 'beep', beepPreset: 'classic', packId: 'soft-female', customUrl: '', ttsText: '任务开始', template: '任务「{{title}}」开始' },
  complete: { mode: 'pack', beepPreset: 'classic', packId: 'soft-female', customUrl: '', ttsText: '任务已完成', template: '任务「{{title}}」已完成，用时 {{duration}}' },
  error: { mode: 'pack', beepPreset: 'classic', packId: 'soft-female', customUrl: '', ttsText: '任务失败，请检查', template: '任务「{{title}}」失败，原因：{{error}}' },
  question: { mode: 'tts', beepPreset: 'chime', packId: 'soft-female', customUrl: '', ttsText: '有问题等你回答', template: '「{{title}}」有问题等你回答：{{text}}' },
  approval: { mode: 'tts', beepPreset: 'bell', packId: 'soft-female', customUrl: '', ttsText: '有操作等你确认', template: '「{{title}}」有操作等你确认：{{tool}}' },
}

export const PREFS_KEY = 'dsh-voice-announcer.prefs'

function isSoundMode(value: unknown): value is SoundMode {
  return value === 'off' || value === 'beep' || value === 'pack' || value === 'tts' || value === 'custom'
}

function isBeepPreset(value: unknown): value is BeepPreset {
  return typeof value === 'string' && (BEEP_PRESETS as readonly string[]).includes(value)
}

function isVoicePackId(value: unknown): value is VoicePackId {
  return typeof value === 'string' && (VOICE_PACK_IDS as readonly string[]).includes(value)
}

function mergeEventConfig(
  raw: unknown,
  fallback: EventSoundConfig,
): EventSoundConfig {
  const input = (raw ?? {}) as Partial<EventSoundConfig>
  return {
    mode: isSoundMode(input.mode) ? input.mode : fallback.mode,
    beepPreset: isBeepPreset(input.beepPreset) ? input.beepPreset : fallback.beepPreset,
    packId: isVoicePackId(input.packId) ? input.packId : fallback.packId,
    customUrl: typeof input.customUrl === 'string' ? input.customUrl : fallback.customUrl,
    ttsText: typeof input.ttsText === 'string' ? input.ttsText : fallback.ttsText,
    template: typeof input.template === 'string' ? input.template : fallback.template,
  }
}

function mergeQuietHours(raw: unknown): QuietHours {
  const input = (raw ?? {}) as Partial<QuietHours>
  const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : false,
    start: isTime(input.start) ? input.start : '23:00',
    end: isTime(input.end) ? input.end : '08:00',
  }
}

function mergeTts(raw: unknown): TtsSettings {
  const input = (raw ?? {}) as Partial<TtsSettings>
  const clamp = (v: unknown, fallback: number): number =>
    typeof v === 'number' && v >= 0.5 && v <= 2 ? v : fallback
  return {
    voiceName: typeof input.voiceName === 'string' ? input.voiceName : '',
    rate: clamp(input.rate, 1),
    pitch: clamp(input.pitch, 1),
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
    quietHours: mergeQuietHours(input.quietHours),
    tts: mergeTts(input.tts),
    start: mergeEventConfig(input.start, DEFAULT_PREFS.start),
    complete: mergeEventConfig(input.complete, DEFAULT_PREFS.complete),
    error: mergeEventConfig(input.error, DEFAULT_PREFS.error),
    question: mergeEventConfig(input.question, DEFAULT_PREFS.question),
    approval: mergeEventConfig(input.approval, DEFAULT_PREFS.approval),
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
