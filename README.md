# 男娘潜质综合评估量表

一个零构建、零框架的单页娱乐测评站。随机抽 50 道题，输出四维雷达图 + 0–250 总分 + 段位判定，并和全网样本均值做对比。

> ⚠️ **纯娱乐项目，不是心理学量表。** 结果没有任何医学或临床意义，别当真。

---

## 版权与署名

| | |
|---|---|
| 原作者 | **xmbhjQAQ** — https://github.com/xmbhjQAQ/my-static-sites |
| 协议 | **CC BY-NC 4.0**（署名 - 非商业） |
| 二次改编 | **Endless / Wjhtkj** |

本项目是原项目的改编版本：核心题库设计、计分与判定逻辑来自原作者；改编内容包括站点信息替换、主题持久化、题库扩容至 200 题、后端防护与工程化配置。

**CC BY-NC 4.0 要求**：保留署名与原协议出处（页脚 LICENSE 链接、结果页「改编说明」段落不可删除），且**不得用于商业用途**。

---

## 特性

- **动态题库** — 200 题池，每次随机抽取 50 道，重复率可控
- **四维画像** — 审美感官 / 肢体和空间 / 情感共鸣 / 表达与社交，雷达图呈现
- **测谎机制** — 填充题 + 一致性配对题 + 5 类异常模式识别，输出「稳定度」并按可信度打折
- **三语切换** — 简体中文 / English / 日本語，词典与题库分别按语言懒加载
- **全网对比** — Cloudflare D1 汇总有效样本均分，实时展示你的排名位置
- **结果长图** — html2canvas 一键保存分享图
- **主题记忆** — 深色/浅色偏好写入 localStorage，刷新不闪白
- **无障碍** — 惩罚页 glitch 特效默认关闭、开启前二次确认、响应 `prefers-reduced-motion`

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | 原生 ES2020+，**无框架、无打包器** |
| CDN 依赖 | Chart.js（雷达图）、html2canvas（结果长图）、Noto Sans SC |
| 后端 | Cloudflare Pages Functions（单个 `functions/api/score.js`）+ D1（SQLite） |
| i18n | 自研轻量方案，运行时 fetch 词典 + 按语言懒加载题库 |
| 测试 | Node 原生 `assert`，4 个文件 |

没有构建步骤 —— 改完源文件直接部署即生效。

---

## 目录结构

```
男娘测试/
├── index.html              # 单文件应用：HTML + CSS + JS 全内嵌（约 3200 行）
├── functions/
│   └── api/score.js        # Pages Function：POST 提交分数 / GET 拉取统计
├── migrations/
│   ├── 0001_score_submissions.sql   # 明细表 + 索引
│   └── 0002_score_stats.sql         # 汇总表 + 回填 + 触发器
├── locales/                # UI 词典
│   ├── zh-cn.json
│   ├── en_us.json
│   ├── ja.json
│   └── template.json       # 新增语言的空模板（测试会校验它）
├── questions/              # 题库（三语各一份，必须一一对应）
│   ├── questions_zh_cn.js
│   ├── questions_en_us.js
│   └── questions_ja.js
├── tests/                  # 4 个测试，全部用 Node 原生 assert
├── wrangler.toml           # D1 绑定配置
├── package.json
├── w.cmd                   # wrangler 包装脚本（解决 node 不在 PATH 的问题）
└── SETUP.md                # 零基础部署手册
```

---

## 快速开始

### 本地预览

```powershell
cd "D:\项目\femboy\my-static-sites-main\男娘测试"
.\w.cmd pages dev . --d1=DB
```

打开 http://localhost:8788 。`Ctrl+C` 停止。

> `w.cmd` 是 wrangler 的包装脚本，用 Node 绝对路径启动，**不依赖 PATH**。
> 如果你已全局安装 Node，可以直接用 `npx wrangler ...` 或 `npm run dev`。

### 部署

```powershell
.\w.cmd pages deploy .
```

更详细的从零到上线步骤（建库、迁移、Dashboard 绑定）见 **[SETUP.md](./SETUP.md)**。

### 命令对照

| 命令 | 作用 |
|---|---|
| `.\w.cmd --version` | 确认 wrangler 可用 |
| `.\w.cmd login` | 登录 Cloudflare |
| `.\w.cmd d1 create nn-score-db` | 创建数据库 |
| `.\w.cmd d1 migrations apply nn-score-db --remote` | 执行迁移（改了 SQL 必跑） |
| `.\w.cmd pages dev . --d1=DB` | 本地预览 |
| `.\w.cmd pages deploy .` | 部署上线 |
| `npm test` | 跑全部 4 个测试 |

### 改动 → 操作对照

| 你改了什么 | 要做什么 |
|---|---|
| `index.html` / `locales` / `questions` | 只跑 `pages deploy .` |
| `functions/api/score.js` | 只跑 `pages deploy .`（后端跟站点一起传） |
| `migrations/*.sql` | **先** `d1 migrations apply --remote`，**再** 部署 |
| `wrangler.toml` 绑定 | 部署 + 去 Dashboard 确认绑定还在 |

