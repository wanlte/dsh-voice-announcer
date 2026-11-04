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
import type { AnnouncerPrefs } from './prefs.ts';
export declare class Announcer {
    private readonly getPrefs;
    private readonly sessions;
    constructor(getPrefs: () => AnnouncerPrefs);
    /** 会话状态变化（来自 api-session/status）。 */
    handleStatus(sessionId: string, running: boolean): void;
    /** 任务失败（来自 api-session/error）。 */
    handleError(sessionId: string): void;
    private stateOf;
    private play;
    dispose(): void;
}
