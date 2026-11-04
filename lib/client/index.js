import { Announcer } from "./announcer.js";
import { disposePlayer, installAudioUnlock, playEventSoundByMode } from "./player.js";
import { loadPrefs } from "./prefs.js";
import { SettingsCard } from "./SettingsCard.js";
import { en, zh } from "./locales.js";
export const name = 'dsh-voice-announcer-client';
export const inject = ['remote', 'slots', 'locale'];
export const LOCALE_NS = 'voice.announcer';
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-voice-announcer: dictionaries');
    const t = ctx.locale.bind(LOCALE_NS);
    // 事件监听：把 dsh 会话状态翻译成播报动作
    // 事件签名来自官方 @deepseek-ai/dsh-api-session-controller：api-session/status(sessionId, running)、api-session/error(sessionId, message)
    ctx.effect(() => {
        const announcer = new Announcer(loadPrefs);
        const offStatus = ctx.remote.$on('api-session/status', (sessionId, running) => {
            announcer.handleStatus(sessionId, running);
        });
        const offError = ctx.remote.$on('api-session/error', (sessionId) => {
            announcer.handleError(sessionId);
        });
        // 浏览器自动播放策略：首次用户交互时解锁 AudioContext
        const unlock = installAudioUnlock();
        return () => {
            offStatus();
            offError();
            unlock();
            announcer.dispose();
        };
    }, 'dsh-voice-announcer: event listeners');
    // 设置标签：设置 → 插件 → 语音播报
    ctx.effect(() => {
        return ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
            name: 'settings.plugins.tab',
            id: 'voice-announcer',
            order: 20,
            label: () => t('settingsTitle'),
            locale: LOCALE_NS,
            inject: () => ({}),
        }, SettingsCard));
    }, 'dsh-voice-announcer: settings tab');
    // 卸载时清理声音资源
    ctx.effect(() => {
        return () => { disposePlayer(); };
    }, 'dsh-voice-announcer: player dispose');
}
/** 供 SettingsCard 试听按钮使用：按当前选择的方式直接播一次。 */
export function previewSound(kind, mode) {
    playEventSoundByMode(kind, mode, loadPrefs().volume);
}
