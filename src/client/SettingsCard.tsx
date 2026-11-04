import { useState, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { loadPrefs, subscribePrefs, updatePrefs, type AnnouncerPrefs, type EventSoundConfig, type SoundMode } from './prefs.ts'
import { playEventSoundByMode, type BeepKind } from './player.ts'
import type { zh } from './locales.ts'
import css from './SettingsCard.module.css'

export type SettingsCardProps = PropsLocale<'voice.announcer'>

const EVENT_KINDS: ReadonlyArray<{ kind: BeepKind; groupTitle: keyof typeof zh; groupDesc: keyof typeof zh }> = [
  { kind: 'start', groupTitle: 'groupStart', groupDesc: 'groupStartDesc' },
  { kind: 'complete', groupTitle: 'groupComplete', groupDesc: 'groupCompleteDesc' },
  { kind: 'error', groupTitle: 'groupError', groupDesc: 'groupErrorDesc' },
]

function configOf(prefs: AnnouncerPrefs, kind: BeepKind): EventSoundConfig {
  return kind === 'start' ? prefs.start : kind === 'complete' ? prefs.complete : prefs.error
}

function setConfigOf(prefs: AnnouncerPrefs, kind: BeepKind, patch: Partial<EventSoundConfig>): Partial<AnnouncerPrefs> {
  if (kind === 'start') return { start: { ...prefs.start, ...patch } }
  if (kind === 'complete') return { complete: { ...prefs.complete, ...patch } }
  return { error: { ...prefs.error, ...patch } }
}

export function SettingsCard({ t }: SettingsCardProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [previewState, setPreviewState] = useState<{ kind: BeepKind; error: string | null } | null>(null)
  const prefs = useSyncExternalStore(subscribePrefs, loadPrefs)
  const set = (patch: Partial<AnnouncerPrefs>): void => { updatePrefs(patch) }

  const ttsSupported = typeof speechSynthesis !== 'undefined'

  const handlePreview = (kind: BeepKind, mode: SoundMode): void => {
    try {
      playEventSoundByMode(kind, mode, prefs.volume)
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

          {/* 三类事件 */}
          {EVENT_KINDS.map(({ kind, groupTitle, groupDesc }) => {
            const config = configOf(prefs, kind)
            return (
              <fieldset key={kind} className={css.group}>
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
                    <option value="tts" disabled={!ttsSupported}>{t('modeTts')}</option>
                    <option value="custom">{t('modeCustom')}</option>
                  </select>
                  {!ttsSupported && <p className={css.hint}>{t('ttsUnsupported')}</p>}
                </div>

                {config.mode === 'tts' && (
                  <div className={css.field}>
                    <label className={css.label} htmlFor={`voice-announcer-${kind}-tts`}>{t('ttsTextTitle')}</label>
                    <input
                      id={`voice-announcer-${kind}-tts`}
                      type="text"
                      className={css.input}
                      value={config.ttsText}
                      placeholder={t('ttsTextHint')}
                      onChange={event => { set(setConfigOf(prefs, kind, { ttsText: event.currentTarget.value })) }}
                    />
                    <p className={css.hint}>{t('ttsTextHint')}</p>
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
                    onClick={() => { handlePreview(kind, config.mode) }}
                  >
                    {t('preview')}
                  </button>
                  {previewState?.kind === kind && previewState.error !== null && (
                    <p className={css.hint}>{t('previewFailed', { error: previewState.error })}</p>
                  )}
                </div>
              </fieldset>
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
