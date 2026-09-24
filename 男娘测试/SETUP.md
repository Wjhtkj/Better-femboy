# 从零部署上线 · Windows 手把手版

> 你已经具备的条件（我已确认过）：
> - Node 22 已装好 ✅
> - wrangler 4.135.0 已装进本项目 ✅
>
> 你还需要准备：**一个 Cloudflare 账号**（免费）
> 没有就去 https://dash.cloudflare.com 注册一个，邮箱验证即可。

## 关于 `w.cmd`（先读这段，能省你很多麻烦）

你机器上的 Node 只装在 WorkBuddy 内部目录里，**你自己打开的终端找不到它**，
所以直接敲 `node` / `npx` / `wrangler` 都会报：

```
'node' 不是内部或外部命令，也不是可运行的程序
```

我在项目里放了一个 `w.cmd`，它会自动带上 Node 去调用 wrangler。
**本手册里所有 `.\w.cmd` 就是 wrangler 的意思**，照抄即可。

例如 `.\w.cmd login` 就等于官方教程里的 `wrangler login`。

> 想一劳永逸的话，去 https://nodejs.org 装一个 LTS 版 Node，
> 装完重开终端，就能直接用 `npx wrangler ...` 了（那样不需要 `w.cmd`）。

---

## 第 1 步：打开终端，进入项目目录

按 `Win` 键 → 输入 `powershell` → 回车，会弹出一个蓝色窗口。

粘贴下面这行，回车：

```powershell
cd "D:\项目\femboy\my-static-sites-main\男娘测试"
```

**后面所有命令都在这个蓝色窗口里执行，也都在进到这个目录之后。** 换窗口或重启后要再 `cd` 一次。

---

## 第 2 步：确认 wrangler 能用

```powershell
.\w.cmd --version
```

看到 `4.135.0`（或类似版本号）就成了。

> 会有一行黄色 `WARNING: Proxy environment variables detected`，那是你机器上开了代理，不影响，忽略即可。

---

## 第 3 步：登录 Cloudflare

```powershell
.\w.cmd login
```

会自动打开浏览器：

1. 登录你的 Cloudflare 账号
2. 页面问 “Wrangler is requesting access to your account” → 点 **Allow**
3. 回到蓝窗口，出现 `Successfully logged in` 就成功了

验证一下：

```powershell
.\w.cmd whoami
```

会显示你的邮箱。

---

## 第 4 步：创建 D1 数据库

```powershell
.\w.cmd d1 create nn-score-db
```

输出大概长这样：

```
✅ Successfully created DB 'nn-score-db'

[[d1_databases]]
binding = "DB"
database_name = "nn-score-db"
database_id = "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"     ← 复制这一串
```

**把 `database_id` 引号里那一串复制下来**（那是你的数据库身份证）。

---

## 第 5 步：把 id 填进配置文件

用记事本（或任何编辑器）打开项目里的 `wrangler.toml`，把最后一行：

```toml
database_id = "REPLACE_WITH_YOUR_DATABASE_ID"
```

改成你刚复制的那串，例如：

```toml
database_id = "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
```

保存。

---

## 第 6 步：建表（跑迁移）

```powershell
.\w.cmd d1 migrations apply nn-score-db --remote
```

会出现一堆 SQL 语句，然后问：

```
Do you want to proceed? (Y/n)
```

输入 `y` 回车。

应该看到两条都成功：

```
✅ Migration 0001_score_submissions.sql applied
✅ Migration 0002_score_stats.sql applied
```

这就建好了两张表：`score_submissions`（每次提交一行）和 `score_stats`（汇总，自动维护）。

---

## 第 7 步：先在本地跑一遍（可选，但建议）

```powershell
.\w.cmd pages dev . --d1=DB
```

窗口会给出一个地址（通常是 `http://localhost:8788`）。浏览器打开它，完整做一遍测试。

如果结果页底部显示 “已收录 1 份”，说明数据库通了。

看完在蓝窗口按 `Ctrl + C` 停掉。

> 本地默认连的是**本地库**，跟线上库是分开的。想让本地连线上数据用 `d1 migrations apply nn-score-db --local` 建本地库后再 dev。

---

## 第 8 步：把站点传上去

```powershell
.\w.cmd pages deploy .
```

第一次会问项目名，输入：

```
femboy-test
```

回车。上传完成后会给一个网址，形如：

```
https://femboy-test.pages.dev
```

**把这个网址记下来**，打开看看，首页应该能正常显示。

⚠️ 现在数据库**还没接上**，做测试会显示 “样本均值暂时不可用”。下一步就接。

---

## 第 9 步：在网页上绑定数据库（关键，命令行做不到）

