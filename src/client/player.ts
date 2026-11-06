/**
 * dsh-voice-announcer — audio player.
 *
 * 三种播报通道，全部在浏览器本地完成：
 *   - beep   : Web Audio API 实时合成提示音（零文件、零请求）
 *   - tts    : 浏览器内置 speechSynthesis 朗读文本（零 API Key）
 *   - custom : HTMLAudioElement 播放自定义语音包 URL
 *
 * 自动播放策略：浏览器要求 AudioContext 必须在用户手势后才能出声，
 * 因此 apply() 阶段会注册一次性解锁监听，任何点击/按键都会 resume。
 */

import type { BeepPreset, EventSoundConfig, SoundMode, TtsSettings } from './prefs.ts'
import { VOICE_PACKS, type ClipKind, type VoicePackId } from './voicepacks.ts'

/** 播放失败时静默降级，绝不让声音问题影响 DSH 本体。 */
function logPlayError(kind: string, error: unknown): void {
  try {
    console.warn(`[dsh-voice-announcer] ${kind} play failed:`, error)
  } catch {
    // no-op
  }
}

/* ------------------------------------------------------------------ *
 * 1. Web Audio 合成提示音
 * ------------------------------------------------------------------ */

let audioContext: AudioContext | undefined

/** 惰性创建全局 AudioContext；返回 undefined 表示浏览器不支持。 */
function getAudioContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (Ctor === undefined) return undefined
  if (audioContext === undefined) {
    try {
      audioContext = new Ctor()
    } catch (error) {
      logPlayError('AudioContext', error)
      return undefined
    }
  }
  // 浏览器自动播放策略下 context 可能是 suspended；尝试恢复（需要用户手势，失败不影响）。
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => {})
  }
  return audioContext
}

/** 安装一次性手势解锁：用户第一次与页面交互时恢复 AudioContext。 */
export function installAudioUnlock(): () => void {
  const unlock = (): void => {
    const ctx = getAudioContext()
    if (ctx !== undefined && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {})
    }
  }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock, { passive: true })
  return () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
}

