# 星际指挥部 v0.2.1 详细设计总结

## 1. 系统概述

**星际指挥部 (Star Command)** 是一个面向家庭的亲子任务积分系统。家长（指挥官）通过管理面板发布任务和奖励，孩子（宇航员）通过完成任务获取积分，并用积分兑换奖励。系统基于纯前端技术栈 + Firebase BaaS，支持多设备实时同步。

### 技术栈

| 层级 | 技术 | 版本/说明 |
|------|------|-----------|
| 前端 | HTML5 + CSS3 + Vanilla JS (ES6+) | 无框架，零依赖（除 Firebase SDK） |
| 后端 | Firebase Firestore | BaaS，实时同步 |
| 认证 | Firebase Anonymous Auth | 匿名登录，多设备共享 UID |
| CDN | Firebase SDK | `12.12.1` (compat 模式) |
| 字体 | Google Fonts | Inter (正文) + Orbitron (展示) |
| 部署 | GitHub Pages | `sky-u418.github.io/child-task/` |

---

## 2. 页面架构

```
index.html (入口大厅)
├── 宇航员模式 → child.html (孩子端)
└── 指挥中心 → admin.html (家长端，PIN保护)
```

### 2.1 入口页 (index.html)

- **导航卡片**：两块大卡片分别链接到孩子端和管理端
  - 宇航员模式卡片：蓝色调，SVG宇航员图标，标注"进入"
  - 指挥中心卡片：金色调，SVG星标图标，标注"需要密码"
- **视觉效果**：深空网格背景 + CSS旋转星球/双光环动画
- **扫描线动画**：卡片 hover 时出现水平扫描线滑过效果
- **版本标识**：页脚显示 `STAR COMMAND v1.0`

### 2.2 孩子端 (child.html)

路由：直接访问，无需认证。

**三个底部导航 Tab：**

| Tab | 面板ID | 功能 |
|-----|--------|------|
| 任务 | `panel-tasks` | 任务卡片网格，接受/领取任务 |
| 兑换商店 | `panel-shop` | 奖励卡片网格，积分兑换 |
| 我的 | `panel-profile` | 打卡记录、周报/月报、兑换记录 |

**顶部状态栏**（`status-bar`）：
- **积分横幅**：大号可用积分数字（基础 + 成果之和）
- **三栏状态盒**：
  - 连续打卡：火焰图标 + 天数 + 倍率标签
  - 基础积分：当前值 / 上限
  - 成果积分：当前值

**页面生命周期**：
1. `firebase:ready` 事件触发后初始化
2. 执行每日维护：`grantDailyBasePoints()` → `runScheduledChecks()` → `checkPeriodicReset()` → `checkStreakReset()`
3. 注册 Firestore 实时监听：tasks、rewards、pointsConfig、streak
4. 加载周报/月报/兑换记录
5. 每小时自动重新渲染（处理过期清理，无需刷新页面）

### 2.3 管理端 (admin.html)

路由：需要 PIN 验证。首次访问进入 PIN 设置向导。

**PIN 验证流程：**
```
[输入PIN] → SHA-256哈希比对
  ├── 首次使用（无PIN记录）→ 切换到"设置密码"模式 → 保存SHA-256哈希
  ├── 验证通过 → 存储 sessionStorage 标记 → 显示管理面板
  └── 验证失败 → 抖动动画 + 错误提示
```

**四个顶部 Tab：**

| Tab | 面板ID | 功能 |
|-----|--------|------|
| 任务管理 | `panel-tasks` | CRUD + 标记完成 + 关闭 + 重置 + 排序 |
| 奖励管理 | `panel-rewards` | CRUD + 启用/停用 + 重置 + 排序 |
| 积分配置 | `panel-points` | 基础积分设置 + 手动调整 + 打卡管理 + PIN修改 |
| 记录 | `panel-logs` | 周报/月报 + 兑换日志 |

**统计卡片行**：总任务数 / 进行中 / 可兑换奖励

---

## 3. Firestore 数据模型

### 3.1 集合一览

