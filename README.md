# dsh-voice-announcer · DSH 状态语音播报

任务开始 / 完成 / 失败时，让 DeepSeek Harness 自动「开口说话」的语音包插件。

- 🔊 **任务开始**：会话从空闲变为运行中
- ✅ **任务完成**：会话运行结束且未报错
- ⚠️ **任务失败**：会话运行报错

三种声音通道，全在浏览器本地完成：**合成音效（beep）**、**浏览器 TTS 朗读**、**自定义语音包（URL）**。

> 纯浏览器实现：**零后端、零 API Key、不落盘**。所有偏好只存在浏览器 localStorage。

---

## 为什么做这个插件

长时间跑 Agent 任务时，眼睛离不开屏幕。这个插件把「任务状态」变成「耳朵听得见的反馈」：
开始干活、干完、干砸了，听声音就知道——省心，还带点桌面小助手的温度。

**生态占位**：DSH 生态里 [dsh-voice-webspeech](https://github.com/anweat/dsh-voice-webspeech)
（语音输入）的 README 路线图里写着「后续：TTS 语音朗读回复」，但作者还没做——
这正是本插件切入的空位：**任务状态播报（TTS 朗读 + 自定义语音包）**。

## 特性

| 能力 | 说明 |
| --- | --- |
| 三类事件独立配置 | 开始 / 完成 / 失败可分别选模式、填 TTS 文本或语音 URL |
| 合成音效 | Web Audio API 正弦音，无需任何外部资源 |
| 浏览器 TTS | `speechSynthesis` 朗读，支持中英文，可自定义文案 |
| 自定义语音包 | 填一个音频 URL（mp3/wav/ogg 等），用你自己的声音 |
| 总开关 + 音量 | 一键静音，音量 0~100 |
| 防抖间隔 | 同一类事件在时间窗内只播一次，避免多个子任务同时结束时连播轰炸 |
| 试听按钮 | 每类事件都能先试听再保存 |
| 隐私友好 | 所有声音本地播放，不上传任何数据，无需 API Key，不落盘 |

## 安装

要求：Node ≥ 22.19，pnpm ≥ 10，dsh 0.2.x。

### 方式 A：从 GitHub 安装（推荐，发布后可用）

```sh
pnpm dsh plugin --profile web add github:你的用户名/dsh-voice-announcer
```

### 方式 B：本地开发链接

```sh
cd dsh-voice-announcer
pnpm install
pnpm dsh plugin --profile web add .
```

### 方式 C：打包安装

```sh
pnpm run build
pnpm pack   # 产出 dsh-voice-announcer-0.1.0.tgz
pnpm dsh plugin --profile web add ./dsh-voice-announcer-0.1.0.tgz
```

**激活**：重启 `dsh web`。插件的 `cordis.patch.yml` 会自动把它挂进插件树，
客户端 bundle 由 `dsh.client` 声明 + `exports["./client"]` 自动加载。
不要手工把插件插进 profile 的 `cordis.patch.yml`，否则同一 loader id 会重复。

## 使用

1. 重启 `dsh web`，进入任意工作区。
2. 左下角「更多」→「设置」→「内置插件」→「语音播报」。
3. 展开卡片：
   - **启用播报**：总开关；
   - **音量**：0（静音）到 100（最大）；
   - **防抖间隔（毫秒）**：同一类事件在该时间窗内只播一次，默认 1500；
   - **任务开始 / 任务完成 / 任务失败**：各自选择播报方式并试听。
4. 开始一个任务，等它完成，听它说话。

### 三种播报方式

| 方式 | 说明 |
| --- | --- |
| 关闭 | 该事件不出声 |
| 合成音效 | 一段清脆的提示音，无需外部资源 |
| 浏览器朗读（TTS） | 朗读你填的文本；留空使用默认文案（如「任务已完成」「任务失败，请检查」） |
| 自定义语音包 | 填音频 URL（https://…/sound.mp3）；留空时回退为合成音效 |

> 浏览器 TTS 依赖系统语音库（Windows/macOS 自带；Linux 需安装 espeak 等）。
> 首次使用请先点「试听」确认当前浏览器有可用语音。

## 工作原理

```
dsh web（Host）
   │  事件转发（api-session/status、api-session/error）
   ▼
本插件 client bundle（浏览器）
   ├─ Announcer：按 sessionId 记录 running 状态 + 错误时间戳
   │     running false→true = 开始；true→false = 完成（5 秒内刚报错则跳过，避免双重播报）
   ├─ 防抖：同一事件在 debounceMs 内只播一次
   └─ Player：beep（Web Audio）/ tts（speechSynthesis）/ custom（HTMLAudioElement）
```

- Host 半（`src/index.ts`）：只导出空 `apply(ctx)`，让插件出现在宿主插件树；
- Client 半（`src/client/index.ts`）：通过 `ctx.remote.$on` 订阅会话状态事件，
  通过 `ctx.slots.inject('settings.plugins.tab', …)` 注入设置标签；
- 偏好：浏览器 localStorage（key `dsh-voice-announcer.prefs`），
  `useSyncExternalStore` 做 React 订阅；
- 事件签名：`api-session/status(sessionId, running)`、`api-session/error(sessionId, message)`，
  来自官方 `@deepseek-ai/dsh-api-session-controller`。

## 开发

```sh
pnpm install        # 安装依赖（含 prepare 构建）
pnpm run build      # tsc（host 半 + 类型声明）+ tsdown（client bundle）
pnpm test:client-bundle   # 校验 client bundle 的模块表导入白名单
```

目录结构：

```
src/
├── index.ts                 # Host 半：空 apply，让插件进插件树
└── client/
    ├── index.ts             # Client 半入口：事件监听 + 设置 tab 注入
    ├── announcer.ts         # 状态机：running 跟踪 / 错误冷却 / 防抖
    ├── player.ts            # 三通道播放器 + 试听
    ├── prefs.ts             # 偏好类型 / localStorage / React 订阅
    ├── locales.ts           # zh / en 双语字典
    ├── SettingsCard.tsx     # 设置卡片（可折叠）
    └── context-types.ts     # ClientContext 类型与声明合并
```

## 发布

```sh
# 1. 建 GitHub 仓库，把 package.json 的 repository.url 换成真实地址
# 2. 打 tag 触发自动发布到 npm + GitHub Release：
git tag v0.1.0 && git push origin v0.1.0
```

自动发布流水线（`.github/workflows/publish.yml`）：
`pnpm install --frozen-lockfile` → 校验版本 → `pnpm build` → `pnpm pack` → 上传 tarball →
（v* tag）发布 npm + 创建 GitHub Release。首次使用需在 GitHub Secrets 配置 `NPM_TOKEN`。

## 路线图

- [ ] 演示截图与语音 demo（本 README 顶部）
- [ ] 可选：发布到 DSH Plugin Store / deepseekplugin.cn 等社区目录
- [ ] 可选：更多事件（如子任务、工具调用）与更丰富的语音包模板

## License

MIT
