import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BEEP_PRESETS, loadPrefs, subscribePrefs, updatePrefs, } from "./prefs.js";
import { playEventSoundByMode } from "./player.js";
import { VOICE_PACK_IDS } from "./voicepacks.js";
import { deleteClip, isAcceptableAudio, saveClip } from "./audio-store.js";
import css from './SettingsCard.module.css';
const PRESET_LABEL_KEYS = {
    classic: 'presetClassic',
    chime: 'presetChime',
    marimba: 'presetMarimba',
    bell: 'presetBell',
    pulse: 'presetPulse',
    coin: 'presetCoin',
};
const PACK_LABEL_KEYS = {
    'soft-female': 'packSoftFemale',
    'deep-male': 'packDeepMale',
};
const TASK_EVENTS = [
    { kind: 'start', groupTitle: 'groupStart', groupDesc: 'groupStartDesc' },
    { kind: 'complete', groupTitle: 'groupComplete', groupDesc: 'groupCompleteDesc' },
    { kind: 'error', groupTitle: 'groupError', groupDesc: 'groupErrorDesc' },
];
const CHAT_EVENTS = [
    { kind: 'question', groupTitle: 'groupQuestion', groupDesc: 'groupQuestionDesc' },
    { kind: 'approval', groupTitle: 'groupApproval', groupDesc: 'groupApprovalDesc' },
];
/** 对话提醒类事件（语音包说明文案不同）。 */
const CHAT_KINDS = new Set(['question', 'approval']);
function configOf(prefs, kind) {
    switch (kind) {
        case 'start': return prefs.start;
        case 'complete': return prefs.complete;
        case 'error': return prefs.error;
        case 'question': return prefs.question;
        case 'approval': return prefs.approval;
    }
}
function setConfigOf(prefs, kind, patch) {
    switch (kind) {
        case 'start': return { start: { ...prefs.start, ...patch } };
        case 'complete': return { complete: { ...prefs.complete, ...patch } };
        case 'error': return { error: { ...prefs.error, ...patch } };
        case 'question': return { question: { ...prefs.question, ...patch } };
        case 'approval': return { approval: { ...prefs.approval, ...patch } };
    }
}
/** 人类可读的字节大小（1.2 MB / 340 KB）。 */
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
/** 事件当前配置的简短描述（折叠 header 展示）。 */
function summarize(kind, config, t) {
    switch (config.mode) {
        case 'off':
            return t('summaryOff');
        case 'beep':
            return t('summaryBeep', { preset: t(PRESET_LABEL_KEYS[config.beepPreset]) });
        case 'pack':
            return t('summaryPack', { pack: t(PACK_LABEL_KEYS[config.packId]) });
        case 'tts':
            return t('summaryTts');
        case 'custom':
            if (config.customAudioId !== '') {
                return t('summaryCustomFile', { name: config.customAudioName || kind });
            }
            if (config.customUrl !== '')
                return t('summaryCustomUrl');
            return t('summaryCustomBeep');
    }
}
function CustomAudioImport({ kind, config, onChange, t }) {
    const fileInputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const hasFile = config.customAudioId !== '';
    // URL / File 二选一：任一存在即视为当前 source；两者都无时默认展示 file 面板
    const source = hasFile ? 'file' : (config.customUrl !== '' ? 'url' : 'file');
    const setSource = (next) => {
        if (next === source)
            return;
        if (next === 'url') {
            // 切到 URL 时保留已有 URL（若有）；清空 file 侧字段
            onChange({ customAudioId: '', customAudioName: '' });
        }
        else {
            onChange({ customUrl: '' });
        }
    };
    const handleFile = async (file) => {
        setError(null);
        if (!isAcceptableAudio(file)) {
            setError(t('customUnsupportedType'));
            return;
        }
        setBusy(true);
        try {
            // 换文件时旧文件从 IDB 中删除，避免累积
            if (config.customAudioId !== '') {
                try {
                    await deleteClip(config.customAudioId);
                }
                catch { /* 忽略 */ }
            }
            const id = await saveClip(file);
            onChange({ customAudioId: id, customAudioName: file.name, customUrl: '' });
        }
        catch (err) {
            setError(t('customSaveFailed', { error: err instanceof Error ? err.message : String(err) }));
        }
        finally {
            setBusy(false);
        }
    };
    const handleRemove = async () => {
        if (config.customAudioId !== '') {
            try {
                await deleteClip(config.customAudioId);
            }
            catch { /* 忽略 */ }
        }
        onChange({ customAudioId: '', customAudioName: '' });
    };
    return (_jsxs("div", { className: css.field, children: [_jsx("span", { className: css.label, children: t('modeCustom') }), _jsx("p", { className: css.hint, children: t('customIntro') }), _jsxs("div", { className: css.sourceTabs, role: "tablist", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": source === 'file', className: source === 'file' ? css.sourceTab + ' ' + css.sourceTabActive : css.sourceTab, onClick: () => { setSource('file'); }, children: t('customSourceFile') }), _jsx("button", { type: "button", role: "tab", "aria-selected": source === 'url', className: source === 'url' ? css.sourceTab + ' ' + css.sourceTabActive : css.sourceTab, onClick: () => { setSource('url'); }, children: t('customSourceUrl') })] }), source === 'file' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: dragOver ? css.dropZone + ' ' + css.dropZoneActive : css.dropZone, onDragOver: event => {
                            event.preventDefault();
                            if (!dragOver)
                                setDragOver(true);
                        }, onDragLeave: event => {
                            event.preventDefault();
                            setDragOver(false);
                        }, onDrop: event => {
                            event.preventDefault();
                            setDragOver(false);
                            const file = event.dataTransfer.files?.[0];
                            if (file !== undefined)
                                void handleFile(file);
                        }, onClick: () => { fileInputRef.current?.click(); }, role: "button", tabIndex: 0, onKeyDown: event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                fileInputRef.current?.click();
                            }
                        }, children: [_jsx("span", { className: css.dropText, children: busy ? '…' : (dragOver ? t('customDropping') : t('customDropHint')) }), _jsx("button", { type: "button", className: css.dropButton, onClick: event => {
                                    event.stopPropagation();
                                    fileInputRef.current?.click();
                                }, disabled: busy, children: t('customPickFile') })] }), _jsx("input", { ref: fileInputRef, type: "file", accept: "audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus", style: { display: 'none' }, onChange: event => {
                            const file = event.currentTarget.files?.[0];
                            if (file !== undefined)
                                void handleFile(file);
                            event.currentTarget.value = '';
                        } }), hasFile ? (_jsxs("div", { className: css.currentFileRow, children: [_jsx("span", { className: css.currentFileText, children: t('customCurrentFile', {
                                    name: config.customAudioName,
                                    size: formatBytes(0),
                                }) }), _jsx("button", { type: "button", className: css.linkButton, onClick: () => { void handleRemove(); }, children: t('customRemoveFile') })] })) : (_jsx("p", { className: css.hint, children: t('customNoFile') }))] })), source === 'url' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-url`, children: t('customUrlTitle') }), _jsx("input", { id: `voice-announcer-${kind}-url`, type: "url", className: css.input, value: config.customUrl, placeholder: "https://\u2026/sound.mp3", onChange: event => { onChange({ customUrl: event.currentTarget.value }); } }), _jsx("p", { className: css.hint, children: t('customUrlHint') })] })), error !== null && _jsx("p", { className: css.hint, children: error })] }));
}
function QuickAddBar({ config, onChange, t }) {
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const hasFile = config.customAudioId !== '';
    const importFile = async (file) => {
        setError(null);
        if (!isAcceptableAudio(file)) {
            setError(t('customUnsupportedType'));
            return;
        }
        setBusy(true);
        try {
            if (config.customAudioId !== '') {
                try {
                    await deleteClip(config.customAudioId);
                }
                catch { /* 忽略 */ }
            }
            const id = await saveClip(file);
            // 一键完成：写入文件引用 + 自动切到 custom 模式 + 清理 URL
            onChange({ customAudioId: id, customAudioName: file.name, customUrl: '', mode: 'custom' });
        }
        catch (err) {
            setError(t('customSaveFailed', { error: err instanceof Error ? err.message : String(err) }));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: dragOver ? css.quickAdd + ' ' + css.quickAddActive : css.quickAdd, onDragOver: event => { event.preventDefault(); if (!dragOver)
            setDragOver(true); }, onDragLeave: event => { event.preventDefault(); setDragOver(false); }, onDrop: event => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files?.[0];
            if (file !== undefined)
                void importFile(file);
        }, children: [_jsx("span", { className: css.quickAddText, children: busy ? '…' : (dragOver ? t('customDropping') : t('quickAddHint')) }), _jsx("button", { type: "button", className: css.dropButton, disabled: busy, onClick: () => { inputRef.current?.click(); }, children: hasFile ? t('quickAddReplace') : t('quickAddButton') }), _jsx("input", { ref: inputRef, type: "file", accept: "audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus", style: { display: 'none' }, onChange: event => {
                    const file = event.currentTarget.files?.[0];
                    if (file !== undefined)
                        void importFile(file);
                    event.currentTarget.value = '';
                } }), error !== null && _jsx("p", { className: css.hint, children: error })] }));
}
function EventPanel({ kind, config, ttsSupported, onChange, onPreview, previewError, t, }) {
    return (_jsxs(_Fragment, { children: [_jsx(QuickAddBar, { config: config, onChange: onChange, t: t }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-mode`, children: t('modeTitle') }), _jsxs("select", { id: `voice-announcer-${kind}-mode`, className: css.select, value: config.mode, onChange: event => { onChange({ mode: event.currentTarget.value }); }, children: [_jsx("option", { value: "off", children: t('modeOff') }), _jsx("option", { value: "beep", children: t('modeBeep') }), _jsx("option", { value: "pack", children: t('modePack') }), _jsx("option", { value: "tts", disabled: !ttsSupported, children: t('modeTts') }), _jsx("option", { value: "custom", children: t('modeCustom') })] }), !ttsSupported && _jsx("p", { className: css.hint, children: t('ttsUnsupported') })] }), config.mode === 'pack' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-pack`, children: t('packIdTitle') }), _jsx("select", { id: `voice-announcer-${kind}-pack`, className: css.select, value: config.packId, onChange: event => { onChange({ packId: event.currentTarget.value }); }, children: VOICE_PACK_IDS.map(packId => (_jsx("option", { value: packId, children: t(PACK_LABEL_KEYS[packId]) }, packId))) }), _jsx("p", { className: css.hint, children: CHAT_KINDS.has(kind) ? t('packChatHint') : t('packHint') })] })), config.mode === 'beep' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-preset`, children: t('beepPresetTitle') }), _jsx("select", { id: `voice-announcer-${kind}-preset`, className: css.select, value: config.beepPreset, onChange: event => { onChange({ beepPreset: event.currentTarget.value }); }, children: BEEP_PRESETS.map(preset => (_jsx("option", { value: preset, children: t(PRESET_LABEL_KEYS[preset]) }, preset))) }), _jsx("p", { className: css.hint, children: t('beepPresetHint') })] })), (config.mode === 'tts') && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-template`, children: t('templateTitle') }), _jsx("input", { id: `voice-announcer-${kind}-template`, type: "text", className: css.input, value: config.template, placeholder: t('templateHint'), onChange: event => { onChange({ template: event.currentTarget.value }); } }), _jsx("p", { className: css.hint, children: t('templateHint') })] })), config.mode === 'custom' && (_jsx(CustomAudioImport, { kind: kind, config: config, ttsSupported: ttsSupported, onChange: onChange, t: t })), _jsxs("div", { className: css.field, children: [_jsx("button", { type: "button", className: css.button, disabled: config.mode === 'off', onClick: onPreview, children: t('preview') }), previewError !== null && (_jsx("p", { className: css.hint, children: t('previewFailed', { error: previewError }) }))] })] }));
}
/* ------------------------------------------------------------------ *
 * 主组件
 * ------------------------------------------------------------------ */
export function SettingsCard({ t }) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [expanded, setExpanded] = useState({
        start: false, complete: false, error: false, question: false, approval: false,
    });
    const [previewError, setPreviewError] = useState({
        start: null, complete: null, error: null, question: null, approval: null,
    });
    const [voices, setVoices] = useState([]);
    const prefs = useSyncExternalStore(subscribePrefs, loadPrefs);
    const set = (patch) => { updatePrefs(patch); };
    const ttsSupported = typeof speechSynthesis !== 'undefined';
    // 语音列表在部分浏览器里异步加载，需要监听 voiceschanged
    useEffect(() => {
        if (!ttsSupported)
            return;
        const refresh = () => { setVoices(speechSynthesis.getVoices()); };
        refresh();
        speechSynthesis.addEventListener('voiceschanged', refresh);
        return () => { speechSynthesis.removeEventListener('voiceschanged', refresh); };
    }, [ttsSupported]);
    const handlePreview = (kind, config) => {
        try {
            playEventSoundByMode(kind, config.mode, prefs.volume, config.beepPreset, prefs.tts, config.packId, config);
            setPreviewError(prev => ({ ...prev, [kind]: null }));
        }
        catch (error) {
            setPreviewError(prev => ({ ...prev, [kind]: error instanceof Error ? error.message : String(error) }));
        }
    };
    const toggleExpanded = (kind) => {
        setExpanded(prev => ({ ...prev, [kind]: !prev[kind] }));
    };
    const renderEventList = (events) => (_jsx("div", { className: css.tabPanel, children: events.map(({ kind, groupTitle, groupDesc }) => {
            const config = configOf(prefs, kind);
            const isOpen = expanded[kind];
            return (_jsxs("div", { className: css.eventRow, children: [_jsxs("button", { type: "button", className: css.eventHeader, "aria-expanded": isOpen, onClick: () => { toggleExpanded(kind); }, children: [_jsxs("span", { className: css.eventHeadText, children: [_jsx("span", { className: css.eventName, children: t(groupTitle) }), _jsx("span", { className: css.eventSummary, children: t('eventCurrently', { summary: summarize(kind, config, t) }) })] }), _jsx("svg", { className: isOpen ? css.chevron + ' ' + css.chevronOpen : css.chevron, viewBox: "0 0 14 14", width: "14", height: "14", "aria-hidden": "true", children: _jsx("path", { d: "M3.5 5.5 7 9l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), isOpen && (_jsxs("div", { className: css.eventBody, children: [_jsx("p", { className: css.hint, children: t(groupDesc) }), _jsx(EventPanel, { kind: kind, config: config, ttsSupported: ttsSupported, volume: prefs.volume, beepPresetHintShown: true, onChange: patch => { set(setConfigOf(prefs, kind, patch)); }, onPreview: () => { handlePreview(kind, config); }, previewError: previewError[kind], t: t })] }))] }, kind));
        }) }));
    return (_jsxs("div", { className: open ? css.card + ' ' + css.cardOpen : css.card, children: [_jsxs("button", { type: "button", className: css.header, "aria-expanded": open, onClick: () => { setOpen(!open); }, children: [_jsxs("span", { className: css.headText, children: [_jsx("span", { className: css.name, children: t('settingsTitle') }), _jsx("span", { className: css.description, children: t('settingsDesc') })] }), _jsx("svg", { className: open ? css.chevron + ' ' + css.chevronOpen : css.chevron, viewBox: "0 0 14 14", width: "14", height: "14", "aria-hidden": "true", children: _jsx("path", { d: "M3.5 5.5 7 9l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), open && (_jsxs("div", { className: css.body, children: [_jsxs("div", { className: css.tabBar, role: "tablist", children: [_jsx(TabButton, { id: "general", active: activeTab, onSelect: setActiveTab, label: t('tabGeneral') }), _jsx(TabButton, { id: "task", active: activeTab, onSelect: setActiveTab, label: t('tabTask') }), _jsx(TabButton, { id: "chat", active: activeTab, onSelect: setActiveTab, label: t('tabChat') })] }), activeTab === 'general' && (_jsxs("div", { className: css.tabPanel, children: [_jsxs("label", { className: css.toggleRow, children: [_jsxs("span", { className: css.toggleText, children: [_jsx("span", { className: css.label, children: t('masterTitle') }), _jsx("span", { className: css.hint, children: t('masterDesc') })] }), _jsx("input", { type: "checkbox", className: css.toggle, checked: prefs.enabled, onChange: event => { set({ enabled: event.currentTarget.checked }); } })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-volume", children: t('volumeTitle') }), _jsx("input", { id: "voice-announcer-volume", type: "range", min: 0, max: 100, value: Math.round(prefs.volume * 100), onChange: event => { set({ volume: Number(event.currentTarget.value) / 100 }); } }), _jsx("p", { className: css.hint, children: t('volumeDesc') })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-debounce", children: t('debounceTitle') }), _jsx("input", { id: "voice-announcer-debounce", type: "number", min: 0, step: 100, value: prefs.debounceMs, onChange: event => { set({ debounceMs: Math.max(0, Number(event.currentTarget.value) || 0) }); } }), _jsx("p", { className: css.hint, children: t('debounceDesc') })] }), _jsxs("div", { className: css.field, children: [_jsxs("label", { className: css.toggleRow, children: [_jsxs("span", { className: css.toggleText, children: [_jsx("span", { className: css.label, children: t('quietEnabled') }), _jsx("span", { className: css.hint, children: t('quietHoursDesc') })] }), _jsx("input", { type: "checkbox", className: css.toggle, checked: prefs.quietHours.enabled, onChange: event => { set({ quietHours: { ...prefs.quietHours, enabled: event.currentTarget.checked } }); } })] }), _jsxs("div", { className: css.timeRow, children: [_jsx("span", { className: css.label, children: t('quietStart') }), _jsx("input", { type: "time", className: css.timeInput, value: prefs.quietHours.start, onChange: event => { set({ quietHours: { ...prefs.quietHours, start: event.currentTarget.value } }); } }), _jsx("span", { className: css.label, children: t('quietEnd') }), _jsx("input", { type: "time", className: css.timeInput, value: prefs.quietHours.end, onChange: event => { set({ quietHours: { ...prefs.quietHours, end: event.currentTarget.value } }); } })] })] }), ttsSupported && (_jsxs("fieldset", { className: css.group, children: [_jsxs("legend", { className: css.groupTitle, children: [_jsx("span", { children: t('ttsVoiceTitle') }), _jsx("span", { className: css.groupDesc, children: t('ttsVoiceDesc') })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-voice", children: t('ttsVoiceLabel') }), _jsxs("select", { id: "voice-announcer-voice", className: css.select, value: prefs.tts.voiceName, onChange: event => { set({ tts: { ...prefs.tts, voiceName: event.currentTarget.value } }); }, children: [_jsx("option", { value: "", children: t('ttsVoiceDefault') }), voices.map(voice => (_jsxs("option", { value: voice.name, children: [voice.name, "\uFF08", voice.lang, "\uFF09"] }, voice.name)))] })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-rate", children: t('ttsRateTitle', { rate: prefs.tts.rate.toFixed(1) }) }), _jsx("input", { id: "voice-announcer-rate", type: "range", min: 50, max: 200, step: 5, value: Math.round(prefs.tts.rate * 100), onChange: event => { set({ tts: { ...prefs.tts, rate: Number(event.currentTarget.value) / 100 } }); } })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-pitch", children: t('ttsPitchTitle', { pitch: prefs.tts.pitch.toFixed(1) }) }), _jsx("input", { id: "voice-announcer-pitch", type: "range", min: 50, max: 200, step: 5, value: Math.round(prefs.tts.pitch * 100), onChange: event => { set({ tts: { ...prefs.tts, pitch: Number(event.currentTarget.value) / 100 } }); } })] })] })), _jsxs("div", { className: css.field, children: [_jsx("span", { className: css.label, children: t('privacyTitle') }), _jsx("p", { className: css.hint, children: t('privacyDesc') })] })] })), activeTab === 'task' && renderEventList(TASK_EVENTS), activeTab === 'chat' && renderEventList(CHAT_EVENTS)] }))] }));
}
function TabButton({ id, active, onSelect, label }) {
    const isActive = active === id;
    return (_jsx(Fragment, { children: _jsx("button", { type: "button", role: "tab", "aria-selected": isActive, className: isActive ? css.tab + ' ' + css.tabActive : css.tab, onClick: () => { onSelect(id); }, children: label }) }));
}
