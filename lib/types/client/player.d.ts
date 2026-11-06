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
import type { BeepPreset, EventSoundConfig, SoundMode, TtsSettings } from './prefs.ts';
import { type VoicePackId } from './voicepacks.ts';
/** 安装一次性手势解锁：用户第一次与页面交互时恢复 AudioContext。 */
export declare function installAudioUnlock(): () => void;
/** 五类事件的播报类别：任务开始/完成/失败，以及对话中的提问/确认。 */
export type BeepKind = 'start' | 'complete' | 'error' | 'question' | 'approval';
/**
 * 按配置播报一次。custom 模式下 URL 为空时回退到 beep。
 * @param textOverride tts 模式的朗读文本（如已渲染好的播报文案）；为空则用 config.ttsText，再空用默认文案。
 * @param tts tts 模式的音色/语速/音调；省略则用系统默认。
 */
export declare function playEventSound(kind: BeepKind, config: EventSoundConfig, volume: number, textOverride?: string, tts?: TtsSettings): void;
/** 设置卡片"试听":按指定模式/风格播放，不读取 localStorage 之外的上下文。 */
export declare function playEventSoundByMode(kind: BeepKind, mode: SoundMode, volume: number, preset?: BeepPreset, tts?: TtsSettings, packId?: VoicePackId): void;
export declare function defaultTtsText(kind: BeepKind): string;
/** 卸载插件时清理：关掉声音、释放手势监听由调用方负责。 */
export declare function disposePlayer(): void;
