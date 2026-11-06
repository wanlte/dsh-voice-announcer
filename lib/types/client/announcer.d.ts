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
 * v0.2 播报内容化：
 *   - 记录每次任务开始时间，完成时算出用时 {{duration}}；
 *   - 通过注入的 titleResolver 取任务名 {{title}}；
 *   - error 事件携带 message，作为失败原因 {{error}}；
 *   - 文案由模板渲染（renderTemplate），支持 {{title}}/{{duration}}/{{error}}；
 *   - 免打扰时段（quietHours）内所有事件静音。
 *
 * v0.3 对话提醒：
 *   - user-questions/request → question：AI 停下来问你话，播报提问内容 {{text}}；
 *   - approval/request       → approval：AI 要执行敏感操作，播报待确认对象 {{tool}}。
 *   这两个是 waterfall 事件：监听器必须原样调用 next() 把请求交回内置 UI，
 *   否则会吞掉提问/审批，导致 AI 卡死——本类只做旁听播报，绝不返回答案。
 *
 * 同一事件在 debounceMs 窗口内只播一次（比如多个子任务同时结束）。
 * 所有状态只存在内存里，卸载即清空。
 */
import type { AnnouncerPrefs } from './prefs.ts';
/** 一次播报可用的动态上下文（对应模板变量）。 */
export interface AnnouncementContext {
    /** 任务名（会话显示标题），取不到时为 undefined。 */
    title?: string;
    /** 用时（毫秒），开始事件为 undefined。 */
    durationMs?: number;
    /** 失败原因（error 事件消息），仅失败事件。 */
    error?: string;
    /** 提问内容（对话提问事件）。 */
    text?: string;
    /** 待确认的操作（对话确认事件，通常是工具名或权限描述）。 */
    tool?: string;
}
/** 从会话 id 解析显示名；取不到返回 undefined。由 client/index.ts 注入。 */
export type TitleResolver = (sessionId: string) => string | undefined;
export declare class Announcer {
    private readonly getPrefs;
    private readonly getTitle;
    private readonly sessions;
    constructor(getPrefs: () => AnnouncerPrefs, getTitle?: TitleResolver);
    /** 会话状态变化（来自 api-session/status）。 */
    handleStatus(sessionId: string, running: boolean): void;
    /** 任务失败（来自 api-session/error）。message 是失败原因，会进 {{error}} 模板变量。 */
    handleError(sessionId: string, message: string): void;
    /**
     * 对话提醒：AI 停下来向用户提问（user-questions/request 的旁听）。
     * @param text 提问内容（第一条问题的题干），可为空。
     * @param sessionId 提问所属会话，取不到时传空串（只播内容不播标题）。
     */
    handleQuestion(sessionId: string | undefined, text: string | undefined): void;
    /**
     * 对话提醒：AI 请求授权执行操作（approval/request 的旁听）。
     * @param tool 待确认的操作描述（工具名或原因），可为空。
     */
    handleApproval(sessionId: string | undefined, tool: string | undefined): void;
    private stateOf;
    private play;
    dispose(): void;
}
