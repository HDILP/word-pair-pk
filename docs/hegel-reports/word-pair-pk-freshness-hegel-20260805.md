---
topic: "词对 PK 玩法升级：方向收敛"
problem_type: "non_deterministic"
lens: ideation
mode: standalone
date: 2026-08-05
signals:
  terminal_status: converged
  system_type: non_deterministic
  rounds: 1
  claims: 8
  confirmed: 5
  dismissed: 2
  deferred: 1
---

# 词对 PK 玩法升级 — 收敛报告（hegel 太虚二转·澄源）

输入：docs/osborn-pools/word-pair-pk-freshness-idea-pool-20260805.md（66 想法，7 维度）
模式：standalone（S3/S4/S5 由 pipeline 下游 bayes/feynman 承担）

## S1 定界

- system_type: non_deterministic（先验一致，rationale：玩法升级涉及用户偏好、学习动机、审美接受度，无唯一正确答案，但技术可行性子问题（如 Tauri TTS）是确定性的）
- 收敛目标：识别值得进入验证/实施的方向集合 + 分层优先级（第一波 / 第二波 / 远期），而非选出唯一方案
- 约束：单 HTML 三文件架构（HTML 模板 + style.css + app.js + build.py）、Vue 3 Options API、纯前端无后端、现有复习系统/排行榜 LocalStorage、TTS 用 Web Speech API

## S2 发现 — 方向断言（8 个簇）

66 个想法聚类为 8 个方向断言。每条含 4 维 rigor probe（evidence/specificity/counterfactual/attachment，各 0-0.25，durability 按 lens 禁用）：

| # | 方向断言 | 覆盖想法 | rigor | 判定 |
|---|---------|---------|-------|------|
| D1 | 即时反馈层升级：连击系统+音效+触觉+卡牌表情+3D 翻卡，解决"操作无感" | 1,2,13,14,15,16,18,19 | 0.78 | ✅ pass |
| D2 | 对抗变体：单词赛车/抢答模式/能量大招/对抗道具，把竞速从"先配完"变成"先到终点" | 4,8,9,47 | 0.63 | ✅ pass |
| D3 | 仪式感与复玩驱动：开局 3-2-1、轮次制、每日挑战、随机事件卡、胜利转盘 | 12,34,41,42,43,59,60 | 0.66 | ✅ pass |
| D4 | 学习闭环强化：弱点雷达、PK 错词入库、单词图鉴 | 30,31,32 | 0.70 | ✅ pass |
| D5 | 新知识形态：单词-例句配对、词性配对、反配对、组词模式，防熟练后无聊 | 6,53,54,57 | 0.58 | ✅ pass（边界） |
| D6 | Tauri 桌面版：原生窗口+离线安装+键盘快捷键 | 36,39,40,62,63 | 0.55 | ✅ pass（边界，风险集中） |
| D7 | 在线 PK/局域网对战：房间码、WebSocket、回放、观战 | 24,25,26,29,38 | 0.42 | ❌ 淘汰（本波） |
| D8 | 班级模式：Kahoot 式课堂竞答 + 老师生态 | 27,64,65 | 0.38 | ❌ 淘汰（本波） |

zero-hypothesis 检验（现状已够好？）：用户主动提出"无聊"（第一手信号），且现机制为单局 8 对速配、无深度维度、无复玩钩子——零假设被拒绝。方向为真问题。

## S3-S5（standalone 跳过）

bayes/feynman 作为 pipeline 独立步骤执行，本报告未内嵌。

## S6 收敛判定

- 方向簇定义在单轮内稳定（8 簇对 66 想法的映射无重叠无遗漏）
- 无新增簇、无翻转
- 结论：converged（C1-C6 满足；D5/D6 标记为边界通过，风险点下游验证）

## 收敛结论

### 确认方向（第一波，改动集中在现有三文件架构内）

1. **D1 即时反馈层**（effective_severity: major，confidence 0.62）
   - 核心：连击 Combo（数字+缩放+音高叠加）+ 配对音效 + 卡牌表情 + 3D 翻卡
   - 与现有设计系统（spring 曲线、毛玻璃、粒子背景）契合，style.css/app.js 内完成，无架构风险
   - 直接回答"无聊"：操作立刻有反馈，错误也有表情兜底（不再只是闪红）

2. **D3 仪式感与复玩驱动**（effective_severity: major，confidence 0.58）
   - 核心：开局 3-2-1 擂台仪式 + 每日挑战 + 随机事件卡
   - 成本低，与现有倒计时系统同构（Ready?→GO! 已是雏形，升级为双人 3-2-1）
   - 随机事件卡是最便宜的"每局不同"

3. **D4 学习闭环强化**（effective_severity: major，confidence 0.60）
   - 核心：弱点雷达（赛后错词分布报告）+ PK 错词自动进复习盒子（现有 wordpair_review 结构已支持）
   - 与现有复习系统天然衔接，"玩得越凶记得越牢"是产品灵魂

### 确认方向（第二波，单点挑选实施）

4. **D2 对抗变体**（effective_severity: major，confidence 0.52，epistemic）
   - 推荐单点：抢答模式（公共池双方抢同一张）——复用现有匹配逻辑，只改选牌来源
   - 单词赛车需要新布局（赛道渲染），成本中等；能量大招/道具依赖状态机，复杂度递增

5. **D5 新知识形态**（effective_severity: major，confidence 0.48，epistemic）
   - 推荐单点：单词-例句配对（复用 8 对机制，数据源加例句字段）
   - 词库数据目前无例句字段——实施需先扩词库格式（确定性约束）

### 风险点（进入 bayes 验证）

6. **D6 Tauri 桌面版**（effective_severity: major，confidence 0.45，epistemic）
   - 架构上完全可行（静态单 HTML + Tauri webview 壳 + build.py 产物），但风险集中在一个点：**WebView2 的 speechSynthesis 兼容性**——Web Speech API 在 WebView2 支持度存疑，TTS 是游戏核心反馈，不可降级为无
   - 另：Windows 安装包打包（NSIS/MSI）与更新链路（Vercel 分发）需要额外工程

### 已排除（本波）

7. **D7 在线 PK**（dismissed，confidence 0.35）：需要 WebSocket 服务器/房间管理/状态同步，单 HTML 无后端架构被破坏，成本一个数量级高于其他方向；局域网对战（38）虽无服务器，但设备发现/连接 UX 在浏览器里不成熟
8. **D8 班级模式**（dismissed，confidence 0.32）：老师生态+运营是另一条产品线，超出"玩法新鲜感"的当前诉求；meme 反馈图（65）可低配移植到失败动画

### 归真对冲（debono 黄帽预扫描）

- 被淘汰的 D7/D8 内含可抢救元素：抢答（D2 已吸收）、回放（可降级为赛后比分卡）、meme 反馈（可低配移植）——debono 阶段对 D7/D8 做价值回溯
- 零假设检验已执行：无聊感为真问题，非伪需求

## 边界漂移检查

- S1 scope 与最终分析轨迹一致，无漂移
- 唯一偏差：D6 从"用户提议的技术形态"升格为独立方向（用户原话"甚至你给它放到tauri都行"），属 scope 内（技术形态维度）

## 审计日志

- round 1: 66 想法 → 8 簇 → rigor gate → 5 确认 / 2 淘汰 / 1 风险点
- rigor gate 阈值 0.5（lens ideation 定制）；D5(0.58)/D6(0.55) 边界通过，标记下游验证
