/**
 * dsh-voice-announcer — audio player.
 *
 * 三种播报通道，全部在浏览器本地完成：
 *   - beep   : Web Audio API 实时合成提示音（零文件、零请求）
 *   - tts    : 浏览器内置 speechSynthesis 朗读文本（零 API Key）
 *   - custom : HTMLAudioElement 播放自定义语音包 URL
 *
 * 自动播放策略：浏览器要求 AudioContext 必须在用户手势后才能出声，
 * 因此 apply() 阶段会注册一次性解锁监听，任何点击/按键都会 resume。
 */
import type { EventSoundConfig, SoundMode } from './prefs.ts';
/** 安装一次性手势解锁：用户第一次与页面交互时恢复 AudioContext。 */
export declare function installAudioUnlock(): () => void;
/** 三种事件的合成音色：开始=上行双音，完成=三音欢快琶音，失败=低沉下行。 */
export type BeepKind = 'start' | 'complete' | 'error';
/**
 * 按配置播报一次。custom 模式下 URL 为空时回退到 beep。
 */
export declare function playEventSound(kind: BeepKind, config: EventSoundConfig, volume: number): void;
export declare function playEventSoundByMode(kind: BeepKind, mode: SoundMode, volume: number): void;
export declare function defaultTtsText(kind: BeepKind): string;
/** 卸载插件时清理：关掉声音、释放手势监听由调用方负责。 */
export declare function disposePlayer(): void;
