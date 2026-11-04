/**
 * dsh-voice-announcer — host half.
 *
 * DSH 状态语音播报：任务开始 / 完成 / 失败时在浏览器里自动播报。
 * 全部逻辑（事件监听 + 合成音效 + 浏览器 TTS + 自定义语音包）都发生在浏览器端：
 *   - 事件：ctx.remote.$on('api-session/status' | 'api-session/error')
 *   - 声音：Web Audio API / speechSynthesis / HTMLAudioElement
 * 零后端、零 API Key、零模型下载、不落盘。
 *
 * The host half only places the plugin in the host cordis tree so the
 * client-modules scanner discovers the `dsh.client` bundle; it registers no
 * tools and opens no channels.
 */
export const name = 'dsh-voice-announcer';
export function apply(ctx) {
    // 只用 console（避免 ctx.logger 服务不可用时抛错导致 fiber 失败、客户端 bundle 不被发现）
    try {
        const log = ctx.logger?.info?.bind(ctx.logger);
        if (typeof log === 'function')
            log('[dsh-voice-announcer] loaded');
        else
            console.log('[dsh-voice-announcer] loaded');
    }
    catch {
        console.log('[dsh-voice-announcer] loaded');
    }
}
