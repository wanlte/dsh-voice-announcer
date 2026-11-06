/**
 * dsh-voice-announcer — client prefs (localStorage).
 *
 * 偏好全部存在浏览器 localStorage 里，零后端。loadPrefs 必须返回稳定引用
 * （React 的 useSyncExternalStore 用 Object.is 比较快照）。
 */
import { type VoicePackId } from './voicepacks.ts';
/** 每类事件的播报方式。 */
export type SoundMode = 'off' | 'beep' | 'pack' | 'tts' | 'custom';
/** 合成音效的风格预设（Web Audio 实时合成，零文件）。 */
export type BeepPreset = 'classic' | 'chime' | 'marimba' | 'bell' | 'pulse' | 'coin';
export declare const BEEP_PRESETS: readonly BeepPreset[];
export interface EventSoundConfig {
    /** 播报方式：off=关闭 / beep=合成音效 / pack=内置人声语音包 / tts=浏览器朗读 / custom=自定义音频 URL。 */
    mode: SoundMode;
    /** beep 模式：音效风格预设。 */
    beepPreset: BeepPreset;
    /** pack 模式：内置语音包 id。 */
    packId: VoicePackId;
    /** custom 模式：音频文件 URL（http(s) 或 data: 均可）。 */
    customUrl: string;
    /** tts 模式：朗读的文本（空则用默认文案；旧版本字段，v0.2 起推荐用 template）。 */
    ttsText: string;
    /**
     * tts 模式播报文案模板，支持变量：
     *   {{title}}    任务名（会话标题，取不到时为空）
     *   {{duration}} 用时（如「3 分 25 秒」，开始事件无意义）
     *   {{error}}    错误原因（仅失败事件）
     *   {{text}}     提问内容（仅对话提问事件）
     *   {{tool}}     待确认的操作名（仅对话确认事件）
     * 空模板回退 ttsText，再回退默认文案。
     */
    template: string;
}
/** 免打扰时段：每天在 [start, end) 内静音。start > end 表示跨午夜。 */
export interface QuietHours {
    enabled: boolean;
    /** 24h 'HH:MM'，如 '23:00'。 */
    start: string;
    /** 24h 'HH:MM'，如 '08:00'。 */
    end: string;
}
/** TTS 朗读的音色与语调（全局，三类事件共用）。 */
export interface TtsSettings {
    /** 语音名称（speechSynthesis.getVoices() 的 voice.name）；空 = 系统默认。 */
    voiceName: string;
    /** 语速 0.5~2.0。 */
    rate: number;
    /** 音调 0.5~2.0。 */
    pitch: number;
}
export interface AnnouncerPrefs {
    /** 总开关。 */
    enabled: boolean;
    /** 音量 0~1。 */
    volume: number;
    /** 连续触发去抖毫秒数：同一事件在窗口期内只播一次。 */
    debounceMs: number;
    /** 免打扰时段：期间所有事件静音。 */
    quietHours: QuietHours;
    /** TTS 音色与语调。 */
    tts: TtsSettings;
    /** 任务开始播报。 */
    start: EventSoundConfig;
    /** 任务完成播报。 */
    complete: EventSoundConfig;
    /** 任务失败播报。 */
    error: EventSoundConfig;
    /** 对话提醒：AI 停下来向你提问（ask_user_question）时。 */
    question: EventSoundConfig;
    /** 对话提醒：AI 要执行敏感操作、等你授权（审批请求）时。 */
    approval: EventSoundConfig;
}
export declare const DEFAULT_PREFS: AnnouncerPrefs;
export declare const PREFS_KEY = "dsh-voice-announcer.prefs";
export declare function loadPrefs(): AnnouncerPrefs;
export declare function updatePrefs(patch: Partial<AnnouncerPrefs>): AnnouncerPrefs;
export declare function subscribePrefs(callback: () => void): () => void;
export declare function notifyPrefsChanged(): void;
