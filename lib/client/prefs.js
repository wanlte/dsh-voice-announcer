/**
 * dsh-voice-announcer — client prefs (localStorage).
 *
 * 偏好全部存在浏览器 localStorage 里，零后端。loadPrefs 必须返回稳定引用
 * （React 的 useSyncExternalStore 用 Object.is 比较快照）。
 */
import { VOICE_PACK_IDS } from "./voicepacks.js";
export const BEEP_PRESETS = ['classic', 'chime', 'marimba', 'bell', 'pulse', 'coin'];
export const DEFAULT_PREFS = {
    enabled: true,
    volume: 0.7,
    debounceMs: 1500,
    quietHours: { enabled: false, start: '23:00', end: '08:00' },
    tts: { voiceName: '', rate: 1, pitch: 1 },
    start: { mode: 'beep', beepPreset: 'classic', packId: 'soft-female', customAudioId: '', customAudioName: '', customUrl: '', ttsText: '任务开始', template: '任务「{{title}}」开始' },
    complete: { mode: 'pack', beepPreset: 'classic', packId: 'soft-female', customAudioId: '', customAudioName: '', customUrl: '', ttsText: '任务已完成', template: '任务「{{title}}」已完成，用时 {{duration}}' },
    error: { mode: 'pack', beepPreset: 'classic', packId: 'soft-female', customAudioId: '', customAudioName: '', customUrl: '', ttsText: '任务失败，请检查', template: '任务「{{title}}」失败，原因：{{error}}' },
    question: { mode: 'tts', beepPreset: 'chime', packId: 'soft-female', customAudioId: '', customAudioName: '', customUrl: '', ttsText: '有问题等你回答', template: '「{{title}}」有问题等你回答：{{text}}' },
    approval: { mode: 'tts', beepPreset: 'bell', packId: 'soft-female', customAudioId: '', customAudioName: '', customUrl: '', ttsText: '有操作等你确认', template: '「{{title}}」有操作等你确认：{{tool}}' },
};
export const PREFS_KEY = 'dsh-voice-announcer.prefs';
function isSoundMode(value) {
    return value === 'off' || value === 'beep' || value === 'pack' || value === 'tts' || value === 'custom';
}
function isBeepPreset(value) {
    return typeof value === 'string' && BEEP_PRESETS.includes(value);
}
function isVoicePackId(value) {
    return typeof value === 'string' && VOICE_PACK_IDS.includes(value);
}
function mergeEventConfig(raw, fallback) {
    const input = (raw ?? {});
    return {
        mode: isSoundMode(input.mode) ? input.mode : fallback.mode,
        beepPreset: isBeepPreset(input.beepPreset) ? input.beepPreset : fallback.beepPreset,
        packId: isVoicePackId(input.packId) ? input.packId : fallback.packId,
        customAudioId: typeof input.customAudioId === 'string' ? input.customAudioId : fallback.customAudioId,
        customAudioName: typeof input.customAudioName === 'string' ? input.customAudioName : fallback.customAudioName,
        customUrl: typeof input.customUrl === 'string' ? input.customUrl : fallback.customUrl,
        ttsText: typeof input.ttsText === 'string' ? input.ttsText : fallback.ttsText,
        template: typeof input.template === 'string' ? input.template : fallback.template,
    };
}
function mergeQuietHours(raw) {
    const input = (raw ?? {});
    const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    return {
        enabled: typeof input.enabled === 'boolean' ? input.enabled : false,
        start: isTime(input.start) ? input.start : '23:00',
        end: isTime(input.end) ? input.end : '08:00',
    };
}
function mergeTts(raw) {
    const input = (raw ?? {});
    const clamp = (v, fallback) => typeof v === 'number' && v >= 0.5 && v <= 2 ? v : fallback;
    return {
        voiceName: typeof input.voiceName === 'string' ? input.voiceName : '',
        rate: clamp(input.rate, 1),
        pitch: clamp(input.pitch, 1),
    };
}
function mergePrefs(raw) {
    const input = (raw ?? {});
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
    };
}
function storage() {
    try {
        return typeof window !== 'undefined' ? window.localStorage : undefined;
    }
    catch {
        return undefined;
    }
}
let current = (() => {
    const store = storage();
    if (store !== undefined) {
        try {
            const raw = store.getItem(PREFS_KEY);
            if (raw !== null)
                return mergePrefs(JSON.parse(raw));
        }
        catch {
            // 损坏的 JSON 直接回退默认值
        }
    }
    return { ...DEFAULT_PREFS };
})();
export function loadPrefs() {
    return current;
}
export function updatePrefs(patch) {
    const next = mergePrefs({ ...current, ...patch });
    current = next;
    const store = storage();
    if (store !== undefined) {
        try {
            store.setItem(PREFS_KEY, JSON.stringify(next));
        }
        catch {
            // 隐私模式 / 存储满：仅保留内存态
        }
    }
    notifyPrefsChanged();
    return next;
}
const listeners = new Set();
export function subscribePrefs(callback) {
    listeners.add(callback);
    return () => { listeners.delete(callback); };
}
export function notifyPrefsChanged() {
    for (const listener of [...listeners])
        listener();
}
