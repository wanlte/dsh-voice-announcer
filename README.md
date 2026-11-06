# dsh-voice-announcer · DSH 语音播报与对话提醒

任务开始 / 完成 / 失败，以及 **AI 停下来等你**时，让 DeepSeek Harness 自动「开口说话」的语音插件。

- 🔊 **任务开始**：会话从空闲变为运行中
- ✅ **任务完成**：会话运行结束且未报错
- ⚠️ **任务失败**：会话运行报错
- 💬 **AI 等你回答**：AI 提出问题、需要你选一个或补一句
- 🔔 **AI 等你确认**：AI 要执行敏感操作、需要你授权

四种声音通道，全在浏览器本地完成：**合成音效（6 套风格）**、**内置人声语音包**、**浏览器 TTS 朗读（可选音色/语速/音调）**、**自定义语音包（URL）**。

> 纯浏览器实现：**零后端、零 API Key、不落盘**。所有偏好只存在浏览器 localStorage。

---

## 为什么做这个插件

长时间跑 Agent 任务时，眼睛离不开屏幕。这个插件把「任务状态」和「AI 在等你」变成「耳朵听得见的反馈」：
开始干活、干完、干砸了、需要你回一句话，听声音就知道——省心，还带点桌面小助手的温度。

它不只是「响一声」，而是**会说清发生了什么**：`任务「重构登录模块」已完成，用时 2 分 30 秒`。