**数据库迁移是最容易漏的一步**：改了 SQL 只跑 deploy，线上表结构不会变，会静默出错。新迁移文件命名要递增（`0003_xxx.sql`），wrangler 只执行没跑过的。

---

## 数据库

两张表，通过**触发器**维护汇总，避免每次请求全表聚合。

### `score_submissions` — 明细

每次提交一行。`id` 使用客户端生成的 UUID，`INSERT OR IGNORE` 天然去重。
字段：`score` `score_max` `score_percent` `raw_score` `raw_percent` `stability_score` `consistency_discount` `is_spam` `spam_status` `duration_seconds` `question_count` `algorithm_version` `question_version` `created_at`。

### `score_stats` — 单行汇总（id 恒为 1）

`total_count` `valid_count` `spam_count` `valid_score_sum` `valid_score_min` `valid_score_max` `last_valid_submitted_at`。

由 `score_submissions_after_insert_stats` 触发器在每次插入后增量更新。

### 手动查数据

```powershell
.\w.cmd d1 execute nn-score-db --remote --command "SELECT COUNT(*) FROM score_submissions"
.\w.cmd d1 execute nn-score-db --remote --command "SELECT * FROM score_stats"
```

### 接口

- `POST /api/score` — 提交一次结果，返回最新统计
- `GET /api/score` — 拉取统计；带 `?debug=<SCORE_DEBUG_TOKEN>` 时额外返回最近 5 条明细（需在 Dashboard 配置该环境变量）

服务端兜底：50 题在 **8 秒**内答完一律标记为异常样本（`MIN_PLAUSIBLE_SECONDS`），`scorePercent` 钳制到 0–100。

---

## 题库

### 题目字段

```js
{
  id: 'A-L27',              // 唯一 id，三语必须一致
  type: 'likert',           // 'likert'（5 级量表）| 'choice'（情景单选）
  d: 'A',                   // 维度：A 审美 / B 肢体 / C 情感 / D 社交 / F 填充 / K 一致性
  facet: 'visual_harmony',  // 细分面，用于均匀抽样
  scored: true,             // false = 不计分（F、K 类）
  r: false,                 // true = 反向题，计分时取 6 - v
  face: 2,                  // 脸谱强度 1-3，>=3 视为高脸谱题
  consistencyKey: 'detail', // 仅 K 类：配对键
  consistencyPolarity: -1,  // 仅 K 类：-1 表示该题需翻转后比对
  t: '题干文字',
  options: [{ v: 5, l: '选项文案' }]   // 仅 choice，分值用 1/2/4/5
}
```

### 当前分布

| 维度 | 题量 | 说明 |
|---|---|---|
| A 审美感官 | 44 | 计分 |
| B 肢体和空间 | 44 | 计分 |
| C 情感共鸣 | 44 | 计分 |
| D 表达与社交 | 44 | 计分 |
| F 填充题 | 16 | 不计分，稀释真实意图 |
| K 一致性题 | 8 | 不计分，专用于测谎 |
| **合计** | **200** | |

### 抽题规则

每套固定 **50 题**：

```
A×11 + B×11 + C×11 + D×11 + F×4 + K×2 = 50
```

两个约束：

- **face 配额** — 每套卷最多 4 道高脸谱题（`face >= 3`），避免整卷太直白一眼看穿
- **K 题必须成对** — 按 `consistencyKey` 配对抽取，单着的一致性题永远抽不到

### ⚠️ 改题库的三个坑

1. **三语必须同步**。中文加了题，英文日文不加的话，页面照样能测，但新题永远抽不到、首页数字还对不上 —— 完全没有报错症状。`npm test` 会拦住这个。
2. **新题加在扩展层末尾并显式指定 id**。基础池的 id 是遍历时自动生成的（`A-L01`、`A-L02`…），往中间插会导致整体位移，后面按 id 匹配的覆盖表就会改错题。
3. **首页「200题」文案要同步改**。四处：`index.html` 兜底 + 中/日/英三份语言文件。

---

## 计分与反作弊

### 计分

```
单维得分 / 该维满分 → 四维平均 → × 2.5 → 映射到 0–250
反向题：6 - v
```

### 稳定度（测谎）

从「一致性矛盾」和「作答模式」两方面扣分，满分 100：

| 扣分来源 | 规则 |
|---|---|
| 一致性矛盾 | `差值² × 2.5`（平方曲线，单次配对最多扣 40） |
| 最长连续相同 | ≥18 扣 25；≥12 扣 12 |
| 极端值过多 | ≥40 扣 18；≥34 扣 8 |

| 稳定度 | 等级 | 折扣 |
|---|---|---|
| ≥ 85 | 高 | ×1 |
| 65–85 | 中等 | ×1 |
| 45–65 | 偏低 | ×0.92 |
| < 45 | 极低 | ×0（进惩罚页） |

> 矛盾罚分用**平方曲线**而非线性，是刻意的：线性时单次配对答差 4 分就扣 60、直接跌破 45 阈值误伤认真作答的用户。现在真正的拦截需要「矛盾 + 模式异常」多个信号叠加。

