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
/** 播放失败时静默降级，绝不让声音问题影响 DSH 本体。 */
function logPlayError(kind, error) {
    try {
        console.warn(`[dsh-voice-announcer] ${kind} play failed:`, error);
    }
    catch {
        // no-op
    }
}
/* ------------------------------------------------------------------ *
 * 1. Web Audio 合成提示音
 * ------------------------------------------------------------------ */
let audioContext;
/** 惰性创建全局 AudioContext；返回 undefined 表示浏览器不支持。 */
function getAudioContext() {
    if (typeof window === 'undefined')
        return undefined;
    const Ctor = window.AudioContext
        ?? window.webkitAudioContext;
    if (Ctor === undefined)
        return undefined;
    if (audioContext === undefined) {
        try {
            audioContext = new Ctor();
        }
        catch (error) {
            logPlayError('AudioContext', error);
            return undefined;
        }
    }
    // 浏览器自动播放策略下 context 可能是 suspended；尝试恢复（需要用户手势，失败不影响）。
    if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => { });
    }
    return audioContext;
}
/** 安装一次性手势解锁：用户第一次与页面交互时恢复 AudioContext。 */
export function installAudioUnlock() {
    const unlock = () => {
        const ctx = getAudioContext();
        if (ctx !== undefined && ctx.state === 'suspended') {
            void ctx.resume().catch(() => { });
        }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
}
/** 在 ctx 上播放一个短促正弦音。 */
function tone(ctx, dest, freq, startAt, duration, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // 快起快落，避免"哔"声刺耳
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
}
function playBeep(kind, volume) {
    const ctx = getAudioContext();
    if (ctx === undefined)
        return;
    const now = ctx.currentTime;
    const dest = ctx.destination;
    switch (kind) {
        case 'start':
            tone(ctx, dest, 660, now, 0.12, volume);
            tone(ctx, dest, 880, now + 0.13, 0.18, volume);
            break;
        case 'complete':
            tone(ctx, dest, 523.25, now, 0.1, volume); // C5
            tone(ctx, dest, 659.25, now + 0.11, 0.1, volume); // E5
            tone(ctx, dest, 783.99, now + 0.22, 0.22, volume); // G5
            break;
        case 'error':
            tone(ctx, dest, 330, now, 0.16, volume); // E4
            tone(ctx, dest, 220, now + 0.17, 0.32, volume); // A3 更低更沉
            break;
    }
}
/* ------------------------------------------------------------------ *
 * 2. 浏览器 TTS 朗读
 * ------------------------------------------------------------------ */
function speak(text, volume) {
    if (typeof speechSynthesis === 'undefined') {
        logPlayError('tts', new Error('speechSynthesis is not supported'));
        return;
    }
    // 打断上一句，保证连续触发时只播最新的
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = Math.min(1, Math.max(0, volume));
    utterance.rate = 1;
    utterance.pitch = 1;
    // 用系统默认语音；中文环境下一般会自动匹配中文声
    speechSynthesis.speak(utterance);
}
/* ------------------------------------------------------------------ *
 * 3. 自定义语音包（音频 URL）
 * ------------------------------------------------------------------ */
function playCustom(url, volume) {
    if (url === '') {
        logPlayError('custom', new Error('empty URL'));
        return;
    }
    const audio = new Audio(url);
    audio.volume = Math.min(1, Math.max(0, volume));
    void audio.play().catch((error) => {
        logPlayError('custom', error);
    });
}
/* ------------------------------------------------------------------ *
 * 统一入口
 * ------------------------------------------------------------------ */
/**
 * 按配置播报一次。custom 模式下 URL 为空时回退到 beep。
 */
export function playEventSound(kind, config, volume) {
    switch (config.mode) {
        case 'off':
            return;
        case 'tts':
            speak(config.ttsText !== '' ? config.ttsText : defaultTtsText(kind), volume);
            return;
        case 'custom':
            if (config.customUrl !== '') {
                playCustom(config.customUrl, volume);
                return;
            }
            playBeep(kind, volume);
            return;
        case 'beep':
            playBeep(kind, volume);
            return;
    }
}
export function playEventSoundByMode(kind, mode, volume) {
    switch (mode) {
        case 'off':
            return;
        case 'tts':
            speak(defaultTtsText(kind), volume);
            return;
        case 'custom':
            playBeep(kind, volume); // 设置卡片"试听"没有 URL 上下文，custom 回退为音效
            return;
        case 'beep':
            playBeep(kind, volume);
            return;
    }
}
export function defaultTtsText(kind) {
    switch (kind) {
        case 'start': return '任务开始';
        case 'complete': return '任务已完成';
        case 'error': return '任务失败，请检查';
    }
}
/** 卸载插件时清理：关掉声音、释放手势监听由调用方负责。 */
export function disposePlayer() {
    if (typeof speechSynthesis !== 'undefined') {
        try {
            speechSynthesis.cancel();
        }
        catch {
            // no-op
        }
    }
    if (audioContext !== undefined) {
        void audioContext.close().catch(() => { });
        audioContext = undefined;
    }
}
