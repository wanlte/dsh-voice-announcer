/**
 * dsh-voice-announcer — 自定义音频文件存储（IndexedDB）。
 *
 * 用户通过「文件选择器 / 拖拽」导入的本地音频存进 IndexedDB（localStorage 5MB
 * 装不下音频），prefs 里只记录一个 audioId 引用；播放器 custom 模式下按 id 取出，
 * 生成 blob: URL 播放。URL 模式仍走 customUrl 字段，不经过这里。
 *
 * 隐私说明：全程浏览器本地，不上传、不请求网络。
 */
export interface StoredClip {
    /** 主键，形如 clip_<timestamp>_<rand> */
    id: string;
    /** 原始文件名（仅用于 UI 展示） */
    name: string;
    /** MIME 类型（audio/mpeg, audio/wav, audio/ogg, audio/mp4...） */
    type: string;
    /** 字节大小 */
    size: number;
    /** 导入时间戳（ms） */
    addedAt: number;
    /** 音频二进制 */
    blob: Blob;
}
/** 检查是否是可接受的音频 MIME（宽松匹配：只要以 audio/ 开头，或常见扩展）。 */
export declare function isAcceptableAudio(file: File): boolean;
/** 存入一条音频，返回生成的 id。 */
export declare function saveClip(file: File): Promise<string>;
/** 读取一条音频（找不到返回 undefined）。 */
export declare function loadClip(id: string): Promise<StoredClip | undefined>;
/** 删除一条音频（幂等，不存在也当成功）。 */
export declare function deleteClip(id: string): Promise<void>;
/** 列出所有已存音频（不含 blob 字段，用于 UI 展示）。 */
export declare function listClips(): Promise<Array<Omit<StoredClip, 'blob'>>>;
/** 取到可用的 blob: URL；用完记得 releaseClipUrl。找不到时返回 undefined。 */
export declare function acquireClipUrl(id: string): Promise<string | undefined>;
/** 引用计数 -1；归零后真正 revoke。 */
export declare function releaseClipUrl(id: string): void;
