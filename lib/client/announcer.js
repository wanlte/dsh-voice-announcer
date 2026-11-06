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
import { defaultTtsText, playEventSound } from "./player.js";
import { formatDuration, isInQuietHours, renderTemplate } from "./template.js";
/** error 播报后多久内的 status(false) 视为"同一件事"，不再重复播 complete。 */
const ERROR_COOLDOWN_MS = 5000;
export class Announcer {
    getPrefs;
    getTitle;
    sessions = new Map();
    constructor(getPrefs, getTitle = () => undefined) {
        this.getPrefs = getPrefs;
        this.getTitle = getTitle;
    }
    /** 会话状态变化（来自 api-session/status）。 */
    handleStatus(sessionId, running) {
        const prefs = this.getPrefs();
        if (!prefs.enabled)
            return;
        const state = this.stateOf(sessionId);
        const previous = state.running;
        state.running = running;
        if (running && previous !== true) {
            // false -> true：任务开始
            state.startedAt = Date.now();
            this.play(prefs, 'start', sessionId, { title: this.getTitle(sessionId) });
        }
        else if (!running && previous === true) {
            // true -> false：任务结束；若刚报过错则跳过
            const errored = state.lastErrorAt !== undefined
                && Date.now() - state.lastErrorAt < ERROR_COOLDOWN_MS;
            if (!errored) {
                this.play(prefs, 'complete', sessionId, {
                    title: this.getTitle(sessionId),
                    durationMs: state.startedAt !== undefined ? Date.now() - state.startedAt : undefined,
                });
            }
        }
    }
    /** 任务失败（来自 api-session/error）。message 是失败原因，会进 {{error}} 模板变量。 */
    handleError(sessionId, message) {
        const prefs = this.getPrefs();
        if (!prefs.enabled)
            return;
        const state = this.stateOf(sessionId);
        state.lastErrorAt = Date.now();
        this.play(prefs, 'error', sessionId, {
            title: this.getTitle(sessionId),
            error: message,
        });
    }
    /**
     * 对话提醒：AI 停下来向用户提问（user-questions/request 的旁听）。
     * @param text 提问内容（第一条问题的题干），可为空。
     * @param sessionId 提问所属会话，取不到时传空串（只播内容不播标题）。
     */
    handleQuestion(sessionId, text) {
        const prefs = this.getPrefs();
        if (!prefs.enabled)
            return;
        this.play(prefs, 'question', sessionId ?? '', {
            title: sessionId !== undefined ? this.getTitle(sessionId) : undefined,
            text,
        });
    }
    /**
     * 对话提醒：AI 请求授权执行操作（approval/request 的旁听）。
     * @param tool 待确认的操作描述（工具名或原因），可为空。
     */
    handleApproval(sessionId, tool) {
        const prefs = this.getPrefs();
        if (!prefs.enabled)
            return;
        this.play(prefs, 'approval', sessionId ?? '', {
            title: sessionId !== undefined ? this.getTitle(sessionId) : undefined,
            tool,
        });
    }
    stateOf(sessionId) {
        let state = this.sessions.get(sessionId);
        if (state === undefined) {
            state = {
                running: undefined,
                lastErrorAt: undefined,
                lastPlayedAt: { start: 0, complete: 0, error: 0, question: 0, approval: 0 },
                startedAt: undefined,
            };
            this.sessions.set(sessionId, state);
        }
        return state;
    }
    play(prefs, kind, sessionId, ctx) {
        // 免打扰时段：全部静音（状态机照常走，只是不出声）
        if (isInQuietHours(prefs.quietHours.enabled, prefs.quietHours.start, prefs.quietHours.end)) {
            return;
        }
        const state = this.stateOf(sessionId);
        const now = Date.now();
        if (now - state.lastPlayedAt[kind] < prefs.debounceMs)
            return;
        state.lastPlayedAt[kind] = now;
        const config = CONFIG_OF(prefs, kind);
        playEventSound(kind, config, prefs.volume, speechText(config.template, config.ttsText, kind, ctx), prefs.tts);
    }
    dispose() {
        this.sessions.clear();
    }
}
/** 计算最终朗读文本：模板渲染 → 旧 ttsText → 默认文案。 */
function speechText(template, legacyText, kind, ctx) {
    const vars = {
        title: ctx.title ?? '',
        duration: ctx.durationMs !== undefined ? formatDuration(ctx.durationMs) : '',
        error: ctx.error ?? '',
        text: ctx.text ?? '',
        tool: ctx.tool ?? '',
    };
    const rendered = renderTemplate(template, vars);
    if (rendered !== '')
        return rendered;
    if (legacyText !== '')
        return legacyText;
    return defaultTtsText(kind);
}
/** 每个播报类别对应的偏好配置项。 */
function CONFIG_OF(prefs, kind) {
    switch (kind) {
        case 'start': return prefs.start;
        case 'complete': return prefs.complete;
        case 'error': return prefs.error;
        case 'question': return prefs.question;
        case 'approval': return prefs.approval;
    }
}
