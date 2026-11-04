import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useSyncExternalStore } from 'react';
import { loadPrefs, subscribePrefs, updatePrefs } from "./prefs.js";
import { playEventSoundByMode } from "./player.js";
import css from './SettingsCard.module.css';
const EVENT_KINDS = [
    { kind: 'start', groupTitle: 'groupStart', groupDesc: 'groupStartDesc' },
    { kind: 'complete', groupTitle: 'groupComplete', groupDesc: 'groupCompleteDesc' },
    { kind: 'error', groupTitle: 'groupError', groupDesc: 'groupErrorDesc' },
];
function configOf(prefs, kind) {
    return kind === 'start' ? prefs.start : kind === 'complete' ? prefs.complete : prefs.error;
}
function setConfigOf(prefs, kind, patch) {
    if (kind === 'start')
        return { start: { ...prefs.start, ...patch } };
    if (kind === 'complete')
        return { complete: { ...prefs.complete, ...patch } };
    return { error: { ...prefs.error, ...patch } };
}
export function SettingsCard({ t }) {
    const [open, setOpen] = useState(false);
    const [previewState, setPreviewState] = useState(null);
    const prefs = useSyncExternalStore(subscribePrefs, loadPrefs);
    const set = (patch) => { updatePrefs(patch); };
    const ttsSupported = typeof speechSynthesis !== 'undefined';
    const handlePreview = (kind, mode) => {
        try {
            playEventSoundByMode(kind, mode, prefs.volume);
            setPreviewState({ kind, error: null });
        }
        catch (error) {
            setPreviewState({ kind, error: error instanceof Error ? error.message : String(error) });
        }
    };
    return (_jsxs("div", { className: open ? css.card + ' ' + css.cardOpen : css.card, children: [_jsxs("button", { type: "button", className: css.header, "aria-expanded": open, onClick: () => { setOpen(!open); }, children: [_jsxs("span", { className: css.headText, children: [_jsx("span", { className: css.name, children: t('settingsTitle') }), _jsx("span", { className: css.description, children: t('settingsDesc') })] }), _jsx("svg", { className: open ? css.chevron + ' ' + css.chevronOpen : css.chevron, viewBox: "0 0 14 14", width: "14", height: "14", "aria-hidden": "true", children: _jsx("path", { d: "M3.5 5.5 7 9l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) })] }), open && (_jsxs("div", { className: css.body, children: [_jsxs("label", { className: css.toggleRow, children: [_jsxs("span", { className: css.toggleText, children: [_jsx("span", { className: css.label, children: t('masterTitle') }), _jsx("span", { className: css.hint, children: t('masterDesc') })] }), _jsx("input", { type: "checkbox", className: css.toggle, checked: prefs.enabled, onChange: event => { set({ enabled: event.currentTarget.checked }); } })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-volume", children: t('volumeTitle') }), _jsx("input", { id: "voice-announcer-volume", type: "range", min: 0, max: 100, value: Math.round(prefs.volume * 100), onChange: event => { set({ volume: Number(event.currentTarget.value) / 100 }); } }), _jsx("p", { className: css.hint, children: t('volumeDesc') })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: "voice-announcer-debounce", children: t('debounceTitle') }), _jsx("input", { id: "voice-announcer-debounce", type: "number", min: 0, step: 100, value: prefs.debounceMs, onChange: event => { set({ debounceMs: Math.max(0, Number(event.currentTarget.value) || 0) }); } }), _jsx("p", { className: css.hint, children: t('debounceDesc') })] }), EVENT_KINDS.map(({ kind, groupTitle, groupDesc }) => {
                        const config = configOf(prefs, kind);
                        return (_jsxs("fieldset", { className: css.group, children: [_jsxs("legend", { className: css.groupTitle, children: [_jsx("span", { children: t(groupTitle) }), _jsx("span", { className: css.groupDesc, children: t(groupDesc) })] }), _jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-mode`, children: t('modeTitle') }), _jsxs("select", { id: `voice-announcer-${kind}-mode`, className: css.select, value: config.mode, onChange: event => {
                                                const mode = event.currentTarget.value;
                                                set(setConfigOf(prefs, kind, { mode }));
                                            }, children: [_jsx("option", { value: "off", children: t('modeOff') }), _jsx("option", { value: "beep", children: t('modeBeep') }), _jsx("option", { value: "tts", disabled: !ttsSupported, children: t('modeTts') }), _jsx("option", { value: "custom", children: t('modeCustom') })] }), !ttsSupported && _jsx("p", { className: css.hint, children: t('ttsUnsupported') })] }), config.mode === 'tts' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-tts`, children: t('ttsTextTitle') }), _jsx("input", { id: `voice-announcer-${kind}-tts`, type: "text", className: css.input, value: config.ttsText, placeholder: t('ttsTextHint'), onChange: event => { set(setConfigOf(prefs, kind, { ttsText: event.currentTarget.value })); } }), _jsx("p", { className: css.hint, children: t('ttsTextHint') })] })), config.mode === 'custom' && (_jsxs("div", { className: css.field, children: [_jsx("label", { className: css.label, htmlFor: `voice-announcer-${kind}-url`, children: t('customUrlTitle') }), _jsx("input", { id: `voice-announcer-${kind}-url`, type: "url", className: css.input, value: config.customUrl, placeholder: "https://\u2026/sound.mp3", onChange: event => { set(setConfigOf(prefs, kind, { customUrl: event.currentTarget.value })); } }), _jsx("p", { className: css.hint, children: t('customUrlHint') })] })), _jsxs("div", { className: css.field, children: [_jsx("button", { type: "button", className: css.button, disabled: config.mode === 'off', onClick: () => { handlePreview(kind, config.mode); }, children: t('preview') }), previewState?.kind === kind && previewState.error !== null && (_jsx("p", { className: css.hint, children: t('previewFailed', { error: previewState.error }) }))] })] }, kind));
                    }), _jsxs("div", { className: css.field, children: [_jsx("span", { className: css.label, children: t('privacyTitle') }), _jsx("p", { className: css.hint, children: t('privacyDesc') })] })] }))] }));
}
