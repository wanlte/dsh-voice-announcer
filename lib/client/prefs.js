/**
 * dsh-voice-announcer — client prefs (localStorage).
 *
 * 偏好全部存在浏览器 localStorage 里，零后端。loadPrefs 必须返回稳定引用
 * （React 的 useSyncExternalStore 用 Object.is 比较快照）。
 */
export const DEFAULT_PREFS = {
    enabled: true,
    volume: 0.7,
    debounceMs: 1500,
    start: { mode: 'beep', customUrl: '', ttsText: '任务开始' },
    complete: { mode: 'tts', customUrl: '', ttsText: '任务已完成' },
    error: { mode: 'tts', customUrl: '', ttsText: '任务失败，请检查' },
};
export const PREFS_KEY = 'dsh-voice-announcer.prefs';
function isSoundMode(value) {
    return value === 'off' || value === 'beep' || value === 'tts' || value === 'custom';
}
function mergeEventConfig(raw, fallback) {
    const input = (raw ?? {});
    return {
        mode: isSoundMode(input.mode) ? input.mode : fallback.mode,
        customUrl: typeof input.customUrl === 'string' ? input.customUrl : fallback.customUrl,
        ttsText: typeof input.ttsText === 'string' ? input.ttsText : fallback.ttsText,
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
        start: mergeEventConfig(input.start, DEFAULT_PREFS.start),
        complete: mergeEventConfig(input.complete, DEFAULT_PREFS.complete),
        error: mergeEventConfig(input.error, DEFAULT_PREFS.error),
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