| 集合 | 文档ID | 用途 |
|------|--------|------|
| `tasks` | 自动生成 | 任务定义与状态 |
| `rewards` | 自动生成 | 奖励定义与兑换计数 |
| `pointsConfig` | `"config"` | 积分余额与发放配置 |
| `streak` | `<uid>` | 连续打卡数据 |
| `exchangeLog` | 自动生成 | 兑换历史记录 |
| `taskLog` | 自动生成 | 任务完成记录（用于报告计算） |
| `appConfig` | `"config"` | 管理员PIN哈希 + sharedUid |

### 3.2 tasks 集合

```js
{
  title: string,              // 任务名称 (max 50)
  description: string,        // 任务描述 (max 200)
  type: "daily" | "timed",   // 任务类型
  points: number,             // 奖励积分数
  status: "available" | "in_progress" | "completed" | "closed",
  order: number,              // 排序权重 (间距 1000)
  deadline: Timestamp | null, // 限时任务截止时间
  resetAt: Timestamp | null,  // 每日任务重置时间（当天24:00）
  graceExpiresAt: Timestamp | null, // 宽限期到期时间
  completedAt: Timestamp | null,
  createdAt: Timestamp
}
```

**排序规则**：客户端按 `order` 字段升序排列（缺省视为 0），order 相同时按 `createdAt` 排序。

### 3.3 rewards 集合

```js
{
  title: string,
  description: string,
  cost: number,               // 兑换所需积分
  type: "periodic" | "limited",
  period: "daily" | "monthly" | null,
  maxExchanges: number,       // 周期/总计内最多兑换次数
  exchangedCount: number,     // 当前已兑换次数
  order: number,
  isActive: boolean,
  periodResetAt: Timestamp | null, // 周期重置时间
  disabledAt: Timestamp | null,    // 停用时间
  exhaustedAt: Timestamp | null,   // 耗尽时间
  createdAt: Timestamp
}
```

### 3.4 pointsConfig 集合

```js
{
  // 文档ID: "config"
  dailyBasePoints: number,     // 每日自动发放基础积分 (默认10)
  basePointsCap: number,       // 基础积分上限 (默认100)
  currentBasePoints: number,   // 当前基础积分余额
  achievementPoints: number,   // 当前成果积分余额
  lastBaseGrantAt: Timestamp   // 上次发放时间（防重复发放）
}
```

### 3.5 streak 集合

```js
{
  // 文档ID: <uid>
  userId: string,
  currentStreak: number,       // 当前连续天数
  lastTaskDate: string,        // "YYYY-MM-DD" 最后打卡日期
  maxStreak: number,           // 历史最长连续
  multiplier: number           // 当前积分倍率
}
```

### 3.6 exchangeLog 集合

```js
{
  userId: string,
  rewardId: string,
  rewardTitle: string,
  cost: number,
  exchangedAt: Timestamp
}
```

### 3.7 taskLog 集合

```js
{
  userId: string,
  taskId: string,
  taskTitle: string,
  points: number,              // 任务标价
  multiplier: number,          // 使用的倍率
  earnedPoints: number,        // 实际获得积分
  completedAt: Timestamp
}
```

### 3.8 appConfig 集合

```js
{
  // 文档ID: "config"
  adminPIN: string,            // PIN 的 SHA-256 哈希值
  sharedUid: string            // 共享用户ID（多设备同步）
}
```

### 3.9 复合索引

在 Firebase Console 中创建，用于报告查询：

- `taskLog`: `userId` Asc + `completedAt` Asc
- `exchangeLog`: `userId` Asc + `exchangedAt` Asc

---

## 4. 核心业务逻辑

### 4.1 任务生命周期

```
管理员创建 → [available]
  → 孩子接受任务 → [in_progress]
    → 管理员标记完成 → [completed]
      → 孩子领取积分 → [closed] → 立即消失
    → 限时任务到期 → [closed] (graceExpiresAt) → 1天后消失
    → 管理员手动关闭 → [closed] (graceExpiresAt) → 1天后消失
  → 每日任务到24:00 → [available]（自动重置）
```

