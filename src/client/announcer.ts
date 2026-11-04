/**
 * dsh-voice-announcer — event state machine.
 *
 * 把 dsh 的会话状态事件翻译成"该播什么"：
 *   - api-session/status(sessionId, running)
 *       false -> true  任务开始  -> start
 *       true  -> false 任务结束  -> complete（若 5 秒内刚报过错则跳过，避免 error 后二次播报）
 *   - api-session/error(sessionId, message)
 *       任务失败          -> error
 *
 * 同一事件在 debounceMs 窗口内只播一次（比如多个子任务同时结束）。
 * 所有状态只存在内存里，卸载即清空。
 */

import type { AnnouncerPrefs } from './prefs.ts'
import { playEventSound, type BeepKind } from './player.ts'

/** error 播报后多久内的 status(false) 视为"同一件事"，不再重复播 complete。 */
const ERROR_COOLDOWN_MS = 5000

interface EventState {
  running: boolean | undefined
  lastErrorAt: number | undefined
  lastPlayedAt: Record<BeepKind, number>
}

export class Announcer {
  private readonly sessions = new Map<string, EventState>()

  constructor(
    private readonly getPrefs: () => AnnouncerPrefs,
  ) {}

  /** 会话状态变化（来自 api-session/status）。 */
  handleStatus(sessionId: string, running: boolean): void {
    const prefs = this.getPrefs()
    if (!prefs.enabled) return
    const state = this.stateOf(sessionId)
    const previous = state.running
    state.running = running
    if (running && previous !== true) {
      // false -> true：任务开始
      this.play(prefs, 'start', sessionId)
    } else if (!running && previous === true) {
      // true -> false：任务结束；若刚报过错则跳过
      const errored = state.lastErrorAt !== undefined
        && Date.now() - state.lastErrorAt < ERROR_COOLDOWN_MS
      if (!errored) this.play(prefs, 'complete', sessionId)
    }
  }

  /** 任务失败（来自 api-session/error）。 */
  handleError(sessionId: string): void {
    const prefs = this.getPrefs()
    if (!prefs.enabled) return
    const state = this.stateOf(sessionId)
    state.lastErrorAt = Date.now()
    this.play(prefs, 'error', sessionId)
  }

  private stateOf(sessionId: string): EventState {
    let state = this.sessions.get(sessionId)
    if (state === undefined) {
      state = { running: undefined, lastErrorAt: undefined, lastPlayedAt: { start: 0, complete: 0, error: 0 } }
      this.sessions.set(sessionId, state)
    }
    return state
  }

  private play(prefs: AnnouncerPrefs, kind: BeepKind, sessionId: string): void {
    const state = this.stateOf(sessionId)
    const now = Date.now()
    if (now - state.lastPlayedAt[kind] < prefs.debounceMs) return
    state.lastPlayedAt[kind] = now
    const config = kind === 'start' ? prefs.start : kind === 'complete' ? prefs.complete : prefs.error
    playEventSound(kind, config, prefs.volume)
  }

  dispose(): void {
    this.sessions.clear()
  }
}