/** 在 ctx 上播放一个短音。 */
function tone(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  startAt: number,
  duration: number,
  volume: number,
  wave: OscillatorType = 'sine',
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = wave
  osc.frequency.value = freq
  // 快起快落，避免"哔"声刺耳
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(dest)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

/** 五类事件的播报类别：任务开始/完成/失败，以及对话中的提问/确认。 */
export type BeepKind = 'start' | 'complete' | 'error' | 'question' | 'approval'

/** 一个音符：频率、相对起始时间、时值、波形。 */
interface Note {
  freq: number
  at: number
  dur: number
  wave?: OscillatorType
}

const NOTES: Record<BeepPreset, Record<BeepKind, Note[]>> = {
  // 经典：正弦波。开始=上行双音，完成=三音琶音，失败=低沉下行
  classic: {
    start: [{ freq: 660, at: 0, dur: 0.12 }, { freq: 880, at: 0.13, dur: 0.18 }],
    complete: [{ freq: 523.25, at: 0, dur: 0.1 }, { freq: 659.25, at: 0.11, dur: 0.1 }, { freq: 783.99, at: 0.22, dur: 0.22 }],
    error: [{ freq: 330, at: 0, dur: 0.16 }, { freq: 220, at: 0.17, dur: 0.32 }],
    // 提问：上扬双音，像「嗯？」的语气
    question: [{ freq: 880, at: 0, dur: 0.12 }, { freq: 1174.66, at: 0.13, dur: 0.2 }],
    // 确认：两短一长，催促你看一眼
    approval: [{ freq: 660, at: 0, dur: 0.1 }, { freq: 660, at: 0.16, dur: 0.1 }, { freq: 880, at: 0.32, dur: 0.2 }],
  },
  // 清脆叮咚：三角波高频，像门铃
  chime: {
    start: [{ freq: 1318.5, at: 0, dur: 0.18, wave: 'triangle' }, { freq: 1568, at: 0.16, dur: 0.28, wave: 'triangle' }],
    complete: [{ freq: 1046.5, at: 0, dur: 0.14, wave: 'triangle' }, { freq: 1318.5, at: 0.13, dur: 0.14, wave: 'triangle' }, { freq: 1568, at: 0.26, dur: 0.3, wave: 'triangle' }],
    error: [{ freq: 783.99, at: 0, dur: 0.2, wave: 'triangle' }, { freq: 523.25, at: 0.2, dur: 0.4, wave: 'triangle' }],
    question: [{ freq: 1318.5, at: 0, dur: 0.16, wave: 'triangle' }, { freq: 1760, at: 0.15, dur: 0.26, wave: 'triangle' }],
    approval: [{ freq: 1046.5, at: 0, dur: 0.14, wave: 'triangle' }, { freq: 1046.5, at: 0.18, dur: 0.14, wave: 'triangle' }, { freq: 1318.5, at: 0.36, dur: 0.2, wave: 'triangle' }],
  },
  // 木琴：中频正弦，柔和木质短音
  marimba: {
    start: [{ freq: 523.25, at: 0, dur: 0.14 }, { freq: 659.25, at: 0.14, dur: 0.2 }],
    complete: [{ freq: 523.25, at: 0, dur: 0.12 }, { freq: 659.25, at: 0.12, dur: 0.12 }, { freq: 783.99, at: 0.24, dur: 0.12 }, { freq: 1046.5, at: 0.36, dur: 0.25 }],
    error: [{ freq: 392, at: 0, dur: 0.18 }, { freq: 261.63, at: 0.18, dur: 0.35 }],
    question: [{ freq: 659.25, at: 0, dur: 0.14 }, { freq: 880, at: 0.14, dur: 0.24 }],
    approval: [{ freq: 523.25, at: 0, dur: 0.1 }, { freq: 523.25, at: 0.14, dur: 0.1 }, { freq: 659.25, at: 0.28, dur: 0.18 }],
  },
  // 铃声：基频 + 高八度同时叠加，余音长
  bell: {
    start: [{ freq: 880, at: 0, dur: 0.3 }, { freq: 1760, at: 0, dur: 0.18 }],
    complete: [{ freq: 1046.5, at: 0, dur: 0.3 }, { freq: 2093, at: 0, dur: 0.18 }, { freq: 1318.5, at: 0.2, dur: 0.35 }],
    error: [{ freq: 440, at: 0, dur: 0.35 }, { freq: 880, at: 0, dur: 0.2 }],
    question: [{ freq: 880, at: 0, dur: 0.28 }, { freq: 1760, at: 0, dur: 0.14 }, { freq: 1174.66, at: 0.18, dur: 0.3 }, { freq: 2349.32, at: 0.18, dur: 0.12 }],
    approval: [{ freq: 1046.5, at: 0, dur: 0.26 }, { freq: 2093, at: 0, dur: 0.12 }, { freq: 1046.5, at: 0.3, dur: 0.26 }, { freq: 2093, at: 0.3, dur: 0.12 }],
  },
  // 电子脉冲：方波短促，科技感
  pulse: {
    start: [{ freq: 440, at: 0, dur: 0.06, wave: 'square' }, { freq: 660, at: 0.09, dur: 0.06, wave: 'square' }],
    complete: [{ freq: 523.25, at: 0, dur: 0.05, wave: 'square' }, { freq: 659.25, at: 0.08, dur: 0.05, wave: 'square' }, { freq: 880, at: 0.16, dur: 0.1, wave: 'square' }],
    error: [{ freq: 330, at: 0, dur: 0.08, wave: 'square' }, { freq: 220, at: 0.1, dur: 0.12, wave: 'square' }],
    question: [{ freq: 660, at: 0, dur: 0.05, wave: 'square' }, { freq: 990, at: 0.08, dur: 0.05, wave: 'square' }, { freq: 1320, at: 0.16, dur: 0.08, wave: 'square' }],
    approval: [{ freq: 440, at: 0, dur: 0.05, wave: 'square' }, { freq: 440, at: 0.1, dur: 0.05, wave: 'square' }, { freq: 660, at: 0.2, dur: 0.05, wave: 'square' }, { freq: 660, at: 0.3, dur: 0.08, wave: 'square' }],
  },
  // 金币：经典 8-bit 拾取音，明亮跳跃
  coin: {
    start: [{ freq: 988, at: 0, dur: 0.08, wave: 'square' }, { freq: 1319, at: 0.08, dur: 0.14, wave: 'square' }],
    complete: [{ freq: 988, at: 0, dur: 0.08, wave: 'square' }, { freq: 1319, at: 0.08, dur: 0.1, wave: 'square' }, { freq: 1568, at: 0.2, dur: 0.16, wave: 'square' }],
    error: [{ freq: 440, at: 0, dur: 0.1, wave: 'square' }, { freq: 294, at: 0.1, dur: 0.18, wave: 'square' }],
    question: [{ freq: 880, at: 0, dur: 0.06, wave: 'square' }, { freq: 1175, at: 0.07, dur: 0.1, wave: 'square' }, { freq: 1568, at: 0.18, dur: 0.14, wave: 'square' }],
    approval: [{ freq: 988, at: 0, dur: 0.06, wave: 'square' }, { freq: 988, at: 0.09, dur: 0.06, wave: 'square' }, { freq: 1319, at: 0.18, dur: 0.12, wave: 'square' }],
  },
}

function playBeep(kind: BeepKind, volume: number, preset: BeepPreset = 'classic'): void {
  const ctx = getAudioContext()
  if (ctx === undefined) return
  const now = ctx.currentTime
  const dest = ctx.destination
  const notes = NOTES[preset]?.[kind] ?? NOTES.classic[kind]
  for (const note of notes) {
    tone(ctx, dest, note.freq, now + note.at, note.dur, volume, note.wave)
  }
}

/* ------------------------------------------------------------------ *
 * 2. 浏览器 TTS 朗读
 * ------------------------------------------------------------------ */

function speak(text: string, volume: number, tts?: TtsSettings): void {
  if (typeof speechSynthesis === 'undefined') {
    logPlayError('tts', new Error('speechSynthesis is not supported'))
    return
  }
  // 打断上一句，保证连续触发时只播最新的
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.volume = Math.min(1, Math.max(0, volume))
  utterance.rate = tts !== undefined ? tts.rate : 1
  utterance.pitch = tts !== undefined ? tts.pitch : 1
  // 指定音色：按名称精确匹配（voices 可能有重复名，取第一个匹配）
  if (tts !== undefined && tts.voiceName !== '') {
    const voice = speechSynthesis.getVoices().find(candidate => candidate.name === tts.voiceName)
    if (voice !== undefined) utterance.voice = voice
  }
  speechSynthesis.speak(utterance)
}

/* ------------------------------------------------------------------ *
 * 3. 内置语音包（base64 MP3，离线人声）
 * ------------------------------------------------------------------ */

/** 正在播放的内置语音包音频；重复触发时先停掉上一段。 */
let packAudio: HTMLAudioElement | undefined

function playPack(kind: BeepKind, packId: VoicePackId, volume: number): void {
  // 内置语音包只录了 开始 / 完成 / 失败 三段人声；
  // 「提问」「确认」没有对应片段，借用「完成」那段当提示音，避免静默无声。
  const clipKind: ClipKind = kind === 'question' || kind === 'approval' ? 'complete' : kind
  const clip = VOICE_PACKS[packId]?.clips[clipKind] ?? VOICE_PACKS['soft-female'].clips[clipKind]
  try {
    if (packAudio !== undefined) {
      packAudio.pause()
    }
    const audio = new Audio(clip)
    audio.volume = Math.min(1, Math.max(0, volume))
    packAudio = audio
    void audio.play().catch((error) => {
      logPlayError('pack', error)
    })
  } catch (error) {
    logPlayError('pack', error)
  }
}

/* ------------------------------------------------------------------ *
 * 4. 自定义语音包（音频 URL）
 * ------------------------------------------------------------------ */

function playCustom(url: string, volume: number): void {
  if (url === '') {
    logPlayError('custom', new Error('empty URL'))
    return
  }
  const audio = new Audio(url)
  audio.volume = Math.min(1, Math.max(0, volume))
  void audio.play().catch((error) => {
    logPlayError('custom', error)
  })
}

/* ------------------------------------------------------------------ *
 * 统一入口
 * ------------------------------------------------------------------ */

/**
 * 按配置播报一次。custom 模式下 URL 为空时回退到 beep。
 * @param textOverride tts 模式的朗读文本（如已渲染好的播报文案）；为空则用 config.ttsText，再空用默认文案。
 * @param tts tts 模式的音色/语速/音调；省略则用系统默认。
 */
export function playEventSound(
  kind: BeepKind,
  config: EventSoundConfig,
  volume: number,
  textOverride?: string,
  tts?: TtsSettings,
): void {
  switch (config.mode) {
    case 'off':
      return
    case 'tts':
      speak(textOverride ?? (config.ttsText !== '' ? config.ttsText : defaultTtsText(kind)), volume, tts)
      return
    case 'pack':
      playPack(kind, config.packId, volume)
      return
    case 'custom':
      if (config.customUrl !== '') {
        playCustom(config.customUrl, volume)
        return
      }
      playBeep(kind, volume, config.beepPreset)
      return
    case 'beep':
      playBeep(kind, volume, config.beepPreset)
      return
  }
}

/** 设置卡片"试听":按指定模式/风格播放，不读取 localStorage 之外的上下文。 */
export function playEventSoundByMode(
  kind: BeepKind,
  mode: SoundMode,
  volume: number,
  preset: BeepPreset = 'classic',
  tts?: TtsSettings,
  packId: VoicePackId = 'soft-female',
): void {
  switch (mode) {
    case 'off':
      return
    case 'tts':
      speak(defaultTtsText(kind), volume, tts)
      return
    case 'pack':
      playPack(kind, packId, volume)
      return
    case 'custom':
      playBeep(kind, volume, preset) // 设置卡片"试听"没有 URL 上下文，custom 回退为音效
      return
    case 'beep':
      playBeep(kind, volume, preset)
      return
  }
}

export function defaultTtsText(kind: BeepKind): string {
  switch (kind) {
    case 'start': return '任务开始'
    case 'complete': return '任务已完成'
    case 'error': return '任务失败，请检查'
    case 'question': return '对话中有问题等你回答'
    case 'approval': return '对话中有操作等你确认'
  }
}

/** 卸载插件时清理：关掉声音、释放手势监听由调用方负责。 */
export function disposePlayer(): void {
  if (typeof speechSynthesis !== 'undefined') {
    try {
      speechSynthesis.cancel()
    } catch {
      // no-op
    }
  }
  if (audioContext !== undefined) {
    void audioContext.close().catch(() => {})
    audioContext = undefined
  }
}