**关键设计决策：**
- 孩子端只能"接受"和"领取"，不能自己标记完成
- 管理员端可标记完成、关闭、重置任务
- 关闭的任务有 1 天宽限期，之后从孩子端消失
- 限时任务不受打卡倍率影响（倍率固定 1.0x）

### 4.2 积分系统

**两种积分类型：**

| 类型 | 来源 | 上限 | 受倍率影响 |
|------|------|------|-----------|
| 基础积分 | 每日自动发放 | `basePointsCap` | 否 |
| 成果积分 | 完成任务领取 | 无上限 | 是（每日任务） |

**每日发放逻辑**（`PointsManager.grantDailyBasePoints`）：
- 检查 `lastBaseGrantAt` 是否已过当天 0:00
- 发放量 = `min(dailyBasePoints, basePointsCap - currentBasePoints)`
- 事务保证不重复发放

**消费优先级**：兑换奖励时 → 先扣基础积分 → 不足部分扣成果积分

### 4.3 连续打卡系统

**核心规则**：今天的倍率由昨天的连续天数决定，全天不变。

```
倍率公式：multiplier = min(1.0 + yesterdayStreak × 0.1, 2.0)
```

**打卡触发**：管理员将所有每日任务标记为"已完成"时自动触发。限时任务不参与打卡。

**状态机**：
```
页面加载 → checkStreakReset()
  ├── 昨天完成了任务 → 倍率 = calcMultiplier(昨天连续天数)
  ├── 昨天没完成（中断）→ 重置 currentStreak=0, multiplier=1.0
  └── 今天已处理过 → 跳过
```

**倍率对照表：**

| 连续天数 | 倍率 |
|----------|------|
| 0 | 1.0x |
| 1 | 1.1x |
| 2 | 1.2x |
| 5 | 1.5x |
| 10 | 2.0x (上限) |

### 4.4 奖励兑换系统

**周期性奖励**：
- 支持每日/每月周期重置
- `checkPeriodicReset()` 在页面加载时执行，检查 `periodResetAt` 是否过期
- 过期自动重置 `exchangedCount = 0`，并计算下一个重置时间

**限次数奖励**：
- 总计兑换次数上限
- 耗尽后设置 `exhaustedAt`，保留 1 天宽限期后从列表消失
- 管理员可通过"重置奖励"恢复

**兑换事务**（Firestore Transaction）：
1. 读取积分配置和奖励最新数据
2. 验证可兑换性（激活状态 + 次数余量）
3. 验证积分余额（基础 + 成果 >= cost）
4. 扣除积分（优先基础）
5. 增加 `exchangedCount`
6. 写入 `exchangeLog`

### 4.5 宽限期系统

| 场景 | 标记字段 | 保留时间 | 行为 |
|------|----------|----------|------|
| 正常领取完成 | 无 | 立即消失 | status=closed 且无 graceExpiresAt |
| 限时任务过期 | `graceExpiresAt` | 1天 | 到期后过滤 |
| 管理员关闭 | `graceExpiresAt` | 1天 | 同上 |
| 限次数奖励耗尽 | `exhaustedAt` | 1天 | 耗尽后过滤 |
| 奖励被停用 | `disabledAt` | 1天 | 停用后过滤 |

**实现方式**：孩子端 `renderTasks()`/`renderRewards()` 每次渲染时过滤过期项，每小时自动触发。

### 4.6 排序系统

任务和奖励使用 `order` 字段管理显示顺序：

- 初始值按 `ORDER_INTERVAL = 1000` 递增（1000, 2000, 3000...）
- 管理员上移/下移通过交换相邻项的 `order` 值实现
- 当相邻两项间距 < 0.5 时自动触发 `rebalance()` 重新均分
- 历史数据迁移：首次进入管理面板时，为缺少 `order` 的文档自动补充初始值

---

## 5. 认证与安全

### 5.1 Anonymous Auth + Shared UID

```
auth.signInAnonymously()
  → onAuthStateChanged
    → 事务读取/写入 appConfig.sharedUid
      → 首次设备写入自己的 uid 作为 sharedUid
      → 后续设备读取已有的 sharedUid
    → window._uid = sharedUid
    → dispatchEvent('firebase:ready')
```

