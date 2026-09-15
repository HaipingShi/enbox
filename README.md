# EnBox

**自动识别语言、中英双向翻译的桌面悬浮翻译盒。**

为「想直接用英语和 AI 对话 / vibe coding，顺便学英语」的场景设计：上框输入中文，下框给你**可以直接发给 AI 助手的地道英文**；输入英文或其他语言，则自动译成简体中文。按 Enter 或点击「翻译」发送，译文自动复制。中文译英文时可附少量中文学习笔记。窗口常驻悬浮、贴边折叠、全局热键随时呼出。

> macOS / Windows 双平台，Electron 实现，一份代码两个系统。

## 功能

- **双框工作流**：Enter 直发、流式输出、译文可编辑微调、完成后自动复制英文部分
- **LLM 可配置**：任意 OpenAI 兼容接口（API 地址 / Key / 模型 / System Prompt / 温度）
- **自动翻译方向**：应用先判断文字类型，再明确指定翻译目标：中文 → 英文，其他语言 → 简体中文。包含假名或韩文时译成中文；其余包含汉字的输入按中文处理，因此纯汉字日文或复杂混合语言可能被误判。中文夹杂英文技术词无需手动切换
- **英语教练提示词**：中文译英文时可附 1–3 条 💡 中文学习笔记；译成中文时默认只输出译文。「复制译文」不会带上笔记。可自定义风格，自动翻译方向优先于冲突的自定义指令；旧版默认提示词会自动升级
- **悬浮窗**：置顶且跨全部桌面空间（含全屏应用之上）、标题栏 `–` 折叠成小球、拖到屏幕左/右边缘自动吸附成小条、点击还原、位置记忆
- **外观与行为**：字体大小（12–20px，`⌘+`/`⌘-`/`⌘0` 快速调节）、窗口不透明度、开机自启动、置顶状态记忆
- **本地优先**：所有配置保存在本机 `config.json`，不经过任何第三方

## 安装

### macOS（Apple Silicon）

从 [Releases](https://github.com/HaipingShi/enbox/releases) 下载 `EnBox-macOS-arm64.zip`，解压后把 `EnBox.app` 拖入「应用程序」。

应用未经公证，首次打开若提示「已损坏，无法打开」，在终端执行：

```bash
xattr -cr /Applications/EnBox.app
```

### Windows（x64）

下载 `EnBox-windows-x64.zip`，解压后双击 `EnBox.exe`，免安装。首次运行 SmartScreen 拦截时点「更多信息 → 仍要运行」。

### 从源码构建

```bash
git clone https://github.com/HaipingShi/enbox && cd enbox
npm install
npm start              # 开发运行
npm run package        # macOS arm64 → dist/EnBox-darwin-arm64
npm run package:win    # Windows x64 → dist/EnBox-win32-x64（建议在 Windows 上执行）
```

## 配置

点窗口内 **⚙** 图标，填入任意 OpenAI 兼容服务：

| 字段 | 说明 |
|---|---|
| API 地址 | 例如 `https://api.openai.com/v1`、`https://open.bigmodel.cn/api/paas/v4` |
| API Key | 对应服务商的密钥 |
| 模型 | 如 `gpt-4o-mini`、`glm-4-flash` |
| System Prompt | 决定输出行为，默认即「英语教练」，可改成任何风格 |

**免费方案**（国内直连，无需绑卡）：

| 服务商 | API 地址 | 模型示例 | 免费额度 |
|---|---|---|---|
| 智谱 BigModel | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` | 模型完全免费 |
| 魔搭 ModelScope | `https://api-inference.modelscope.cn/v1` | `Qwen/Qwen2.5-72B-Instruct` | 2000 次/天（单模型 500 次/天） |
| GitHub Models | `https://models.github.ai/inference` | `openai/gpt-4o-mini` | 约 150 次/天，需 PAT（`models:read`） |

## 快捷键与操作

| 操作 | 方式 |
|---|---|
| 呼出 / 隐藏窗口 | `⌃⌘E`（macOS）/ `Ctrl+Alt+E`（Windows） |
| 发送翻译 | `Enter`（`Shift+Enter` 换行） |
| 折叠成小球 | 标题栏 `–`；点小球还原，右键小球退出 |
| 贴边吸附 | 把窗口拖到屏幕左/右边缘；点小条还原 |
| 调整字体 | `⌘+` / `⌘-` / `⌘0` |

## License

[MIT](LICENSE)
