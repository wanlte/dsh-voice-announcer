/**
 * dsh-voice-announcer — built-in voice packs (base64 MP3, offline).
 *
 * 固定句子的人声播报（任务开始/完成/失败），随插件一起分发，无需联网。
 * 音频由 TTS 生成后转 48kbps 单声道 MP3，每段约 12KB。
 * 注意：内置语音包是固定文案，不含任务名/用时/错误原因；需要动态内容请用 TTS 模式。
 */
export type VoicePackId = 'soft-female' | 'deep-male';
export declare const VOICE_PACK_IDS: readonly VoicePackId[];
export type ClipKind = 'start' | 'complete' | 'error';
export interface VoicePack {
    /** 每个事件对应的 data URI（audio/mpeg）。 */
    clips: Record<ClipKind, string>;
}
export declare const VOICE_PACKS: Record<VoicePackId, VoicePack>;