### 5 类异常模式（命中任意一条即进惩罚页）

| spamStatus | 触发条件 |
|---|---|
| 1 | 50 题在 **35 秒**内答完 |
| 2 | 同一选项出现 ≥ **42** 次 |
| 3 | 最长连续相同 ≥ **25** |
| 4 | 极端值（1 或 5）≥ **46** 次 |
| 5 | 稳定度等级为「极低」 |

---

## 多语言

语言配置在 `index.html` 约 1464 行：

```js
'zh-CN': { dict: 'locales/zh-cn.json', questions: 'questions/questions_zh_cn.js', label: '简体中文', enabled: true }
```

### 新增一门语言

1. 复制 `locales/template.json` → `locales/xx.json`，填文案
2. 复制 `questions/questions_zh_cn.js` → `questions/questions_xx.js`，翻译题干（**id 必须逐条一致**）
3. 在 `index.html` 的语言配置里加一项
4. `npm test`

只翻译 UI 不翻题库，第 2 步可省 —— 页面会回退显示中文题干，但翻译完整性测试会报错。

### 改文案

**带 `data-i18n` 的元素，改 `index.html` 里的中文是无效的**，会被运行时词典覆盖。必须改 `locales/*.json`。

只有没带该属性的（如 `Powered by`、链接 `href`、统计 ID）才直接改 HTML。

两个例外要注意：

- **浏览器标签页标题**有两处：`index.html` 的 `<title>`（硬编码）+ `locales` 的 `meta.title`，**都要改**
- **文案里含 HTML 标签**（如 `<a>`）必须用 `data-i18n-html`，用普通的会把标签当文本显示出来

---

## 测试

```powershell
npm test
```

4 个文件：

| 文件 | 覆盖 |
|---|---|
| `language-config.test.js` | 语言配置的完整性与合法性 |
| `translation-template.test.js` | 各语言文件与 template 的 key 集合一致 |
| `en-us-translation-completeness.test.js` | 英文翻译无遗漏 |
| `question-bank.test.js` | **题库防线**：三语题量 + id 完全一致、无重复 id、各维度题量、情景题选项合法、一致性题成对、抽题 300 次每次满 50 题每维恰好 11、首页文案数字 = 题库真实数量、questions 目录无未被引用的副本 |

`question-bank.test.js` 是专门为了防止三语题库漂移加的 —— 这个漂移在页面上完全没有症状，只能靠测试拦。

---

## 调试

默认关闭。开启方式二选一：

- URL 加 `?debug=1`
- 控制台执行 `localStorage.setItem('nn_debug', '1')` 后刷新

开启后可用 `window.nnDebug`：

```js
nnDebug.score(180)        // 直接渲染指定总分（0-250）
nnDebug.profile('perfect')// 渲染预设画像
nnDebug.punish(3)         // 渲染指定 spamStatus 的惩罚页
nnDebug.reset()           // 清除调试状态
```

调试渲染**不会写入统计库**。

---

## 排错

| 现象 | 原因 | 怎么办 |
|---|---|---|
| `'node' 不是内部或外部命令` | Node 不在 PATH | 用 `.\w.cmd` 代替 `wrangler`，或去 nodejs.org 装 LTS |
| 结果页显示「样本均值暂时不可用」 | **D1 绑定变量名不对**，必须是 `DB` | Dashboard → Settings → Functions → D1 database bindings 检查 |
| `/api/score` 404 | `functions/` 不在部署根目录 | 确保在 `男娘测试` 目录内执行 deploy；Git 部署则 Root directory 填 `男娘测试` |
| 改了 SQL 但线上表结构没变 | 忘了跑迁移 | `d1 migrations apply nn-score-db --remote` |
| 上线后看不到改动 | Cloudflare 缓存 | `Ctrl + F5` 强刷，或用无痕窗口 |
| 改了 HTML 里的中文没生效 | 该元素带 `data-i18n` | 改 `locales/zh-cn.json` |

更多排错见 [SETUP.md](./SETUP.md)。

---

## 已知待办

- [ ] **接口限流** — `/api/score` 无鉴权无限流，可被批量 POST 污染均分。服务端 8 秒兜底只能挡最粗糙的灌数据。建议在 Cloudflare Dashboard → WAF → Rate limiting rules 给 `/api/score` 加一条「同 IP 每分钟 ≤ 5 次」，不需要改代码
- [ ] **统计改用中位数 / IQR** — 比均分更抗投毒
- [ ] **隐私合规** — Microsoft Clarity 是会话录屏级采集，与百度统计一样无条件加载，目前只有页脚一行小字说明，无同意机制
- [ ] **核心逻辑测试** — 计分、反作弊、抽题引擎目前只有抽题被 `question-bank.test.js` 覆盖

---

## 联系

改编者 **Endless / Wjhtkj**

- B站 https://space.bilibili.com/1130303811
- GitHub https://github.com/Wjhtkj/
- 博客 https://wjhtkjwz.eu.org/
- QQ群 https://qm.qq.com/q/7Wi2AYKgXS
