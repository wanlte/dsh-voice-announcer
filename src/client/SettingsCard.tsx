import { Fragment, useEffect, useState, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  BEEP_PRESETS,
  loadPrefs,
  subscribePrefs,
  updatePrefs,
  type AnnouncerPrefs,
  type BeepPreset,
  type EventSoundConfig,
  type SoundMode,
} from './prefs.ts'
import { playEventSoundByMode, type BeepKind } from './player.ts'
import { VOICE_PACK_IDS, type VoicePackId } from './voicepacks.ts'
import type { zh } from './locales.ts'
import css from './SettingsCard.module.css'

export type SettingsCardProps = PropsLocale<'voice.announcer'>

const PRESET_LABEL_KEYS: Record<BeepPreset, keyof typeof zh> = {
  classic: 'presetClassic',
  chime: 'presetChime',
  marimba: 'presetMarimba',
  bell: 'presetBell',
  pulse: 'presetPulse',
  coin: 'presetCoin',
}

const PACK_LABEL_KEYS: Record<VoicePackId, keyof typeof zh> = {
  'soft-female': 'packSoftFemale',
  'deep-male': 'packDeepMale',
}

const EVENT_KINDS: ReadonlyArray<{ kind: BeepKind; groupTitle: keyof typeof zh; groupDesc: keyof typeof zh }> = [
  { kind: 'start', groupTitle: 'groupStart', groupDesc: 'groupStartDesc' },
  { kind: 'complete', groupTitle: 'groupComplete', groupDesc: 'groupCompleteDesc' },
  { kind: 'error', groupTitle: 'groupError', groupDesc: 'groupErrorDesc' },
  { kind: 'question', groupTitle: 'groupQuestion', groupDesc: 'groupQuestionDesc' },
  { kind: 'approval', groupTitle: 'groupApproval', groupDesc: 'groupApprovalDesc' },
]

/** 对话提醒类事件（需要用不同的语音包说明文案）。 */
const CHAT_KINDS: ReadonlySet<BeepKind> = new Set(['question', 'approval'])

function configOf(prefs: AnnouncerPrefs, kind: BeepKind): EventSoundConfig {
  switch (kind) {
    case 'start': return prefs.start
    case 'complete': return prefs.complete
    case 'error': return prefs.error
    case 'question': return prefs.question
    case 'approval': return prefs.approval
  }
}

function setConfigOf(prefs: AnnouncerPrefs, kind: BeepKind, patch: Partial<EventSoundConfig>): Partial<AnnouncerPrefs> {
  switch (kind) {
    case 'start': return { start: { ...prefs.start, ...patch } }
    case 'complete': return { complete: { ...prefs.complete, ...patch } }
    case 'error': return { error: { ...prefs.error, ...patch } }
    case 'question': return { question: { ...prefs.question, ...patch } }
    case 'approval': return { approval: { ...prefs.approval, ...patch } }
  }
}

