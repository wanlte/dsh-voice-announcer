/**
 * dsh-voice-announcer — client half.
 *
 * 在浏览器端订阅 dsh 会话状态事件（api-session/status、api-session/error），
 * 按偏好配置播报声音；并在「设置 → 插件」里注册一个独立标签页用于配置。
 * 声音全部本地播放：Web Audio 合成音效 / speechSynthesis 朗读 / 自定义音频 URL。
 */
import type { Context } from './context-types.ts';
import { playEventSoundByMode, type BeepKind } from './player.ts';
export declare const name = "dsh-voice-announcer-client";
export declare const inject: string[];
export declare const LOCALE_NS = "voice.announcer";
export declare function apply(ctx: Context): void;
/** 供 SettingsCard 试听按钮使用：按当前选择的方式直接播一次。 */
export declare function previewSound(kind: BeepKind, mode: Parameters<typeof playEventSoundByMode>[1]): void;