所有数据操作以 `window._uid` 作为用户标识，实现多设备数据互通。

### 5.2 管理员 PIN

- 存储为 SHA-256 哈希（`crypto.subtle.digest('SHA-256', ...)`）
- 验证状态存 `sessionStorage('admin_authenticated')`，关闭标签页即失效
- 首次使用无 PIN 时自动进入设置向导
- 支持 4-8 位数字 PIN

### 5.3 Auth 超时降级

15 秒内 Firebase Auth 未完成，显示"无法连接到服务器"降级页面，提供重试按钮。

---

## 6. 报告系统

### 6.1 计算方式

实时从 `taskLog` 和 `exchangeLog` 集合查询生成，不预先存储计算结果。

### 6.2 周报

- 周期：周一 ~ 周日
- 显示上周 + 本周双栏对比
- 统计指标：打卡天数、最长连续、完成任务、获得积分、兑换奖励、消耗积分

### 6.3 月报

- 周期：1日 ~ 月末
- 默认当月，可前后翻页
- 统计指标与周报相同

### 6.4 详情弹窗

点击任意统计数字可弹出详情：

| 指标 | 详情内容 |
|------|----------|
| 打卡天数 | 打卡日期列表（如 `5/1`, `5/3`） |
| 最长连续 | 最大连续天数 |
| 完成任务 | 表格：任务名 | 完成次数 | 获得积分 |
| 获得积分 | 同上 |
| 兑换奖励 | 表格：奖励名 | 兑换次数 |
| 消耗积分 | 表格：奖励名 | 兑换次数 | 消耗积分 |

---

## 7. UI/UX 设计

### 7.1 视觉主题 — 星际科幻风

**配色体系（CSS 变量）：**

| 用途 | 变量 | 色值 |
|------|------|------|
| 主背景 | `--color-bg-main` | `#0a0e17` |
| 面板背景 | `--color-bg-panel` | `#141b2d` |
| 卡片背景 | `--color-bg-card` | `#161e33` |
| 主强调色 | `--color-accent` | `#00d4ff` (电光蓝) |
| 成功/积分 | `--color-success` | `#00ff88` (霓虹绿) |
| 警告/进行中 | `--color-warning` | `#ffb800` (琥珀黄) |
| 危险/错误 | `--color-danger` | `#ff4757` (霓虹红) |
| 信息 | `--color-info` | `#7c5cfc` (紫色) |

**设计元素：**
- CSS 网格背景（雷达屏幕效果，40px 间距）
- 发光边框 + `box-shadow` 霓虹效果
- Orbitron 字体用于标题和数字，Inter 字体用于正文
- 卡片状态左侧色条（3px `border-left`）
- 扫描线 hover 动画

### 7.2 组件库

**按钮体系**（`.btn`）：
- `btn--primary`：蓝底白字，主操作
- `btn--success`：绿底黑字，确认/领取
- `btn--danger`：红底白字，删除
- `btn--outline`：透明蓝边，次要操作
- `btn--ghost`：透明灰边，取消
- `btn--sm` / `btn--lg` / `btn--block`：尺寸变体

**Toast 通知**（`UI.toast(message, type, duration)`）：
- 顶部右侧滑入，左侧色条
- `success` (绿) / `error` (红) / `info` (蓝)
- 默认 3 秒自动消失

**确认对话框**（`UI.confirm(title, message)`）：
- 模态遮罩 + 毛玻璃背景
- 返回 Promise<boolean>
- 用于删除、重置等危险操作

**模态框**（`UI.modal(opts)`）：
- 仅接受 HTMLElement 作为 body/footer，防止 XSS
- 点击遮罩或关闭按钮关闭

### 7.3 动画系统