export function SettingsCard({ t }: SettingsCardProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [previewState, setPreviewState] = useState<{ kind: BeepKind; error: string | null } | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const prefs = useSyncExternalStore(subscribePrefs, loadPrefs)
  const set = (patch: Partial<AnnouncerPrefs>): void => { updatePrefs(patch) }

  const ttsSupported = typeof speechSynthesis !== 'undefined'

  // 语音列表在部分浏览器里异步加载，需要监听 voiceschanged
  useEffect(() => {
    if (!ttsSupported) return
    const refresh = (): void => { setVoices(speechSynthesis.getVoices()) }
    refresh()
    speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => { speechSynthesis.removeEventListener('voiceschanged', refresh) }
  }, [ttsSupported])

  const handlePreview = (kind: BeepKind, config: EventSoundConfig): void => {
    try {
      playEventSoundByMode(kind, config.mode, prefs.volume, config.beepPreset, prefs.tts, config.packId)
      setPreviewState({ kind, error: null })
    } catch (error) {
      setPreviewState({ kind, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className={open ? css.card + ' ' + css.cardOpen : css.card}>
      <button type="button" className={css.header} aria-expanded={open} onClick={() => { setOpen(!open) }}>
        <span className={css.headText}>
          <span className={css.name}>{t('settingsTitle')}</span>
          <span className={css.description}>{t('settingsDesc')}</span>
        </span>
        <svg className={open ? css.chevron + ' ' + css.chevronOpen : css.chevron} viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
          <path d="M3.5 5.5 7 9l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className={css.body}>
          {/* 总开关 */}
          <label className={css.toggleRow}>
            <span className={css.toggleText}>
              <span className={css.label}>{t('masterTitle')}</span>
              <span className={css.hint}>{t('masterDesc')}</span>
            </span>
            <input type="checkbox" className={css.toggle} checked={prefs.enabled} onChange={event => { set({ enabled: event.currentTarget.checked }) }} />
          </label>

          {/* 音量 */}
          <div className={css.field}>
            <label className={css.label} htmlFor="voice-announcer-volume">{t('volumeTitle')}</label>
            <input
              id="voice-announcer-volume"
              type="range"
              min={0}
              max={100}
              value={Math.round(prefs.volume * 100)}
              onChange={event => { set({ volume: Number(event.currentTarget.value) / 100 }) }}
            />
            <p className={css.hint}>{t('volumeDesc')}</p>
          </div>

          {/* 朗读音色（TTS） */}
          {ttsSupported && (
            <fieldset className={css.group}>
              <legend className={css.groupTitle}>
                <span>{t('ttsVoiceTitle')}</span>
                <span className={css.groupDesc}>{t('ttsVoiceDesc')}</span>
              </legend>
              <div className={css.field}>
                <label className={css.label} htmlFor="voice-announcer-voice">{t('ttsVoiceLabel')}</label>
                <select
                  id="voice-announcer-voice"
                  className={css.select}
                  value={prefs.tts.voiceName}
                  onChange={event => { set({ tts: { ...prefs.tts, voiceName: event.currentTarget.value } }) }}
                >
                  <option value="">{t('ttsVoiceDefault')}</option>
                  {voices.map(voice => (
                    <option key={voice.name} value={voice.name}>{voice.name}（{voice.lang}）</option>
                  ))}
                </select>
              </div>
              <div className={css.field}>
                <label className={css.label} htmlFor="voice-announcer-rate">{t('ttsRateTitle', { rate: prefs.tts.rate.toFixed(1) })}</label>
                <input
                  id="voice-announcer-rate"
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={Math.round(prefs.tts.rate * 100)}
                  onChange={event => { set({ tts: { ...prefs.tts, rate: Number(event.currentTarget.value) / 100 } }) }}
                />
              </div>
              <div className={css.field}>
                <label className={css.label} htmlFor="voice-announcer-pitch">{t('ttsPitchTitle', { pitch: prefs.tts.pitch.toFixed(1) })}</label>
                <input
                  id="voice-announcer-pitch"
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={Math.round(prefs.tts.pitch * 100)}
                  onChange={event => { set({ tts: { ...prefs.tts, pitch: Number(event.currentTarget.value) / 100 } }) }}
                />
              </div>
            </fieldset>
          )}

          {/* 防抖 */}
          <div className={css.field}>
            <label className={css.label} htmlFor="voice-announcer-debounce">{t('debounceTitle')}</label>
            <input
              id="voice-announcer-debounce"
              type="number"
              min={0}
              step={100}
              value={prefs.debounceMs}
              onChange={event => { set({ debounceMs: Math.max(0, Number(event.currentTarget.value) || 0) }) }}
            />
            <p className={css.hint}>{t('debounceDesc')}</p>
          </div>

          {/* 免打扰时段 */}
          <div className={css.field}>
            <label className={css.toggleRow}>
              <span className={css.toggleText}>
                <span className={css.label}>{t('quietEnabled')}</span>
                <span className={css.hint}>{t('quietHoursDesc')}</span>
              </span>
              <input
                type="checkbox"
                className={css.toggle}
                checked={prefs.quietHours.enabled}
                onChange={event => { set({ quietHours: { ...prefs.quietHours, enabled: event.currentTarget.checked } }) }}
              />
            </label>
            <div className={css.timeRow}>
              <span className={css.label}>{t('quietStart')}</span>
              <input
                type="time"
                className={css.timeInput}
                value={prefs.quietHours.start}
                onChange={event => { set({ quietHours: { ...prefs.quietHours, start: event.currentTarget.value } }) }}
              />
              <span className={css.label}>{t('quietEnd')}</span>
              <input
                type="time"
                className={css.timeInput}
                value={prefs.quietHours.end}
                onChange={event => { set({ quietHours: { ...prefs.quietHours, end: event.currentTarget.value } }) }}
              />
            </div>
          </div>

          {/* 五类事件：3 个任务播报 + 2 个对话提醒 */}
          {EVENT_KINDS.map(({ kind, groupTitle, groupDesc }) => {
            const config = configOf(prefs, kind)
            return (
              <Fragment key={kind}>
                {kind === 'question' && (
                  <h3 className={css.sectionTitle}>
                    <span>{t('chatSectionTitle')}</span>
                    <span className={css.groupDesc}>{t('chatSectionDesc')}</span>
                  </h3>
                )}
                <fieldset className={css.group}>
                <legend className={css.groupTitle}>
                  <span>{t(groupTitle)}</span>
                  <span className={css.groupDesc}>{t(groupDesc)}</span>
                </legend>

                <div className={css.field}>
                  <label className={css.label} htmlFor={`voice-announcer-${kind}-mode`}>{t('modeTitle')}</label>
                  <select
                    id={`voice-announcer-${kind}-mode`}
                    className={css.select}
                    value={config.mode}
                    onChange={event => {
                      const mode = event.currentTarget.value as SoundMode
                      set(setConfigOf(prefs, kind, { mode }))
                    }}
                  >
                    <option value="off">{t('modeOff')}</option>
                    <option value="beep">{t('modeBeep')}</option>
                    <option value="pack">{t('modePack')}</option>
                    <option value="tts" disabled={!ttsSupported}>{t('modeTts')}</option>
                    <option value="custom">{t('modeCustom')}</option>
                  </select>
                  {!ttsSupported && <p className={css.hint}>{t('ttsUnsupported')}</p>}
                </div>

                {config.mode === 'pack' && (
                  <div className={css.field}>
                    <label className={css.label} htmlFor={`voice-announcer-${kind}-pack`}>{t('packIdTitle')}</label>
                    <select
                      id={`voice-announcer-${kind}-pack`}
                      className={css.select}
                      value={config.packId}
                      onChange={event => {
                        const packId = event.currentTarget.value as VoicePackId
                        set(setConfigOf(prefs, kind, { packId }))
                      }}
                    >
                      {VOICE_PACK_IDS.map(packId => (
                        <option key={packId} value={packId}>{t(PACK_LABEL_KEYS[packId])}</option>
                      ))}
                    </select>
                    <p className={css.hint}>{CHAT_KINDS.has(kind) ? t('packChatHint') : t('packHint')}</p>
                  </div>
                )}

                {config.mode === 'beep' && (
                  <div className={css.field}>
                    <label className={css.label} htmlFor={`voice-announcer-${kind}-preset`}>{t('beepPresetTitle')}</label>
                    <select
                      id={`voice-announcer-${kind}-preset`}
                      className={css.select}
                      value={config.beepPreset}
                      onChange={event => {
                        const beepPreset = event.currentTarget.value as BeepPreset
                        set(setConfigOf(prefs, kind, { beepPreset }))
                      }}
                    >
                      {BEEP_PRESETS.map(preset => (
                        <option key={preset} value={preset}>{t(PRESET_LABEL_KEYS[preset])}</option>
                      ))}
                    </select>
                    <p className={css.hint}>{t('beepPresetHint')}</p>
                  </div>
                )}

                {config.mode === 'tts' && (
                  <div className={css.field}>
                    <label className={css.label} htmlFor={`voice-announcer-${kind}-template`}>{t('templateTitle')}</label>
                    <input
                      id={`voice-announcer-${kind}-template`}
                      type="text"
                      className={css.input}
                      value={config.template}
                      placeholder={t('templateHint')}
                      onChange={event => { set(setConfigOf(prefs, kind, { template: event.currentTarget.value })) }}
                    />
                    <p className={css.hint}>{t('templateHint')}</p>
                  </div>
                )}

                {config.mode === 'custom' && (
                  <div className={css.field}>
                    <label className={css.label} htmlFor={`voice-announcer-${kind}-url`}>{t('customUrlTitle')}</label>
                    <input
                      id={`voice-announcer-${kind}-url`}
                      type="url"
                      className={css.input}
                      value={config.customUrl}
                      placeholder="https://…/sound.mp3"
                      onChange={event => { set(setConfigOf(prefs, kind, { customUrl: event.currentTarget.value })) }}
                    />
                    <p className={css.hint}>{t('customUrlHint')}</p>
                  </div>
                )}

                <div className={css.field}>
                  <button
                    type="button"
                    className={css.button}
                    disabled={config.mode === 'off'}
                    onClick={() => { handlePreview(kind, config) }}
                  >
                    {t('preview')}
                  </button>
                  {previewState?.kind === kind && previewState.error !== null && (
                    <p className={css.hint}>{t('previewFailed', { error: previewState.error })}</p>
                  )}
                </div>
                </fieldset>
              </Fragment>
            )
          })}

          {/* 隐私说明 */}
          <div className={css.field}>
            <span className={css.label}>{t('privacyTitle')}</span>
            <p className={css.hint}>{t('privacyDesc')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