**生态占位**：DSH 生态里 [dsh-voice-webspeech](https://github.com/anweat/dsh-voice-webspeech)
（语音输入）的 README 路线图里写着「后续：TTS 语音朗读回复」，但作者还没做——
这正是本插件切入的空位：**语音播报 + 对话提醒（TTS 朗读 + 内置人声 + 自定义语音包）**。

## 特性

| 能力 | 说明 |
| --- | --- |
| 五类事件独立配置 | 开始 / 完成 / 失败 / 等你回答 / 等你确认，各自选模式、填文案或语音 |
| 对话提醒 | AI 提问（`user-questions/request`）与请求授权（`approval/request`）时出声，不用盯屏幕 |
| 播报文案模板 | `{{title}}` 任务名、`{{duration}}` 用时、`{{error}}` 错误原因、`{{text}}` 提问内容、`{{tool}}` 待确认操作，缺失变量自动省略 |
| 免打扰时段 | 设定时间段内全部静音，深夜跑任务不被吵醒 |
| 合成音效 | 6 套风格（经典 / 叮咚 / 木琴 / 铃声 / 电子脉冲 / 金币 8-bit），Web Audio 实时合成，零文件 |
| 内置人声语音包 | 温柔女声 / 沉稳男声两套真人感片段，随插件离线分发，无需联网 |
| TTS 音色可选 | 选系统语音（如 Kuteng/Huihui/Kangkang），并可调语速、音调 |
| 自定义语音包 | 本地文件（选择器/拖拽，存 IndexedDB，离线可播）或填音频 URL；留空时回退为合成音效 |
| 总开关 + 音量 | 一键静音，音量 0~100 |
| 防抖间隔 | 同一类事件在时间窗内只播一次，避免多个子任务同时结束时连播轰炸 |
| 试听按钮 | 每类事件都能先试听再保存 |
| 隐私友好 | 所有声音本地播放，不上传任何数据，无需 API Key，不落盘 |

## 安装

要求：Node ≥ 22.19，pnpm ≥ 10，dsh 0.2.x。

> 以下命令中 `--profile` 按实际平台选择：`web`（浏览器版）或 `desktop`（桌面版）。

### 方式 A：从 GitHub 安装（推荐，发布后可用）

```sh
# Web
pnpm dsh plugin --profile web add github:wanlte/dsh-voice-announcer

# Desktop
pnpm dsh plugin --profile desktop add github:wanlte/dsh-voice-announcer
```

### 方式 B：本地开发链接

```sh
cd dsh-voice-announcer
pnpm install

# Web
pnpm dsh plugin --profile web add .

# Desktop
pnpm dsh plugin --profile desktop add .
```

### 方式 C：打包安装

```sh
pnpm run build
pnpm pack   # 产出 dsh-voice-announcer-0.4.0.tgz

# Web
pnpm dsh plugin --profile web add ./dsh-voice-announcer-0.4.0.tgz

# Desktop
pnpm dsh plugin --profile desktop add ./dsh-voice-announcer-0.4.0.tgz
```

### 卸载

```sh
# Web
pnpm dsh plugin --profile web remove dsh-voice-announcer

# Desktop
pnpm dsh plugin --profile desktop remove dsh-voice-announcer
```

卸载后重启 DSH 生效。如需清理本地构建产物：

```sh
rm -rf lib/
```

> 浏览器中的用户偏好（localStorage key: `dsh-voice-announcer.prefs`）不会随插件卸载自动清除，
> 需要手动在 DevTools → Application → Local Storage 中删除。

**激活**：重启 `dsh web` 或 `dsh desktop`。插件的 `cordis.patch.yml` 会自动把它挂进插件树，
客户端 bundle 由 `dsh.client` 声明 + `exports["./client"]` 自动加载。
不要手工把插件插进 profile 的 `cordis.patch.yml`，否则同一 loader id 会重复。

## 使用

1. 重启 `dsh web`，进入任意工作区。
2. 左下角「更多」→「设置」→「内置插件」→「语音播报」。
3. 展开卡片：
   - **启用播报**：总开关；
   - **音量**：0（静音）到 100（最大）；
   - **防抖间隔（毫秒）**：同一类事件在该时间窗内只播一次，默认 1500；
   - **免打扰时段**：启用后填开始/结束时间（支持跨零点，如 23:00–08:00）；
   - **朗读音色**：选语音、调语速和音调（仅 TTS 模式生效）；
   - **任务开始 / 任务完成 / 任务失败**：各自选播报方式、音效风格或语音包、播报文案，然后点「试听」；
   - **对话提醒**（AI 等你回答 / AI 等你确认）：同样是独立配置，默认用 TTS 念出提问内容与待确认的操作。
4. 开始一个任务，等它完成，听它说话。

### 五种播报方式

| 方式 | 说明 |
| --- | --- |
| 关闭 | 该事件不出声 |
| 合成音效 | Web Audio 实时合成，6 套风格可选：经典 / 清脆叮咚 / 木琴 / 铃声 / 电子脉冲 / 金币 8-bit |
| 内置语音包 | 随插件打包的人声片段（温柔女声 / 沉稳男声），离线播放；文案固定，不念任务名和用时 |
| 浏览器朗读（TTS） | 朗读渲染后的文案，念出任务名、用时、错误原因、提问内容；可选音色/语速/音调 |
| 自定义语音包 | 本地文件（拖拽/选择器，存 IndexedDB）或在线 URL |

> 内置语音包目前只录了「开始 / 完成 / 失败」三段人声。「等你回答」「等你确认」
> 选内置语音包时，会借用「完成」那段当提示音（设置卡片里有对应提示）。

### 播报文案模板

文案支持五个变量，缺哪个就自动省掉哪段：

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `{{title}}` | 任务名（会话标题） | `任务「重构登录模块」已完成，用时 2 分 30 秒` |
| `{{duration}}` | 从开始到结束的用时 | `用时 12 秒` / `用时 2 分 30 秒` |
| `{{error}}` | 失败原因（会话错误信息） | `任务「跑测试」失败，原因：npm test 退出码 1` |
| `{{text}}` | 提问内容（AI 问你的第一句） | `「重构登录模块」有问题等你回答：用 JWT 还是 Session？` |
| `{{tool}}` | 待确认的操作（工具名/原因） | `「重构登录模块」有操作等你确认：bash` |

默认文案：

```
开始   任务「{{title}}」开始
完成   任务「{{title}}」已完成，用时 {{duration}}
失败   任务「{{title}}」失败，原因：{{error}}
等你回答   「{{title}}」有问题等你回答：{{text}}
等你确认   「{{title}}」有操作等你确认：{{tool}}
```

> 浏览器 TTS 依赖系统语音库（Windows/macOS 自带；Linux 需安装 espeak 等）。
> 想要更接近真人的声音，可在系统里安装自然语音（如微软 Xiaoxiao/Yunxi），
> 或在 Edge 浏览器中打开 dsh web——Edge 会提供在线自然语音。
> 首次使用请先点「试听」确认当前浏览器有可用语音。

## 工作原理

```
dsh web（Host）
   │  事件转发（api-session/status、api-session/error）
   ▼
本插件 client bundle（浏览器）
   ├─ Announcer：按 sessionId 记录 running 状态、开始时间、错误原因
   │     running false→true = 开始；true→false = 完成（5 秒内刚报错则跳过，避免双重播报）
   │     user-questions/request = 等你回答；approval/request = 等你确认
   ├─ 免打扰：当前时间落在 quietHours 内则整体静音
   ├─ Template：把 {{title}} / {{duration}} / {{error}} / {{text}} / {{tool}} 渲染成最终文案
   ├─ 防抖：同一事件在 debounceMs 内只播一次
   └─ Player：beep（Web Audio）/ pack（内置 base64 MP3）/ tts（speechSynthesis）/ custom（HTMLAudioElement）
```

- Host 半（`src/index.ts`）：只导出空 `apply(ctx)`，让插件出现在宿主插件树；
- Client 半（`src/client/index.ts`）：通过 `ctx.remote.$on` 订阅事件，
  通过 `ctx.slots.inject('settings.plugins.tab', …)` 注入设置标签；
- 任务名来自 `ctx.sessions.list.getSnapshot().byId[sessionId].displayTitle`（轻量快照，不额外请求）；
- 偏好：浏览器 localStorage（key `dsh-voice-announcer.prefs`），
  `useSyncExternalStore` 做 React 订阅；
- 内置语音包：MP3 以 data URI 内联进 client bundle（`voicepacks.ts`），离线可播，不产生网络请求；
- 事件签名：`api-session/status(sessionId, running)`、`api-session/error(sessionId, message)`，
  来自官方 `@deepseek-ai/dsh-api-session-controller`。

### 对话提醒为什么必须「让位」

`user-questions/request` 与 `approval/request` 在 dsh 里是 **waterfall 事件**：
宿主按注册顺序把请求交给应答者（官方 UI 就是其中一个应答者），
应答者要么返回答案（claim），要么调用 `next()` 把请求交给下一个。

本插件是**旁听者**：播报一次，然后立刻 `next()`，绝不返回自己的答案。
否则会把提问/审批吞掉，AI 就一直卡在那儿等——这是这条路上唯一真正危险的地方，
所以代码里播报用 `try/catch` 包住，`next()` 无论如何都会被调用。

另外，事件在客户端是**按注册顺序**交给应答者的，官方 UI 一旦先认领就会一直等你点，
后面的人收不到。所以插件用 `ctx.on(..., prepend=true)` 把自己插到链首（`ctx.remote.$on`
作为备份订阅），两路都只旁听、都让位，重复触发由防抖去重。

> 已知限制：这一行为依赖 dsh 官方 UI 的让位实现。若某个 rc 版本改了认领策略
> 导致收不到事件，下一步改成在 Host 侧旁听再回传（成本更高，但不依赖前端顺序）。

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
    ├── index.ts             # Client 半入口：事件监听（含对话提醒瀑布事件）+ 设置 tab 注入
    ├── announcer.ts         # 状态机：running 跟踪 / 用时计算 / 错误原因 / 提问与审批提醒 / 免打扰 / 防抖
    ├── template.ts          # 文案模板渲染（{{title}} / {{duration}} / {{error}} / {{text}} / {{tool}}）
    ├── player.ts            # 四通道播放器（音效 / 内置语音包 / TTS / 自定义）+ 试听
    ├── voicepacks.ts        # 内置人声片段（base64 MP3 data URI）
    ├── prefs.ts             # 偏好类型 / localStorage / React 订阅
    ├── locales.ts           # zh / en 双语字典
    ├── SettingsCard.tsx     # 设置卡片（可折叠）
    └── context-types.ts     # ClientContext 类型与声明合并
```

## 为什么内置语音是离线片段，而不是在线神经语音

试过直连 Edge 免费的在线朗读接口（`wss://speech.platform.bing.com/.../edge/v1`）：
2026 年该接口对非官方客户端握手直接返回 `403`（带不带签名参数都一样），不可依赖。
继续做「真人音色念任意文案」的可行路径是接商用 TTS（Azure 语音 / 阿里云 / 腾讯云，都有免费额度），
但那需要用户自己填 API Key，所以留作可选扩展，而不是默认能力——
插件默认必须「装上就有声音、断网也能响」。

## 发布

```sh
# 1. 建 GitHub 仓库，把 package.json 的 repository.url 换成真实地址
# 2. 打 tag 触发自动发布到 npm + GitHub Release：
git tag v0.4.0 && git push origin v0.4.0
```

自动发布流水线（`.github/workflows/publish.yml`）：
`pnpm install --frozen-lockfile` → 校验版本 → `pnpm build` → `pnpm pack` → 上传 tarball →
（v* tag）发布 npm + 创建 GitHub Release。首次使用需在 GitHub Secrets 配置 `NPM_TOKEN`。

## 路线图

- [x] v0.2.0：模板文案（任务名/用时/错误原因）、免打扰时段、6 套合成音效、TTS 音色与语速、内置人声语音包
- [x] v0.3.0：对话提醒 —— AI 提问等你回答（`user-questions/request`）、AI 操作等你确认（`approval/request`）
- [x] v0.4.0：设置卡片重构为 Tab 布局（通用 / 任务事件 / 对话提醒），事件行默认折叠 + 当前配置摘要；自定义语音支持本地文件导入（文件选择器 + 拖拽），音频存 IndexedDB，同时保留 URL 方式
- [ ] 演示截图与语音 demo（本 README 顶部）
- [ ] 为「等你回答 / 等你确认」录制专属语音片段（现在借用完成音）
- [ ] 更多内置语音包风格（如活泼童声、粤语/英文口音）
- [ ] 可选：发布到 DSH Plugin Store / deepseekplugin.cn 等社区目录
- [ ] 可选：更多事件（如子任务、工具调用）
- [ ] 可选：clip 库列表，多个事件复用同一份本地音频

## License

MIT