| 动画 | 函数 | 触发场景 |
|------|------|----------|
| 积分飞入 | `Animations.flyingPoints()` | 领取任务积分 |
| 粒子爆炸 | `Animations.particleBurst()` | 兑换奖励 / 领取积分 |
| 数字滚动 | `Animations.countUp()` | 积分变化（预留） |
| 脉冲 | `Animations.pulse()` | 按钮点击反馈（预留） |
| 环形进度 | `Animations.animateRing()` | 进度条变化（预留） |
| 火焰闪烁 | CSS `flameFlicker` | 连续打卡 > 0 |
| 状态脉冲 | CSS `pulse` | 进行中任务状态点 |
| 输入抖动 | CSS `shake` | PIN 输入错误 |
| 轨道旋转 | CSS `orbitRotate` | 入口页星球光环 |

### 7.4 响应式策略

```
移动端 (< 768px):  单列卡片 + 固定底部导航 + 安全区域适配
平板   (768-1024):  双列任务/奖励网格 + 静态顶部导航
桌面   (> 1024px):  三列任务网格
```

### 7.5 空状态设计

- 任务为空：🛰️ 暂无任务，等待指挥官发布...
- 奖励为空：🎁 暂无奖励，等待指挥官设置...
- 日志为空：暂无兑换记录
- 报告失败：数据库索引未创建（含 Firebase Console 链接）

---

## 8. JavaScript 模块架构

### 8.1 模块依赖关系

```
firebase-config.js (初始化 Firebase + Auth)
       ↓ dispatchEvent('firebase:ready')
app-config.js (全局常量，无依赖)
       ↓
store.js (Firestore CRUD 封装，依赖 APP_CONFIG)
       ↓
┌──────┼──────┬────────┬─────────┐
points  tasks  rewards  streak   reports
.js     .js    .js      .js      .js
       ↓
shared-ui.js (共用渲染函数)
       ↓
    ┌──┴──────────┐
ui.js         animations.js
(Toast/Modal) (视觉特效)
       ↓
┌──────┴──────┐
child-app.js  admin-app.js
              router.js (admin 专用)
```

### 8.2 模块职责

| 模块 | 命名空间 | 职责 |
|------|----------|------|
| `firebase-config.js` | 全局 (`db`, `auth`, `firebase`) | Firebase 初始化、匿名认证、共享 UID、超时降级 |
| `app-config.js` | `APP_CONFIG` | 全局常量（集合名、状态枚举、默认值） |
| `store.js` | `Store` | 所有 Firestore 读写 + `onSnapshot` 实时监听 + 批量操作 |
| `points.js` | `PointsManager` | 每日基础积分发放、积分消费、积分重置 |
| `tasks.js` | `TaskManager` | 任务创建/编辑/删除、生命周期管理（接受/完成/领取）、定时检查 |
| `rewards.js` | `RewardManager` | 奖励创建/编辑、兑换事务、周期重置检查 |
| `streak.js` | `StreakManager` | 打卡状态更新、倍率计算、中断重置 |
| `reports.js` | `ReportManager` | 周/月范围计算、从日志实时聚合报告数据 |
| `shared-ui.js` | `SharedUI` | HTML 转义、报告卡片渲染、报告详情渲染、兑换日志渲染 |
| `ui.js` | `UI` | Toast 通知、模态框、确认弹窗、加载覆盖层、DOM 创建工具 |
| `animations.js` | `Animations` | 积分飞入、粒子爆炸、数字滚动、脉冲、环形进度 |
| `child-app.js` | - (事件驱动) | 孩子端主逻辑：Tab 导航、渲染调度、事件处理 |
| `admin-app.js` | - (事件驱动) | 管理端主逻辑：PIN 验证、CRUD 表单、排序、Tab 导航 |
| `router.js` | `Router` | 管理员 PIN 验证/设置、会话管理、SHA-256 哈希 |

### 8.3 事件驱动架构

```
firebase-config.js
  → auth.onAuthStateChanged
    → window._uid = sharedUid
    → document.dispatchEvent(new CustomEvent('firebase:ready'))

child-app.js / admin-app.js
  → document.addEventListener('firebase:ready', async () => { ... })
```

所有业务逻辑在 `firebase:ready` 事件触发后启动，确保 Firebase Auth 已完成。

