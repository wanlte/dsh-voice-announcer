/**
 * dsh-voice-announcer — client half.
 *
 * 在浏览器端订阅 dsh 事件，按偏好配置播报声音，并在「设置 → 插件」里注册
 * 一个独立标签页用于配置：
 *   - api-session/status、api-session/error：任务开始 / 完成 / 失败；
 *   - user-questions/request、approval/request：对话提醒（AI 等你回答 / 等你确认）。
 * 声音全部本地播放：Web Audio 合成音效 / 内置语音包 / 自定义音频 URL / speechSynthesis 朗读。
 */
import type { Context } from './context-types.ts'
import { Announcer } from './announcer.ts'
import { disposePlayer, installAudioUnlock, playEventSoundByMode, type BeepKind } from './player.ts'
import { loadPrefs } from './prefs.ts'
import { SettingsCard } from './SettingsCard.tsx'
import { en, zh } from './locales.ts'

export const name = 'dsh-voice-announcer-client'

export const inject = ['remote', 'slots', 'locale', 'sessions']

export const LOCALE_NS = 'voice.announcer'

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-voice-announcer: dictionaries')
  const t = ctx.locale.bind(LOCALE_NS)

  // 事件监听：把 dsh 会话状态翻译成播报动作
  // 事件签名来自官方 @deepseek-ai/dsh-api-session-controller：api-session/status(sessionId, running)、api-session/error(sessionId, message)
  ctx.effect(() => {
    // 任务名解析：优先用会话列表的 displayTitle（不打开会话，轻量）。
    // ctx.sessions 由宿主 bundle 的 session-controller 客户端安装；个别宿主缺失时静默降级。
    const resolveTitle = (sessionId: string): string | undefined => {
      try {
        const list = ctx.sessions?.list.getSnapshot()
        return list?.byId[sessionId]?.displayTitle
      } catch {
        return undefined
      }
    }
    const announcer = new Announcer(loadPrefs, resolveTitle)
    const offStatus = ctx.remote.$on('api-session/status', (sessionId: string, running: boolean) => {
      announcer.handleStatus(sessionId, running)
    })
    const offError = ctx.remote.$on('api-session/error', (sessionId: string, message: string) => {
      announcer.handleError(sessionId, message)
    })

    // 对话提醒：`user-questions/request`（AI 停下等你回答）与 `approval/request`（等你授权）。
    // 这两个事件在 dsh 里是 waterfall 模式：请求按监听顺序交给应答者，
    // 应答者要么返回答案（claim，官方 UI 就是这样，会一直等你点），要么调用 next() 让位。
    // 我们只是旁听播报，必须无条件调用 next() 把请求交回去，
    // 否则会吞掉提问/审批 → AI 卡死。
    //
    // 双路订阅：cordis 的 ctx.on(..., prepend=true) 抢在官方 UI 之前接到请求（主路），
    // remote.$on 是转发事件的正式订阅入口（备份路）。两路可能各触发一次，
    // 由 Announcer 的 debounceMs 去重吸收，只播一次。
    type RemoteOn = (event: string, handler: (...args: unknown[]) => unknown) => () => void
    type LocalOn = (event: string, handler: (...args: unknown[]) => unknown, prepend?: boolean) => () => void
    const onRemote = (ctx.remote as unknown as { $on: RemoteOn }).$on.bind(ctx.remote) as RemoteOn
    const onLocal = (ctx as unknown as { on: LocalOn }).on.bind(ctx) as LocalOn

    /** 旁听 handler：先播报（播报异常一律吞掉），再把请求原样交回链上下一个应答者。 */
    const passThrough = (
      announce: (request: unknown) => void,
    ): ((request: unknown, next: unknown) => unknown) => (request, next) => {
      try {
        announce(request)
      } catch {
        // 播报失败绝不影响提问/审批流程
      }
      const nextFn = next as (() => unknown) | undefined
      return typeof nextFn === 'function' ? nextFn() : undefined
    }

    const questionHandler = passThrough(request => {
      announcer.handleQuestion(sessionIdOf(request), questionTextOf(request))
    })
    const approvalHandler = passThrough(request => {
      announcer.handleApproval(sessionIdOf(request), approvalTextOf(request))
    })

    const offQuestion = onLocal('user-questions/request', questionHandler, true)
    const offQuestionRemote = onRemote('user-questions/request', questionHandler)
    const offApproval = onLocal('approval/request', approvalHandler, true)
    const offApprovalRemote = onRemote('approval/request', approvalHandler)
    // 浏览器自动播放策略：首次用户交互时解锁 AudioContext
    const unlock = installAudioUnlock()
    return () => {
      offStatus()
      offError()
      offQuestion()
      offQuestionRemote()
      offApproval()
      offApprovalRemote()
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

/* ------------------------------------------------------------------ *
 * 对话提醒事件的载荷解析
 *
 * user-questions/request 与 approval/request 的 payload 由 dsh 宿主定义，
 * 不同 rc 版本字段位置有过调整。这里按「常见字段逐个尝试」的防御式读取，
 * 拿不到就把内容留空 —— 文案模板会自动剔除空变量，只播通用提醒。
 * ------------------------------------------------------------------ */

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
}

/** 取第一个非空字符串，压平空白并截断（播报不该读一屏字）。 */
function pickText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/\s+/g, ' ').trim()
  if (text === '') return undefined
  return text.length > 60 ? `${text.slice(0, 60)}…` : text
}

/** 从请求里找会话 id：顶层 sessionId，或 agent.session.id。 */
function sessionIdOf(request: unknown): string | undefined {
  const record = readRecord(request)
  if (record === undefined) return undefined
  if (typeof record.sessionId === 'string') return record.sessionId
  const agent = readRecord(record.agent)
  const session = readRecord(agent?.session)
  return typeof session?.id === 'string' ? session.id : undefined
}

/** 提问内容：取第一条问题的题干（question / prompt / header / title 都试一遍）。 */
function questionTextOf(request: unknown): string | undefined {
  const record = readRecord(request)
  if (record === undefined) return undefined
  const list = Array.isArray(record.questions) ? record.questions : []
  for (const item of list) {
    const question = readRecord(item)
    if (question === undefined) continue
    const text = pickText(question.question)
      ?? pickText(question.prompt)
      ?? pickText(question.header)
      ?? pickText(question.title)
    if (text !== undefined) return text
  }
  return pickText(record.question) ?? pickText(record.prompt)
}

/** 待确认的操作：工具名优先，其次标题/原因。 */
function approvalTextOf(request: unknown): string | undefined {
  const record = readRecord(request)
  if (record === undefined) return undefined
  return pickText(record.toolName)
    ?? pickText(record.tool)
    ?? pickText(record.title)
    ?? pickText(record.reason)
    ?? pickText(record.message)
}
