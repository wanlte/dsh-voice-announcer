import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
import { deleteClip, isAcceptableAudio, saveClip } from './audio-store.ts'
import type { zh } from './locales.ts'
import css from './SettingsCard.module.css'

export type SettingsCardProps = PropsLocale<'voice.announcer'>

type LocaleKey = keyof typeof zh
type TabKey = 'general' | 'task' | 'chat'

const PRESET_LABEL_KEYS: Record<BeepPreset, LocaleKey> = {
  classic: 'presetClassic',
  chime: 'presetChime',
  marimba: 'presetMarimba',
  bell: 'presetBell',
  pulse: 'presetPulse',
  coin: 'presetCoin',
}

const PACK_LABEL_KEYS: Record<VoicePackId, LocaleKey> = {
  'soft-female': 'packSoftFemale',
  'deep-male': 'packDeepMale',
}

interface EventMeta {
  kind: BeepKind
  groupTitle: LocaleKey
  groupDesc: LocaleKey
}

const TASK_EVENTS: readonly EventMeta[] = [
  { kind: 'start', groupTitle: 'groupStart', groupDesc: 'groupStartDesc' },
  { kind: 'complete', groupTitle: 'groupComplete', groupDesc: 'groupCompleteDesc' },
  { kind: 'error', groupTitle: 'groupError', groupDesc: 'groupErrorDesc' },
]

const CHAT_EVENTS: readonly EventMeta[] = [
  { kind: 'question', groupTitle: 'groupQuestion', groupDesc: 'groupQuestionDesc' },
  { kind: 'approval', groupTitle: 'groupApproval', groupDesc: 'groupApprovalDesc' },
]

/** 对话提醒类事件（语音包说明文案不同）。 */
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

/** 人类可读的字节大小（1.2 MB / 340 KB）。 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 事件当前配置的简短描述（折叠 header 展示）。 */
function summarize(kind: BeepKind, config: EventSoundConfig, t: SettingsCardProps['t']): string {
  switch (config.mode) {
    case 'off':
      return t('summaryOff')
    case 'beep':
      return t('summaryBeep', { preset: t(PRESET_LABEL_KEYS[config.beepPreset]) })
    case 'pack':
      return t('summaryPack', { pack: t(PACK_LABEL_KEYS[config.packId]) })
    case 'tts':
      return t('summaryTts')
    case 'custom':
      if (config.customAudioId !== '') {
        return t('summaryCustomFile', { name: config.customAudioName || kind })
      }
      if (config.customUrl !== '') return t('summaryCustomUrl')
      return t('summaryCustomBeep')
  }
}

/* ------------------------------------------------------------------ *
 * 自定义音频导入组件：文件选择器 + 拖拽 + URL
 * ------------------------------------------------------------------ */

interface CustomAudioImportProps {
  kind: BeepKind
  config: EventSoundConfig
  ttsSupported: boolean
  onChange: (patch: Partial<EventSoundConfig>) => void
  t: SettingsCardProps['t']
}

