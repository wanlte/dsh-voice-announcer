window.__ModuleLoader__.load({
	id: "dsh-voice-announcer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/client/player.ts
		/** 播放失败时静默降级，绝不让声音问题影响 DSH 本体。 */
		function logPlayError(kind, error) {
			try {
				console.warn(`[dsh-voice-announcer] ${kind} play failed:`, error);
			} catch {}
		}
		let audioContext;
		/** 惰性创建全局 AudioContext；返回 undefined 表示浏览器不支持。 */
		function getAudioContext() {
			if (typeof window === "undefined") return void 0;
			const Ctor = window.AudioContext ?? window.webkitAudioContext;
			if (Ctor === void 0) return void 0;
			if (audioContext === void 0) try {
				audioContext = new Ctor();
			} catch (error) {
				logPlayError("AudioContext", error);
				return;
			}
			if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
			return audioContext;
		}
		/** 安装一次性手势解锁：用户第一次与页面交互时恢复 AudioContext。 */
		function installAudioUnlock() {
			const unlock = () => {
				const ctx = getAudioContext();
				if (ctx !== void 0 && ctx.state === "suspended") ctx.resume().catch(() => {});
			};
			window.addEventListener("pointerdown", unlock, { passive: true });
			window.addEventListener("keydown", unlock, { passive: true });
			return () => {
				window.removeEventListener("pointerdown", unlock);
				window.removeEventListener("keydown", unlock);
			};
		}
		/** 在 ctx 上播放一个短促正弦音。 */
		function tone(ctx, dest, freq, startAt, duration, volume) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(1e-4, startAt);
			gain.gain.exponentialRampToValueAtTime(volume, startAt + .015);
			gain.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
			osc.connect(gain);
			gain.connect(dest);
			osc.start(startAt);
			osc.stop(startAt + duration + .05);
		}
		function playBeep(kind, volume) {
			const ctx = getAudioContext();
			if (ctx === void 0) return;
			const now = ctx.currentTime;
			const dest = ctx.destination;
			switch (kind) {
				case "start":
					tone(ctx, dest, 660, now, .12, volume);
					tone(ctx, dest, 880, now + .13, .18, volume);
					break;
				case "complete":
					tone(ctx, dest, 523.25, now, .1, volume);
					tone(ctx, dest, 659.25, now + .11, .1, volume);
					tone(ctx, dest, 783.99, now + .22, .22, volume);
					break;
				case "error":
					tone(ctx, dest, 330, now, .16, volume);
					tone(ctx, dest, 220, now + .17, .32, volume);
			}
		}
		function speak(text, volume) {
			if (typeof speechSynthesis === "undefined") {
				logPlayError("tts", /* @__PURE__ */ new Error("speechSynthesis is not supported"));
				return;
			}
			speechSynthesis.cancel();
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.volume = Math.min(1, Math.max(0, volume));
			utterance.rate = 1;
			utterance.pitch = 1;
			speechSynthesis.speak(utterance);
		}
		function playCustom(url, volume) {
			if (url === "") {
				logPlayError("custom", /* @__PURE__ */ new Error("empty URL"));
				return;
			}
			const audio = new Audio(url);
			audio.volume = Math.min(1, Math.max(0, volume));
			audio.play().catch((error) => {
				logPlayError("custom", error);
			});
		}
		/**
		* 按配置播报一次。custom 模式下 URL 为空时回退到 beep。
		*/
		function playEventSound(kind, config, volume) {
			switch (config.mode) {
				case "off": return;
				case "tts":
					speak(config.ttsText !== "" ? config.ttsText : defaultTtsText(kind), volume);
					return;
				case "custom":
					if (config.customUrl !== "") {
						playCustom(config.customUrl, volume);
						return;
					}
					playBeep(kind, volume);
					return;
				case "beep":
					playBeep(kind, volume);
					return;
			}
		}
		function playEventSoundByMode(kind, mode, volume) {
			switch (mode) {
				case "off": return;
				case "tts":
					speak(defaultTtsText(kind), volume);
					return;
				case "custom":
					playBeep(kind, volume);
					return;
				case "beep":
					playBeep(kind, volume);
					return;
			}
		}
		function defaultTtsText(kind) {
			switch (kind) {
				case "start": return "任务开始";
				case "complete": return "任务已完成";
				case "error": return "任务失败，请检查";
			}
		}
		/** 卸载插件时清理：关掉声音、释放手势监听由调用方负责。 */
		function disposePlayer() {
			if (typeof speechSynthesis !== "undefined") try {
				speechSynthesis.cancel();
			} catch {}
			if (audioContext !== void 0) {
				audioContext.close().catch(() => {});
				audioContext = void 0;
			}
		}
		// src/client/announcer.ts
		/** error 播报后多久内的 status(false) 视为"同一件事"，不再重复播 complete。 */
		const ERROR_COOLDOWN_MS = 5e3;
		var Announcer = class {
			getPrefs;
			sessions = /* @__PURE__ */ new Map();
			constructor(getPrefs) {
				this.getPrefs = getPrefs;
			}
			/** 会话状态变化（来自 api-session/status）。 */
			handleStatus(sessionId, running) {
				const prefs = this.getPrefs();
				if (!prefs.enabled) return;
				const state = this.stateOf(sessionId);
				const previous = state.running;
				state.running = running;
				if (running && previous !== true) this.play(prefs, "start", sessionId);
				else if (!running && previous === true) {
					if (!(state.lastErrorAt !== void 0 && Date.now() - state.lastErrorAt < ERROR_COOLDOWN_MS)) this.play(prefs, "complete", sessionId);
				}
			}
			/** 任务失败（来自 api-session/error）。 */
			handleError(sessionId) {
				const prefs = this.getPrefs();
				if (!prefs.enabled) return;
				const state = this.stateOf(sessionId);
				state.lastErrorAt = Date.now();
				this.play(prefs, "error", sessionId);
			}
			stateOf(sessionId) {
				let state = this.sessions.get(sessionId);
				if (state === void 0) {
					state = {
						running: void 0,
						lastErrorAt: void 0,
						lastPlayedAt: {
							start: 0,
							complete: 0,
							error: 0
						}
					};
					this.sessions.set(sessionId, state);
				}
				return state;
			}
			play(prefs, kind, sessionId) {
				const state = this.stateOf(sessionId);
				const now = Date.now();
				if (now - state.lastPlayedAt[kind] < prefs.debounceMs) return;
				state.lastPlayedAt[kind] = now;
				playEventSound(kind, kind === "start" ? prefs.start : kind === "complete" ? prefs.complete : prefs.error, prefs.volume);
			}
			dispose() {
				this.sessions.clear();
			}
		};
		// src/client/prefs.ts
		const DEFAULT_PREFS = {
			enabled: true,
			volume: .7,
			debounceMs: 1500,
			start: {
				mode: "beep",
				customUrl: "",
				ttsText: "任务开始"
			},
			complete: {
				mode: "tts",
				customUrl: "",
				ttsText: "任务已完成"
			},
			error: {
				mode: "tts",
				customUrl: "",
				ttsText: "任务失败，请检查"
			}
		};
		const PREFS_KEY = "dsh-voice-announcer.prefs";
		function isSoundMode(value) {
			return value === "off" || value === "beep" || value === "tts" || value === "custom";
		}
		function mergeEventConfig(raw, fallback) {
			const input = raw ?? {};
			return {
				mode: isSoundMode(input.mode) ? input.mode : fallback.mode,
				customUrl: typeof input.customUrl === "string" ? input.customUrl : fallback.customUrl,
				ttsText: typeof input.ttsText === "string" ? input.ttsText : fallback.ttsText
			};
		}
		function mergePrefs(raw) {
			const input = raw ?? {};
			return {
				enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_PREFS.enabled,
				volume: typeof input.volume === "number" && input.volume >= 0 && input.volume <= 1 ? input.volume : DEFAULT_PREFS.volume,
				debounceMs: typeof input.debounceMs === "number" && input.debounceMs >= 0 ? input.debounceMs : DEFAULT_PREFS.debounceMs,
				start: mergeEventConfig(input.start, DEFAULT_PREFS.start),
				complete: mergeEventConfig(input.complete, DEFAULT_PREFS.complete),
				error: mergeEventConfig(input.error, DEFAULT_PREFS.error)
			};
		}
		function storage() {
			try {
				return typeof window !== "undefined" ? window.localStorage : void 0;
			} catch {
				return;
			}
		}
		let current = (() => {
			const store = storage();
			if (store !== void 0) try {
				const raw = store.getItem(PREFS_KEY);
				if (raw !== null) return mergePrefs(JSON.parse(raw));
			} catch {}
			return { ...DEFAULT_PREFS };
		})();
		function loadPrefs() {
			return current;
		}
		function updatePrefs(patch) {
			const next = mergePrefs({
				...current,
				...patch
			});
			current = next;
			const store = storage();
			if (store !== void 0) try {
				store.setItem(PREFS_KEY, JSON.stringify(next));
			} catch {}
			notifyPrefsChanged();
			return next;
		}
		const listeners = /* @__PURE__ */ new Set();
		function subscribePrefs(callback) {
			listeners.add(callback);
			return () => {
				listeners.delete(callback);
			};
		}
		function notifyPrefsChanged() {
			for (const listener of [...listeners]) listener();
		}
		// \0dsh-css:src/client/SettingsCard.module.css.mjs
		const css = ".z0VFZa_card{border:1px solid var(--divider-color,#80808040);background:0 0;border-radius:10px;margin-bottom:12px}.z0VFZa_cardOpen{border-color:var(--accent-color,#508cff80)}.z0VFZa_header{cursor:pointer;text-align:left;width:100%;color:inherit;font:inherit;background:0 0;border:none;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;display:flex}.z0VFZa_headText{flex-direction:column;gap:4px;min-width:0;display:flex}.z0VFZa_name{font-size:14px;font-weight:600}.z0VFZa_description{opacity:.65;font-size:12px}.z0VFZa_chevron{flex-shrink:0;transition:transform .15s}.z0VFZa_chevronOpen{transform:rotate(180deg)}.z0VFZa_body{flex-direction:column;gap:14px;padding:4px 16px 16px;display:flex}.z0VFZa_field{flex-direction:column;gap:6px;display:flex}.z0VFZa_label{font-size:13px;font-weight:500}.z0VFZa_hint{opacity:.6;margin:0;font-size:12px}.z0VFZa_select,.z0VFZa_input{border:1px solid var(--divider-color,#80808059);background:var(--input-bg,#80808014);color:inherit;font:inherit;border-radius:6px;padding:6px 10px;font-size:13px}.z0VFZa_input[type=range]{background:0 0;border:none;padding:0}.z0VFZa_button{border:1px solid var(--divider-color,#80808059);background:var(--input-bg,#80808014);color:inherit;font:inherit;cursor:pointer;border-radius:6px;align-self:flex-start;padding:6px 14px;font-size:13px}.z0VFZa_button:disabled{opacity:.4;cursor:not-allowed}.z0VFZa_toggleRow{justify-content:space-between;align-items:center;gap:12px;display:flex}.z0VFZa_toggleText{flex-direction:column;gap:2px;min-width:0;display:flex}.z0VFZa_toggle{width:36px;height:20px;accent-color:var(--accent-color,#4f8cff);flex-shrink:0}.z0VFZa_group{background:var(--input-bg,#8080800f);border:none;border-radius:8px;flex-direction:column;gap:12px;margin:0;padding:12px;display:flex}.z0VFZa_groupTitle{flex-direction:column;gap:2px;padding:0;font-size:13px;font-weight:600;display:flex}.z0VFZa_groupDesc{opacity:.6;font-size:12px;font-weight:400}";
		const tagId = "dsh-voice-announcer/SettingsCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-voice-announcer";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SettingsCard_module_css_default = {
			"label": "z0VFZa_label",
			"header": "z0VFZa_header",
			"name": "z0VFZa_name",
			"card": "z0VFZa_card",
			"body": "z0VFZa_body",
			"toggle": "z0VFZa_toggle",
			"groupTitle": "z0VFZa_groupTitle",
			"group": "z0VFZa_group",
			"input": "z0VFZa_input",
			"chevron": "z0VFZa_chevron",
			"chevronOpen": "z0VFZa_chevronOpen",
			"hint": "z0VFZa_hint",
			"button": "z0VFZa_button",
			"groupDesc": "z0VFZa_groupDesc",
			"cardOpen": "z0VFZa_cardOpen",
			"field": "z0VFZa_field",
			"description": "z0VFZa_description",
			"toggleRow": "z0VFZa_toggleRow",
			"toggleText": "z0VFZa_toggleText",
			"headText": "z0VFZa_headText",
			"select": "z0VFZa_select"
		};
		// src/client/SettingsCard.tsx
		const EVENT_KINDS = [
			{
				kind: "start",
				groupTitle: "groupStart",
				groupDesc: "groupStartDesc"
			},
			{
				kind: "complete",
				groupTitle: "groupComplete",
				groupDesc: "groupCompleteDesc"
			},
			{
				kind: "error",
				groupTitle: "groupError",
				groupDesc: "groupErrorDesc"
			}
		];
		function configOf(prefs, kind) {
			return kind === "start" ? prefs.start : kind === "complete" ? prefs.complete : prefs.error;
		}
		function setConfigOf(prefs, kind, patch) {
			if (kind === "start") return { start: {
				...prefs.start,
				...patch
			} };
			if (kind === "complete") return { complete: {
				...prefs.complete,
				...patch
			} };
			return { error: {
				...prefs.error,
				...patch
			} };
		}
		function SettingsCard({ t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [previewState, setPreviewState] = (0, react.useState)(null);
			const prefs = (0, react.useSyncExternalStore)(subscribePrefs, loadPrefs);
			const set = (patch) => {
				updatePrefs(patch);
			};
			const ttsSupported = typeof speechSynthesis !== "undefined";
			const handlePreview = (kind, mode) => {
				try {
					playEventSoundByMode(kind, mode, prefs.volume);
					setPreviewState({
						kind,
						error: null
					});
				} catch (error) {
					setPreviewState({
						kind,
						error: error instanceof Error ? error.message : String(error)
					});
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: open ? SettingsCard_module_css_default.card + " " + SettingsCard_module_css_default.cardOpen : SettingsCard_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: SettingsCard_module_css_default.header,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: SettingsCard_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SettingsCard_module_css_default.name,
							children: t("settingsTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SettingsCard_module_css_default.description,
							children: t("settingsDesc")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						className: open ? SettingsCard_module_css_default.chevron + " " + SettingsCard_module_css_default.chevronOpen : SettingsCard_module_css_default.chevron,
						viewBox: "0 0 14 14",
						width: "14",
						height: "14",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M3.5 5.5 7 9l3.5-3.5",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.5",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					})]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SettingsCard_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: SettingsCard_module_css_default.toggleRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SettingsCard_module_css_default.toggleText,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SettingsCard_module_css_default.label,
									children: t("masterTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SettingsCard_module_css_default.hint,
									children: t("masterDesc")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: SettingsCard_module_css_default.toggle,
								checked: prefs.enabled,
								onChange: (event) => {
									set({ enabled: event.currentTarget.checked });
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SettingsCard_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: SettingsCard_module_css_default.label,
									htmlFor: "voice-announcer-volume",
									children: t("volumeTitle")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: "voice-announcer-volume",
									type: "range",
									min: 0,
									max: 100,
									value: Math.round(prefs.volume * 100),
									onChange: (event) => {
										set({ volume: Number(event.currentTarget.value) / 100 });
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: SettingsCard_module_css_default.hint,
									children: t("volumeDesc")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SettingsCard_module_css_default.field,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: SettingsCard_module_css_default.label,
									htmlFor: "voice-announcer-debounce",
									children: t("debounceTitle")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: "voice-announcer-debounce",
									type: "number",
									min: 0,
									step: 100,
									value: prefs.debounceMs,
									onChange: (event) => {
										set({ debounceMs: Math.max(0, Number(event.currentTarget.value) || 0) });
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: SettingsCard_module_css_default.hint,
									children: t("debounceDesc")
								})
							]
						}),
						EVENT_KINDS.map(({ kind, groupTitle, groupDesc }) => {
							const config = configOf(prefs, kind);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
								className: SettingsCard_module_css_default.group,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
										className: SettingsCard_module_css_default.groupTitle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(groupTitle) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SettingsCard_module_css_default.groupDesc,
											children: t(groupDesc)
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SettingsCard_module_css_default.field,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
												className: SettingsCard_module_css_default.label,
												htmlFor: `voice-announcer-${kind}-mode`,
												children: t("modeTitle")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												id: `voice-announcer-${kind}-mode`,
												className: SettingsCard_module_css_default.select,
												value: config.mode,
												onChange: (event) => {
													const mode = event.currentTarget.value;
													set(setConfigOf(prefs, kind, { mode }));
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "off",
														children: t("modeOff")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "beep",
														children: t("modeBeep")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "tts",
														disabled: !ttsSupported,
														children: t("modeTts")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "custom",
														children: t("modeCustom")
													})
												]
											}),
											!ttsSupported && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: SettingsCard_module_css_default.hint,
												children: t("ttsUnsupported")
											})
										]
									}),
									config.mode === "tts" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SettingsCard_module_css_default.field,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
												className: SettingsCard_module_css_default.label,
												htmlFor: `voice-announcer-${kind}-tts`,
												children: t("ttsTextTitle")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												id: `voice-announcer-${kind}-tts`,
												type: "text",
												className: SettingsCard_module_css_default.input,
												value: config.ttsText,
												placeholder: t("ttsTextHint"),
												onChange: (event) => {
													set(setConfigOf(prefs, kind, { ttsText: event.currentTarget.value }));
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: SettingsCard_module_css_default.hint,
												children: t("ttsTextHint")
											})
										]
									}),
									config.mode === "custom" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SettingsCard_module_css_default.field,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
												className: SettingsCard_module_css_default.label,
												htmlFor: `voice-announcer-${kind}-url`,
												children: t("customUrlTitle")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												id: `voice-announcer-${kind}-url`,
												type: "url",
												className: SettingsCard_module_css_default.input,
												value: config.customUrl,
												placeholder: "https://…/sound.mp3",
												onChange: (event) => {
													set(setConfigOf(prefs, kind, { customUrl: event.currentTarget.value }));
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: SettingsCard_module_css_default.hint,
												children: t("customUrlHint")
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SettingsCard_module_css_default.field,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: SettingsCard_module_css_default.button,
											disabled: config.mode === "off",
											onClick: () => {
												handlePreview(kind, config.mode);
											},
											children: t("preview")
										}), previewState?.kind === kind && previewState.error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: SettingsCard_module_css_default.hint,
											children: t("previewFailed", { error: previewState.error })
										})]
									})
								]
							}, kind);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SettingsCard_module_css_default.field,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SettingsCard_module_css_default.label,
								children: t("privacyTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SettingsCard_module_css_default.hint,
								children: t("privacyDesc")
							})]
						})
					]
				})]
			});
		}
		// src/client/locales.ts
		/** dsh-voice-announcer — locale dictionaries (zh / en). */
		const zh = {
			settingsTitle: "语音播报",
			settingsDesc: "任务开始 / 完成 / 失败时自动出声，支持合成音效、浏览器朗读与自定义语音包",
			masterTitle: "启用播报",
			masterDesc: "关闭后所有事件都不再出声",
			volumeTitle: "音量",
			volumeDesc: "0（静音）到 100（最大）",
			debounceTitle: "防抖间隔（毫秒）",
			debounceDesc: "同一类事件在该时间窗内只播一次，避免多个子任务同时结束时连播轰炸",
			groupStart: "任务开始",
			groupStartDesc: "会话从空闲变为运行中时",
			groupComplete: "任务完成",
			groupCompleteDesc: "会话运行结束且未报错时",
			groupError: "任务失败",
			groupErrorDesc: "会话运行报错时",
			modeTitle: "播报方式",
			modeOff: "关闭",
			modeBeep: "合成音效",
			modeTts: "浏览器朗读（TTS）",
			modeCustom: "自定义语音包",
			ttsTextTitle: "朗读文本",
			ttsTextHint: "留空使用默认文案",
			customUrlTitle: "音频 URL",
			customUrlHint: "支持 http(s) 或 data: 音频链接；留空回退为合成音效",
			previewTitle: "试听",
			preview: "试听",
			previewFailed: "试听失败：{error}",
			ttsUnsupported: "当前浏览器不支持语音朗读（speechSynthesis）",
			beepUnsupported: "当前浏览器不支持 Web Audio 合成音效",
			privacyTitle: "隐私说明",
			privacyDesc: "所有声音都在浏览器本地播放，不上传任何数据，无需 API Key，不落盘。",
			failure: "播报失败：{code}"
		};
		const en = {
			settingsTitle: "Voice Announcer",
			settingsDesc: "Speak up when tasks start, complete, or fail — beep, browser TTS, or your own voice pack",
			masterTitle: "Enable announcer",
			masterDesc: "When off, no event makes a sound",
			volumeTitle: "Volume",
			volumeDesc: "0 (mute) to 100 (max)",
			debounceTitle: "Debounce (ms)",
			debounceDesc: "Only one announcement per event within this window, so parallel subtask endings do not spam",
			groupStart: "Task started",
			groupStartDesc: "When a session goes from idle to running",
			groupComplete: "Task completed",
			groupCompleteDesc: "When a session finishes without an error",
			groupError: "Task failed",
			groupErrorDesc: "When a session reports an error",
			modeTitle: "Sound mode",
			modeOff: "Off",
			modeBeep: "Synthesized beep",
			modeTts: "Browser TTS",
			modeCustom: "Custom voice pack",
			ttsTextTitle: "Spoken text",
			ttsTextHint: "Leave empty for the default phrase",
			customUrlTitle: "Audio URL",
			customUrlHint: "http(s) or data: audio link; empty falls back to beep",
			previewTitle: "Preview",
			preview: "Preview",
			previewFailed: "Preview failed: {error}",
			ttsUnsupported: "speechSynthesis is not supported in this browser",
			beepUnsupported: "Web Audio is not supported in this browser",
			privacyTitle: "Privacy",
			privacyDesc: "Every sound plays locally in your browser — no uploads, no API key, nothing stored.",
			failure: "Announcement failed: {code}"
		};
		// src/client/index.ts
		const name = "dsh-voice-announcer-client";
		const inject = [
			"remote",
			"slots",
			"locale"
		];
		const LOCALE_NS = "voice.announcer";
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(LOCALE_NS, {
				zh,
				en
			}), "dsh-voice-announcer: dictionaries");
			const t = ctx.locale.bind(LOCALE_NS);
			ctx.effect(() => {
				const announcer = new Announcer(loadPrefs);
				const offStatus = ctx.remote.$on("api-session/status", (sessionId, running) => {
					announcer.handleStatus(sessionId, running);
				});
				const offError = ctx.remote.$on("api-session/error", (sessionId) => {
					announcer.handleError(sessionId);
				});
				const unlock = installAudioUnlock();
				return () => {
					offStatus();
					offError();
					unlock();
					announcer.dispose();
				};
			}, "dsh-voice-announcer: event listeners");
			ctx.effect(() => {
				return ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
					name: "settings.plugins.tab",
					id: "voice-announcer",
					order: 20,
					label: () => t("settingsTitle"),
					locale: LOCALE_NS,
					inject: () => ({})
				}, SettingsCard));
			}, "dsh-voice-announcer: settings tab");
			ctx.effect(() => {
				return () => {
					disposePlayer();
				};
			}, "dsh-voice-announcer: player dispose");
		}
		/** 供 SettingsCard 试听按钮使用：按当前选择的方式直接播一次。 */
		function previewSound(kind, mode) {
			playEventSoundByMode(kind, mode, loadPrefs().volume);
		}
		exports.LOCALE_NS = LOCALE_NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		exports.previewSound = previewSound;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map