import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useState, useSyncExternalStore } from 'react';
import { BEEP_PRESETS, loadPrefs, subscribePrefs, updatePrefs, } from "./prefs.js";
import { playEventSoundByMode } from "./player.js";
import { VOICE_PACK_IDS } from "./voicepacks.js";
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
const EVENT_KINDS = [
    { kind: 'start', groupTitle: 'groupStart', groupDesc: 'groupStartDesc' },
    { kind: 'complete', groupTitle: 'groupComplete', groupDesc: 'groupCompleteDesc' },
    { kind: 'error', groupTitle: 'groupError', groupDesc: 'groupErrorDesc' },
    { kind: 'question', groupTitle: 'groupQuestion', groupDesc: 'groupQuestionDesc' },
    { kind: 'approval', groupTitle: 'groupApproval', groupDesc: 'groupApprovalDesc' },
];
/** 对话提醒类事件（需要用不同的语音包说明文案）。 */
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
export function SettingsCard({ t }) {
    const [open, setOpen] = useState(false);
    const [previewState, setPreviewState] = useState(null);
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
            playEventSoundByMode(kind, config.mode, prefs.volume, config.beepPreset, prefs.tts, config.packId);
            setPreviewState({ kind, error: null });
        }
        catch (error) {
            setPreviewState({ kind, error: error instanceof Error ? error.message : String(error) });
        }
    };
    return (_jsxs("div", { className: open ? css.card + ' ' + css.cardOpen : css.card, children: [_jsxs("button", { type: "button", className: css.header, "aria-expanded": open, onClick: () => { setOpen(!open); }, children: [_jsxs("span", { className: css.headText, children: [_jsx("span", { className: css.name, children: t('settingsTitle') }), _jsx("span", { className: css.description, children: t('settingsDesc') })] }), _jsx("svg", { className: open ? css.chevron + ' ' + css.chevronOpen : css.chevron, viewBox: "0 0 14 14", width: "14", height: "14", "aria-hidden": "true", children: _jsx("path", { d: "M3.5 5.5 7 9l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), open && (_jsxs("div", { className: css.body, children: [_jsxs("label", { className: css.toggleRow, children: [_jsxs("span", { className: css.toggleText, children: [_jsx("span", { className: css.label, children: t('masterTitle') }), _jsx("span", { className: css.hint, children: t('masterDesc') })] }), _jsx("input", { type: "checkbox", className: css.toggle, checked: prefs.enabled, onChange: event => { set({ enabled: event.currentTarget.checked }); } })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-volume", children: t('volumeTitle') }), _jsx("input", { id: "voice-announcer-volume", type: "range", min: 0, max: 100, value: Math.round(prefs.volume * 100), onChange: event => { set({ volume: Number(event.currentTarget.value) / 100 }); } }), _jsx("p", { className: css.hint, children: t('volumeDesc') })] }), ttsSupported && (_jsxs("fieldset", { className: css.group, children: [_jsxs("legend", { className: css.groupTitle, children: [_jsx("span", { children: t('ttsVoiceTitle') }), _jsx("span", { className: css.groupDesc, children: t('ttsVoiceDesc') })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-voice", children: t('ttsVoiceLabel') }), _jsxs("select", { id: "voice-announcer-voice", className: css.select, value: prefs.tts.voiceName, onChange: event => { set({ tts: { ...prefs.tts, voiceName: event.currentTarget.value } }); }, children: [_jsx("option", { value: "", children: t('ttsVoiceDefault') }), voices.map(voice => (_jsxs("option", { value: voice.name, children: [voice.name, "\uFF08", voice.lang, "\uFF09"] }, voice.name)))] })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-rate", children: t('ttsRateTitle', { rate: prefs.tts.rate.toFixed(1) }) }), _jsx("input", { id: "voice-announcer-rate", type: "range", min: 50, max: 200, step: 5, value: Math.round(prefs.tts.rate * 100), onChange: event => { set({ tts: { ...prefs.tts, rate: Number(event.currentTarget.value) / 100 } }); } })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-pitch", children: t('ttsPitchTitle', { pitch: prefs.tts.pitch.toFixed(1) }) }), _jsx("input", { id: "voice-announcer-pitch", type: "range", min: 50, max: 200, step: 5, value: Math.round(prefs.tts.pitch * 100), onChange: event => { set({ tts: { ...prefs.tts, pitch: Number(event.currentTarget.value) / 100 } }); } })] })] })), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-debounce", children: t('debounceTitle') }), _jsx("input", { id: "voice-announcer-debounce", type: "number", min: 0, step: 100, value: prefs.debounceMs, onChange: event => { set({ debounceMs: Math.max(0, Number(event.currentTarget.value) || 0) }); } }), _jsx("p", { className: css.hint, children: t('debounceDesc') })] }), _jsxs("div", { className: css.field, children: [_jsxs("label", { className: css.toggleRow, children: [_jsxs("span", { className: css.toggleText, children: [_jsx("span", { className: css.label, children: t('quietEnabled') }), _jsx("span", { className: css.hint, children: t('quietHoursDesc') })] }), _jsx("input", { type: "checkbox", className: css.toggle, checked: prefs.quietHours.enabled, onChange: event => { set({ quietHours: { ...prefs.quietHours, enabled: event.currentTarget.checked } }); } })] }), _jsxs("div", { className: css.timeRow, children: [_jsx("span", { className: css.label, children: t('quietStart') }), _jsx("input", { type: "time", className: css.timeInput, value: prefs.quietHours.start, onChange: event => { set({ quietHours: { ...prefs.quietHours, start: event.currentTarget.value } }); } }), _jsx("span", { className: css.label, children: t('quietEnd') }), _jsx("input", { type: "time", className: css.timeInput, value: prefs.quietHours.end, onChange: event => { set({ quietHours: { ...prefs.quietHours, end: event.currentTarget.value } }); } })] })] }), EVENT_KINDS.map(({ kind, groupTitle, groupDesc }) => {
                        const config = configOf(prefs, kind);
                        return (_jsxs(Fragment, { children: [kind === 'question' && (_jsxs("h3", { className: css.sectionTitle, children: [_jsx("span", { children: t('chatSectionTitle') }), _jsx("span", { className: css.groupDesc, children: t('chatSectionDesc') })] })), _jsxs("fieldset", { className: css.group, children: [_jsxs("legend", { className: css.groupTitle, children: [_jsx("span", { children: t(groupTitle) }), _jsx("span", { className: css.groupDesc, children: t(groupDesc) })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-mode`, children: t('modeTitle') }), _jsxs("select", { id: `voice-announcer-${kind}-mode`, className: css.select, value: config.mode, onChange: event => {
                                                        const mode = event.currentTarget.value;
                                                        set(setConfigOf(prefs, kind, { mode }));
                                                    }, children: [_jsx("option", { value: "off", children: t('modeOff') }), _jsx("option", { value: "beep", children: t('modeBeep') }), _jsx("option", { value: "pack", children: t('modePack') }), _jsx("option", { value: "tts", disabled: !ttsSupported, children: t('modeTts') }), _jsx("option", { value: "custom", children: t('modeCustom') })] }), !ttsSupported && _jsx("p", { className: css.hint, children: t('ttsUnsupported') })] }), config.mode === 'pack' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-pack`, children: t('packIdTitle') }), _jsx("select", { id: `voice-announcer-${kind}-pack`, className: css.select, value: config.packId, onChange: event => {
                                                        const packId = event.currentTarget.value;
                                                        set(setConfigOf(prefs, kind, { packId }));
                                                    }, children: VOICE_PACK_IDS.map(packId => (_jsx("option", { value: packId, children: t(PACK_LABEL_KEYS[packId]) }, packId))) }), _jsx("p", { className: css.hint, children: CHAT_KINDS.has(kind) ? t('packChatHint') : t('packHint') })] })), config.mode === 'beep' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-preset`, children: t('beepPresetTitle') }), _jsx("select", { id: `voice-announcer-${kind}-preset`, className: css.select, value: config.beepPreset, onChange: event => {
                                                        const beepPreset = event.currentTarget.value;
                                                        set(setConfigOf(prefs, kind, { beepPreset }));
                                                    }, children: BEEP_PRESETS.map(preset => (_jsx("option", { value: preset, children: t(PRESET_LABEL_KEYS[preset]) }, preset))) }), _jsx("p", { className: css.hint, children: t('beepPresetHint') })] })), config.mode === 'tts' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-template`, children: t('templateTitle') }), _jsx("input", { id: `voice-announcer-${kind}-template`, type: "text", className: css.input, value: config.template, placeholder: t('templateHint'), onChange: event => { set(setConfigOf(prefs, kind, { template: event.currentTarget.value })); } }), _jsx("p", { className: css.hint, children: t('templateHint') })] })), config.mode === 'custom' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-url`, children: t('customUrlTitle') }), _jsx("input", { id: `voice-announcer-${kind}-url`, type: "url", className: css.input, value: config.customUrl, placeholder: "https://\u2026/sound.mp3", onChange: event => { set(setConfigOf(prefs, kind, { customUrl: event.currentTarget.value })); } }), _jsx("p", { className: css.hint, children: t('customUrlHint') })] })), _jsxs("div", { className: css.field, children: [_jsx("button", { type: "button", className: css.button, disabled: config.mode === 'off', onClick: () => { handlePreview(kind, config); }, children: t('preview') }), previewState?.kind === kind && previewState.error !== null && (_jsx("p", { className: css.hint, children: t('previewFailed', { error: previewState.error }) }))] })] })] }, kind));
                    }), _jsxs("div", { className: css.field, children: [_jsx("span", { className: css.label, children: t('privacyTitle') }), _jsx("p", { className: css.hint, children: t('privacyDesc') })] })] }))] }));
}