1. 打开 https://dash.cloudflare.com
2. 左侧点 **Workers & Pages**
3. 点 **femboy-test** 这个项目
4. 点上方 **Settings** 选项卡
5. 左侧找 **Functions** 点进去
6. 往下滚到 **D1 database bindings**，点 **Add binding**
7. Variable name 填：`DB` ← **必须大写，必须就叫 DB**
8. D1 database 下拉选：`nn-score-db`
9. 点 **Save**

> **为什么命令行绑定了还要再绑一次？**
> 因为 Pages 项目的线上环境不读 `wrangler.toml` 里的绑定，那文件只有本地开发时用。
> 变量名必须叫 `DB`，因为 `functions/api/score.js` 里读的是 `env.DB`，对不上就取不到数据库。

---

## 第 10 步：再部署一次（让绑定生效）

**改完绑定后必须重新部署，否则不生效。** 回到蓝窗口：

```powershell
.\w.cmd pages deploy .
```

---

## 第 11 步：验收

打开你的 `*.pages.dev` 网址，完整做一遍测试。

- 结果页底部出现 **“📊 当前有效样本均分 xx.x / 250 · 已收录 N 份”** → 全部打通 ✅
- 还是 “样本均值暂时不可用” → 看下面的排错

也可以直接在蓝窗口查数据库：

```powershell
.\w.cmd d1 execute nn-score-db --remote --command "SELECT COUNT(*) FROM score_submissions"
```

---

## 排错

| 现象 | 原因 | 怎么办 |
|---|---|---|
| `'node' 不是内部或外部命令` | 你自己的终端里没有 Node | 用 `.\w.cmd` 代替 `wrangler`；或去 nodejs.org 装 LTS 版 Node |
| `You are not authenticated` | 没登录或登录过期 | 重跑第 3 步 |
| 结果页一直 “样本均值暂时不可用” | ① 没绑 D1 ② 绑定后没重新部署 ③ 没跑迁移 | 按第 6、9、10 步检查 |
| `/api/score` 404 | Functions 没被部署 | 确认第 8 步是在 `男娘测试` 目录里执行的（`functions/` 文件夹要和 `index.html` 同级） |
| 页面能开但报 503 | 绑定变量名不是 `DB` | 回第 9 步改成 `DB` 并重新部署 |
| `database_id` 填错 | — | 改 `wrangler.toml` 最后一行为真实 id |

---

## 命令速查

```powershell
# 进入项目（每次开新窗口都要先跑）
cd "D:\项目\femboy\my-static-sites-main\男娘测试"

# 登录
.\w.cmd login

# 建表 / 重跑迁移
.\w.cmd d1 migrations apply nn-score-db --remote

# 本地预览
.\w.cmd pages dev . --d1=DB

# 部署上线（改完任何东西都要跑这个）
.\w.cmd pages deploy .

# 查线上有多少份样本
.\w.cmd d1 execute nn-score-db --remote --command "SELECT COUNT(*) FROM score_submissions"
```

---

## 日常更新：改完代码怎么上线

这个项目**没有构建步骤**，改了文件直接重新部署就生效：

```powershell
cd "D:\项目\femboy\my-static-sites-main\男娘测试"
.\w.cmd pages deploy .
```

建议先本地看一眼再上线：

```powershell
.\w.cmd pages dev . --d1=DB
```

### 什么改动需要什么操作

| 你改了什么 | 要做什么 |
|---|---|
| `index.html`、CSS、JS、`locales/*.json`、`questions/*.js` | 只跑 `pages deploy .` |
| 新增/修改了 `migrations/*.sql` | 先跑 `d1 migrations apply nn-score-db --remote`，再 `pages deploy .` |
| `functions/api/score.js`（后端） | 只跑 `pages deploy .`（Functions 跟站点一起传） |
| `wrangler.toml` 里的绑定 | 部署 + 去 Dashboard 确认绑定还在（线上以 Dashboard 为准） |
| 新增依赖 | 先 `npm install`，再部署 |

### 加新的数据库迁移

在 `migrations/` 下新建文件，**名字必须以递增数字开头**：

```
0003_add_something.sql
```

然后：

```powershell
.\w.cmd d1 migrations apply nn-score-db --remote
```

wrangler 会自动记下哪些迁移跑过了，只执行新的那些，不会重跑旧的。

### 看不到更新？

Cloudflare 会缓存静态资源。先试强制刷新：

```
Ctrl + F5
```

还不行就等一两分钟再刷，或者用无痕窗口打开。

---

## 费用

Cloudflare 免费额度对个人项目绰绰有余：

- Pages：无限请求，每月 500 次部署
- D1：5 GB 存储，每天 500 万行读取 / 10 万行写入

你这个站一天几十份提交，离收费线差好几个数量级。
