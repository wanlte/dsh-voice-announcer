/**
 * dsh-voice-announcer — client prefs (localStorage).
 *
 * 偏好全部存在浏览器 localStorage 里，零后端。loadPrefs 必须返回稳定引用
 * （React 的 useSyncExternalStore 用 Object.is 比较快照）。
 */
/** 每类事件的播报方式。 */
export type SoundMode = 'off' | 'beep' | 'tts' | 'custom';
export interface EventSoundConfig {
    /** 播报方式：off=关闭 / beep=合成音效 / tts=浏览器朗读 / custom=自定义音频 URL。 */
    mode: SoundMode;
    /** custom 模式：音频文件 URL（http(s) 或 data: 均可）。 */
    customUrl: string;
    /** tts 模式：朗读的文本（空则用默认文案）。 */
    ttsText: string;
}
export interface AnnouncerPrefs {
    /** 总开关。 */
    enabled: boolean;
    /** 音量 0~1。 */
    volume: number;
    /** 连续触发去抖毫秒数：同一事件在窗口期内只播一次。 */
    debounceMs: number;
    /** 任务开始播报。 */
    start: EventSoundConfig;
    /** 任务完成播报。 */
    complete: EventSoundConfig;
    /** 任务失败播报。 */
    error: EventSoundConfig;
}
export declare const DEFAULT_PREFS: AnnouncerPrefs;
export declare const PREFS_KEY = "dsh-voice-announcer.prefs";
export declare function loadPrefs(): AnnouncerPrefs;
export declare function updatePrefs(patch: Partial<AnnouncerPrefs>): AnnouncerPrefs;
export declare function subscribePrefs(callback: () => void): () => void;
export declare function notifyPrefsChanged(): void;
