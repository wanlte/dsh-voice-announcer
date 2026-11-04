/**
 * dsh-voice-announcer — client half.
 *
 * 在浏览器端订阅 dsh 会话状态事件（api-session/status、api-session/error），
 * 按偏好配置播报声音；并在「设置 → 插件」里注册一个独立标签页用于配置。
 * 声音全部本地播放：Web Audio 合成音效 / speechSynthesis 朗读 / 自定义音频 URL。
 */
import type { Context } from './context-types.ts'
import { Announcer } from './announcer.ts'
import { disposePlayer, installAudioUnlock, playEventSoundByMode, type BeepKind } from './player.ts'
import { loadPrefs } from './prefs.ts'
import { SettingsCard } from './SettingsCard.tsx'
import { en, zh } from './locales.ts'

export const name = 'dsh-voice-announcer-client'

export const inject = ['remote', 'slots', 'locale']

export const LOCALE_NS = 'voice.announcer'

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-voice-announcer: dictionaries')
  const t = ctx.locale.bind(LOCALE_NS)

  // 事件监听：把 dsh 会话状态翻译成播报动作
  // 事件签名来自官方 @deepseek-ai/dsh-api-session-controller：api-session/status(sessionId, running)、api-session/error(sessionId, message)
  ctx.effect(() => {
    const announcer = new Announcer(loadPrefs)
    const offStatus = ctx.remote.$on('api-session/status', (sessionId: string, running: boolean) => {
      announcer.handleStatus(sessionId, running)
    })
    const offError = ctx.remote.$on('api-session/error', (sessionId: string) => {
      announcer.handleError(sessionId)
    })
    // 浏览器自动播放策略：首次用户交互时解锁 AudioContext
    const unlock = installAudioUnlock()
    return () => {
      offStatus()
      offError()
      unlock()
      announcer.dispose()
    }
  }, 'dsh-voice-announcer: event listeners')

  // 设置标签：设置 → 插件 → 语音播报
  ctx.effect(() => {
    return ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
      name: 'settings.plugins.tab',
      id: 'voice-announcer',
      order: 20,
      label: () => t('settingsTitle'),
      locale: LOCALE_NS,
      inject: () => ({}),
    }, SettingsCard))
  }, 'dsh-voice-announcer: settings tab')

  // 卸载时清理声音资源
  ctx.effect(() => {
    return () => { disposePlayer() }
  }, 'dsh-voice-announcer: player dispose')
}

/** 供 SettingsCard 试听按钮使用：按当前选择的方式直接播一次。 */
export function previewSound(kind: BeepKind, mode: Parameters<typeof playEventSoundByMode>[1]): void {
  playEventSoundByMode(kind, mode, loadPrefs().volume)
}