function CustomAudioImport({ kind, config, onChange, t }: CustomAudioImportProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasFile = config.customAudioId !== ''
  // URL / File 二选一：任一存在即视为当前 source；两者都无时默认展示 file 面板
  const source: 'file' | 'url' = hasFile ? 'file' : (config.customUrl !== '' ? 'url' : 'file')

  const setSource = (next: 'file' | 'url'): void => {
    if (next === source) return
    if (next === 'url') {
      // 切到 URL 时保留已有 URL（若有）；清空 file 侧字段
      onChange({ customAudioId: '', customAudioName: '' })
    } else {
      onChange({ customUrl: '' })
    }
  }

  const handleFile = async (file: File): Promise<void> => {
    setError(null)
    if (!isAcceptableAudio(file)) {
      setError(t('customUnsupportedType'))
      return
    }
    setBusy(true)
    try {
      // 换文件时旧文件从 IDB 中删除，避免累积
      if (config.customAudioId !== '') {
        try { await deleteClip(config.customAudioId) } catch { /* 忽略 */ }
      }
      const id = await saveClip(file)
      onChange({ customAudioId: id, customAudioName: file.name, customUrl: '' })
    } catch (err) {
      setError(t('customSaveFailed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (): Promise<void> => {
    if (config.customAudioId !== '') {
      try { await deleteClip(config.customAudioId) } catch { /* 忽略 */ }
    }
    onChange({ customAudioId: '', customAudioName: '' })
  }

  return (
    <div className={css.field}>
      <span className={css.label}>{t('modeCustom')}</span>
      <p className={css.hint}>{t('customIntro')}</p>

      <div className={css.sourceTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={source === 'file'}
          className={source === 'file' ? css.sourceTab + ' ' + css.sourceTabActive : css.sourceTab}
          onClick={() => { setSource('file') }}
        >
          {t('customSourceFile')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === 'url'}
          className={source === 'url' ? css.sourceTab + ' ' + css.sourceTabActive : css.sourceTab}
          onClick={() => { setSource('url') }}
        >
          {t('customSourceUrl')}
        </button>
      </div>

      {source === 'file' && (
        <>
          <div
            className={dragOver ? css.dropZone + ' ' + css.dropZoneActive : css.dropZone}
            onDragOver={event => {
              event.preventDefault()
              if (!dragOver) setDragOver(true)
            }}
            onDragLeave={event => {
              event.preventDefault()
              setDragOver(false)
            }}
            onDrop={event => {
              event.preventDefault()
              setDragOver(false)
              const file = event.dataTransfer.files?.[0]
              if (file !== undefined) void handleFile(file)
            }}
            onClick={() => { fileInputRef.current?.click() }}
            role="button"
            tabIndex={0}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <span className={css.dropText}>
              {busy ? '…' : (dragOver ? t('customDropping') : t('customDropHint'))}
            </span>
            <button
              type="button"
              className={css.dropButton}
              onClick={event => {
                event.stopPropagation()
                fileInputRef.current?.click()
              }}
              disabled={busy}
            >
              {t('customPickFile')}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus"
            style={{ display: 'none' }}
            onChange={event => {
              const file = event.currentTarget.files?.[0]
              if (file !== undefined) void handleFile(file)
              event.currentTarget.value = ''
            }}
          />
          {hasFile ? (
            <div className={css.currentFileRow}>
              <span className={css.currentFileText}>
                {t('customCurrentFile', {
                  name: config.customAudioName,
                  size: formatBytes(0),
                })}
              </span>
              <button type="button" className={css.linkButton} onClick={() => { void handleRemove() }}>
                {t('customRemoveFile')}
              </button>
            </div>
          ) : (
            <p className={css.hint}>{t('customNoFile')}</p>
          )}
        </>
      )}

      {source === 'url' && (
        <div className={css.field}>
          <label className={css.label} htmlFor={`voice-announcer-${kind}-url`}>{t('customUrlTitle')}</label>
          <input
            id={`voice-announcer-${kind}-url`}
            type="url"
            className={css.input}
            value={config.customUrl}
            placeholder="https://…/sound.mp3"
            onChange={event => { onChange({ customUrl: event.currentTarget.value }) }}
          />
          <p className={css.hint}>{t('customUrlHint')}</p>
        </div>
      )}

      {error !== null && <p className={css.hint}>{error}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 顶部常驻快捷导入条：不需要先选“自定义”模式，拖入/选文件会
 * 自动切到 custom 模式并存入 IndexedDB。
 * ------------------------------------------------------------------ */

interface QuickAddBarProps {
  config: EventSoundConfig
  onChange: (patch: Partial<EventSoundConfig>) => void
  t: SettingsCardProps['t']
}

function QuickAddBar({ config, onChange, t }: QuickAddBarProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasFile = config.customAudioId !== ''

  const importFile = async (file: File): Promise<void> => {
    setError(null)
    if (!isAcceptableAudio(file)) {
      setError(t('customUnsupportedType'))
      return
    }
    setBusy(true)
    try {
      if (config.customAudioId !== '') {
        try { await deleteClip(config.customAudioId) } catch { /* 忽略 */ }
      }
      const id = await saveClip(file)
      // 一键完成：写入文件引用 + 自动切到 custom 模式 + 清理 URL
      onChange({ customAudioId: id, customAudioName: file.name, customUrl: '', mode: 'custom' })
    } catch (err) {
      setError(t('customSaveFailed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={dragOver ? css.quickAdd + ' ' + css.quickAddActive : css.quickAdd}
      onDragOver={event => { event.preventDefault(); if (!dragOver) setDragOver(true) }}
      onDragLeave={event => { event.preventDefault(); setDragOver(false) }}
      onDrop={event => {
        event.preventDefault()
        setDragOver(false)
        const file = event.dataTransfer.files?.[0]
        if (file !== undefined) void importFile(file)
      }}
    >
      <span className={css.quickAddText}>
        {busy ? '…' : (dragOver ? t('customDropping') : t('quickAddHint'))}
      </span>
      <button
        type="button"
        className={css.dropButton}
        disabled={busy}
        onClick={() => { inputRef.current?.click() }}
      >
        {hasFile ? t('quickAddReplace') : t('quickAddButton')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.oga,.m4a,.aac,.flac,.webm,.opus"
        style={{ display: 'none' }}
        onChange={event => {
          const file = event.currentTarget.files?.[0]
          if (file !== undefined) void importFile(file)
          event.currentTarget.value = ''
        }}
      />
      {error !== null && <p className={css.hint}>{error}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 单个事件的展开面板
 * ------------------------------------------------------------------ */

interface EventPanelProps {
  kind: BeepKind
  config: EventSoundConfig
  ttsSupported: boolean
  volume: number
  beepPresetHintShown: boolean
  onChange: (patch: Partial<EventSoundConfig>) => void
  onPreview: () => void
  previewError: string | null
  t: SettingsCardProps['t']
}

function EventPanel({
  kind,
  config,
  ttsSupported,
  onChange,
  onPreview,
  previewError,
  t,
}: EventPanelProps): JSX.Element {
  return (
    <>
      <QuickAddBar config={config} onChange={onChange} t={t} />

      <div className={css.field}>
        <label className={css.label} htmlFor={`voice-announcer-${kind}-mode`}>{t('modeTitle')}</label>
        <select
          id={`voice-announcer-${kind}-mode`}
          className={css.select}
          value={config.mode}
          onChange={event => { onChange({ mode: event.currentTarget.value as SoundMode }) }}
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
            onChange={event => { onChange({ packId: event.currentTarget.value as VoicePackId }) }}
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
            onChange={event => { onChange({ beepPreset: event.currentTarget.value as BeepPreset }) }}
          >
            {BEEP_PRESETS.map(preset => (
              <option key={preset} value={preset}>{t(PRESET_LABEL_KEYS[preset])}</option>
            ))}
          </select>
          <p className={css.hint}>{t('beepPresetHint')}</p>
        </div>
      )}

      {(config.mode === 'tts') && (
        <div className={css.field}>
          <label className={css.label} htmlFor={`voice-announcer-${kind}-template`}>{t('templateTitle')}</label>
          <input
            id={`voice-announcer-${kind}-template`}
            type="text"
            className={css.input}
            value={config.template}
            placeholder={t('templateHint')}
            onChange={event => { onChange({ template: event.currentTarget.value }) }}
          />
          <p className={css.hint}>{t('templateHint')}</p>
        </div>
      )}

      {config.mode === 'custom' && (
        <CustomAudioImport kind={kind} config={config} ttsSupported={ttsSupported} onChange={onChange} t={t} />
      )}

      <div className={css.field}>
        <button
          type="button"
          className={css.button}
          disabled={config.mode === 'off'}
          onClick={onPreview}
        >
          {t('preview')}
        </button>
        {previewError !== null && (
          <p className={css.hint}>{t('previewFailed', { error: previewError })}</p>
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * 主组件
 * ------------------------------------------------------------------ */

export function SettingsCard({ t }: SettingsCardProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [expanded, setExpanded] = useState<Record<BeepKind, boolean>>({
    start: false, complete: false, error: false, question: false, approval: false,
  })
  const [previewError, setPreviewError] = useState<Record<BeepKind, string | null>>({
    start: null, complete: null, error: null, question: null, approval: null,
  })
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
      playEventSoundByMode(
        kind,
        config.mode,
        prefs.volume,
        config.beepPreset,
        prefs.tts,
        config.packId,
        config,
      )
      setPreviewError(prev => ({ ...prev, [kind]: null }))
    } catch (error) {
      setPreviewError(prev => ({ ...prev, [kind]: error instanceof Error ? error.message : String(error) }))
    }
  }

  const toggleExpanded = (kind: BeepKind): void => {
    setExpanded(prev => ({ ...prev, [kind]: !prev[kind] }))
  }

  const renderEventList = (events: readonly EventMeta[]): JSX.Element => (
    <div className={css.tabPanel}>
      {events.map(({ kind, groupTitle, groupDesc }) => {
        const config = configOf(prefs, kind)
        const isOpen = expanded[kind]
        return (
          <div key={kind} className={css.eventRow}>
            <button
              type="button"
              className={css.eventHeader}
              aria-expanded={isOpen}
              onClick={() => { toggleExpanded(kind) }}
            >
              <span className={css.eventHeadText}>
                <span className={css.eventName}>{t(groupTitle)}</span>
                <span className={css.eventSummary}>{t('eventCurrently', { summary: summarize(kind, config, t) })}</span>
              </span>
              <svg
                className={isOpen ? css.chevron + ' ' + css.chevronOpen : css.chevron}
                viewBox="0 0 14 14"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path d="M3.5 5.5 7 9l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isOpen && (
              <div className={css.eventBody}>
                <p className={css.hint}>{t(groupDesc)}</p>
                <EventPanel
                  kind={kind}
                  config={config}
                  ttsSupported={ttsSupported}
                  volume={prefs.volume}
                  beepPresetHintShown={true}
                  onChange={patch => { set(setConfigOf(prefs, kind, patch)) }}
                  onPreview={() => { handlePreview(kind, config) }}
                  previewError={previewError[kind]}
                  t={t}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

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
          <div className={css.tabBar} role="tablist">
            <TabButton id="general" active={activeTab} onSelect={setActiveTab} label={t('tabGeneral')} />
            <TabButton id="task" active={activeTab} onSelect={setActiveTab} label={t('tabTask')} />
            <TabButton id="chat" active={activeTab} onSelect={setActiveTab} label={t('tabChat')} />
          </div>

          {activeTab === 'general' && (
            <div className={css.tabPanel}>
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

              {/* TTS 音色 */}
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

              {/* 隐私说明 */}
              <div className={css.field}>
                <span className={css.label}>{t('privacyTitle')}</span>
                <p className={css.hint}>{t('privacyDesc')}</p>
              </div>
            </div>
          )}

          {activeTab === 'task' && renderEventList(TASK_EVENTS)}
          {activeTab === 'chat' && renderEventList(CHAT_EVENTS)}
        </div>
      )}
    </div>
  )
}

interface TabButtonProps {
  id: TabKey
  active: TabKey
  onSelect: (id: TabKey) => void
  label: string
}

function TabButton({ id, active, onSelect, label }: TabButtonProps): JSX.Element {
  const isActive = active === id
  return (
    <Fragment>
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        className={isActive ? css.tab + ' ' + css.tabActive : css.tab}
        onClick={() => { onSelect(id) }}
      >
        {label}
      </button>
    </Fragment>
  )
}