---

## 9. 文件清单

```
child-task/
├── index.html                  # 入口页（模式选择）
├── child.html                  # 孩子看板（宇航员模式）
├── admin.html                  # 管理面板（指挥中心）
├── css/
│   ├── common.css              # 全局样式 + CSS变量 + 入口页样式 (771行)
│   ├── child.css               # 孩子端样式 (787行)
│   └── admin.css               # 管理端样式 (674行)
├── js/
│   ├── firebase-config.js      # Firebase 初始化 + 认证 + sharedUid (68行)
│   ├── app-config.js           # 全局常量定义 (47行)
│   ├── store.js                # Firestore CRUD + 监听封装 (278行)
│   ├── points.js               # 积分管理 (110行)
│   ├── tasks.js                # 任务生命周期 (184行)
│   ├── rewards.js              # 奖励兑换逻辑 (197行)
│   ├── streak.js               # 连续打卡系统 (99行)
│   ├── reports.js              # 周报/月报实时计算 (130行)
│   ├── shared-ui.js            # 共享渲染工具 (148行)
│   ├── ui.js                   # Toast/Modal/确认框 (203行)
│   ├── animations.js           # 视觉动画 (186行)
│   ├── child-app.js            # 孩子端主逻辑 (511行)
│   ├── admin-app.js            # 管理端主逻辑 (999行)
│   └── router.js               # 路由守卫 + PIN管理 (75行)
├── CLAUDE.md                   # 代码生成规范
├── plan.md                     # 原始技术方案
├── messagebox.md               # 消息框设计方案 (v2，待实现)
├── 1st_release_summary.md      # v1.0 首次发布总结
└── v021summary.md              # 本文件
```

**代码统计：**
- 总行数：~5,200 行（HTML: ~550, CSS: ~2,200, JS: ~2,450）
- JS 模块：13 个
- CSS 文件：3 个
- HTML 页面：3 个

---

## 10. 待实现功能（messagebox.md v2）

消息框系统已在 `messagebox.md` 中完成设计，尚未实现：

- **位置**：状态栏与内容面板之间
- **单条横幅**：始终显示最新消息，左侧类型颜色标识条
- **浮窗历史**：点击展开最近 24 小时消息，倒序排列
- **消息类型**：鼓励（绿）、提醒（金）、新增（蓝）、系统（紫）
- **自动生成**：客户端在 `onSnapshot` 变化时对比前后状态自动生成
- **内存存储**：`messageLog` 数组，不入 Firestore，上限 200 条

---

## 11. 设计约束与约定

### 11.1 安全约束
- 不依赖客户端权限判断（Firestore Rules 负责安全控制）
- PIN 使用 SHA-256 哈希，不存明文
- 不使用 `eval()`、`new Function()`、`document.write()`
- 不使用 `innerHTML` 插入用户数据（使用 `SharedUI.esc()` 转义或 `textContent`）
- 模态框 body 仅接受 HTMLElement

### 11.2 代码规范
- 使用 `const`/`let`，禁止 `var`
- 使用 `===`，禁止 `==`
- 使用 `addEventListener`，禁止内联事件
- 使用 `async/await` 处理异步操作
- DOM 元素引用以 `$` 前缀命名
- CSS 类名使用 kebab-case，状态类使用 `is-` 前缀
- 禁止在 HTML 中写内联 `<style>` 或 `<script>`

### 11.3 数据流
- 单向数据流：用户操作 → Store 方法 → Firestore → `onSnapshot` → 更新 UI
- 写入使用事务保证原子性（积分扣除、兑换操作）
- 客户端排序（`order` 字段），不依赖数据库排序

---

## 12. 版本演进

| 版本 | 主要变更 |
|------|----------|
| v1.0 | 初始发布：基础任务/奖励/积分/打卡系统 |
| v0.2.1 (当前) | 新增：排序系统、报告系统（周报/月报/明细）、宽限期机制、共享UID、Auth超时降级、动画系统、报告详情弹窗、订单字段迁移、兑换记录可折叠、改进的打卡倍率逻辑 |
