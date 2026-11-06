/**
 * dsh-voice-announcer — 自定义音频文件存储（IndexedDB）。
 *
 * 用户通过「文件选择器 / 拖拽」导入的本地音频存进 IndexedDB（localStorage 5MB
 * 装不下音频），prefs 里只记录一个 audioId 引用；播放器 custom 模式下按 id 取出，
 * 生成 blob: URL 播放。URL 模式仍走 customUrl 字段，不经过这里。
 *
 * 隐私说明：全程浏览器本地，不上传、不请求网络。
 */
const DB_NAME = 'dsh-voice-announcer-audio';
const DB_VERSION = 1;
const STORE_NAME = 'clips';
let dbPromise;
function openDb() {
    if (dbPromise !== undefined)
        return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB is not available'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
        request.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
    dbPromise.catch(() => {
        // 打开失败时清掉缓存的 promise，让下次调用可以重试（避免永久卡在 rejected 状态）
        dbPromise = undefined;
    });
    return dbPromise;
}
function generateId() {
    return `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
/** 检查是否是可接受的音频 MIME（宽松匹配：只要以 audio/ 开头，或常见扩展）。 */
export function isAcceptableAudio(file) {
    if (file.type.startsWith('audio/'))
        return true;
    // 有些浏览器对 .mp3 给出空 type；按扩展名兜底
    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    return ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'webm', 'opus'].includes(ext);
}
/** 存入一条音频，返回生成的 id。 */
export async function saveClip(file) {
    const db = await openDb();
    const id = generateId();
    const record = {
        id,
        name: file.name,
        type: file.type || 'audio/mpeg',
        size: file.size,
        addedAt: Date.now(),
        blob: file,
    };
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('save failed'));
        tx.onabort = () => reject(tx.error ?? new Error('save aborted'));
    });
    return id;
}
/** 读取一条音频（找不到返回 undefined）。 */
export async function loadClip(id) {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('load failed'));
    });
}
/** 删除一条音频（幂等，不存在也当成功）。 */
export async function deleteClip(id) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('delete failed'));
    });
}
/** 列出所有已存音频（不含 blob 字段，用于 UI 展示）。 */
export async function listClips() {
    const db = await openDb();
    const all = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error ?? new Error('list failed'));
    });
    return all.map(({ blob: _blob, ...rest }) => rest);
}
/* ------------------------------------------------------------------ *
 * blob URL 缓存：同一 audioId 复用 URL，减少 create/ revoke 抖动
 * ------------------------------------------------------------------ */
const urlCache = new Map();
/** 取到可用的 blob: URL；用完记得 releaseClipUrl。找不到时返回 undefined。 */
export async function acquireClipUrl(id) {
    const cached = urlCache.get(id);
    if (cached !== undefined) {
        cached.refCount += 1;
        return cached.url;
    }
    const clip = await loadClip(id);
    if (clip === undefined)
        return undefined;
    const url = URL.createObjectURL(clip.blob);
    urlCache.set(id, { url, refCount: 1 });
    return url;
}
/** 引用计数 -1；归零后真正 revoke。 */
export function releaseClipUrl(id) {
    const cached = urlCache.get(id);
    if (cached === undefined)
        return;
    cached.refCount -= 1;
    if (cached.refCount <= 0) {
        URL.revokeObjectURL(cached.url);
        urlCache.delete(id);
    }
}
