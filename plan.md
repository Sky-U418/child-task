# Child-Task 项目技术方案

## 1. 项目概述

一个基于 HTML5 + Firebase 的亲子任务积分系统。孩子通过完成任务赚取积分，积分可用于兑换奖励。家长通过管理员模式管理任务、奖励和积分规则。

## 2. 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | HTML5 + CSS3 + Vanilla JS (ES6+) | 纯静态页面，无框架依赖 |
| 后端 | Firebase Firestore | BaaS，实时同步，免费额度够用 |
| 认证 | Firebase Anonymous Auth | 免注册，匿名登录即可使用 |
| 动画 | CSS Animations + JS requestAnimationFrame | 轻量视觉反馈 |
| 存储 | Firestore (结构化数据) + localStorage (UI偏好) | 数据跨设备同步，偏好本地存 |

## 3. 页面架构

```
入口页 (index.html)
├── 孩子模式 → child.html（任务看板 + 积分 + 兑换商店）
└── 管理员模式 → admin.html（PIN验证 → 任务管理 + 奖励管理 + 积分规则配置）
```

## 4. Firestore 数据模型

### 4.1 集合: `tasks`
```js
{
  id: auto,
  title: string,
  description: string,
  type: "daily" | "timed",
  points: number,              // 完成获得的成果积分
  status: "available" | "in_progress" | "completed" | "closed",
  deadline: timestamp | null,  // 限时任务截止时间
  resetAt: timestamp | null,   // 每日任务下次重置时间 (当日24:00)
  assignedTo: string | null,   // 分配给哪个孩子（null=所有孩子）
  completedAt: timestamp | null,
  createdAt: timestamp
}
```

### 4.2 集合: `rewards`
```js
{
  id: auto,
  title: string,
  description: string,
  cost: number,                // 所需积分
  type: "periodic" | "limited",
  period: "daily" | "monthly" | null,
  maxExchanges: number,        // 周期/总计内最多兑换次数
  exchangedCount: number,      // 当前已兑换次数
  periodResetAt: timestamp | null,
  isActive: boolean,
  createdAt: timestamp
}
```

### 4.3 集合: `pointsConfig`
```js
{
  id: "config",
  dailyBasePoints: number,     // 每日自动发放基础积分
  basePointsCap: number,       // 基础积分上限
  currentBasePoints: number,   // 当前基础积分余额
  achievementPoints: number,   // 当前成果积分余额 (累计)
  lastBaseGrantAt: timestamp   // 上次发放基础积分时间
}
```

### 4.4 集合: `streak`
```js
{
  id: auto,
  userId: string,
  currentStreak: number,
  lastTaskDate: string,        // "YYYY-MM-DD"
  maxStreak: number,
  multiplier: number           // 当前倍率 (1.0 + streak * 0.1, max 2.0)
}
```

### 4.5 集合: `exchangeLog`
```js
{
  id: auto,
  userId: string,
  rewardId: string,
  rewardTitle: string,
  cost: number,
  exchangedAt: timestamp
}
```

### 4.6 集合: `appConfig`
```js
{
  id: "config",
  adminPIN: string,            // 管理员PIN（SHA-256哈希）
  familyName: string
}
```

## 5. 核心业务逻辑

### 5.1 积分系统
- **基础积分**: 每日自动发放 `dailyBasePoints`，累计不超过 `basePointsCap`
- **成果积分**: 完成任务获得，无上限，任务积分由管理员设定
- **消费优先级**: 兑换奖励时优先扣除基础积分，不足部分用成果积分补足

### 5.2 任务生命周期
```
管理员创建 → [available]
  → 孩子领取 → [in_progress]
    → 管理员标记完成 → [completed]
      → 孩子点击获取积分 → 积分到账 + 任务关闭
    → 每日任务到24:00 → [available]（重置）
    → 限时任务超时 → [closed]
```

### 5.3 每日任务重置
- 每日任务在创建时设定 `resetAt = 当天24:00`
- 孩子完成获取积分后，若未到24:00则状态变为 `available`，`resetAt` 推进到下个24:00
- 页面加载时检查所有每日任务，`resetAt` 已过的自动重置为 `available`

### 5.4 限时任务逻辑
- 管理员创建时设定 `deadline`
- 限时内完成一次后变为 `closed`
- 超时未完成也变为 `closed`
- `closed` 的任务不再显示在任务列表中

### 5.5 奖励兑换逻辑
- **周期性奖励**: 每日/每月重置兑换次数，`periodResetAt` 到期自动重置 `exchangedCount = 0`
- **限次数奖励**: `exchangedCount >= maxExchanges` 时关闭，管理员可手动重置
- 兑换时检查积分是否足够 → 优先扣基础积分 → 扣成果积分 → 记录日志 → 增加 `exchangedCount`

### 5.6 连续打卡系统
- 孩子任意一天至少完成1个任务即视为"打卡"
- 连续打卡天数 = `currentStreak`，每天24:00结算
- 连续打卡N天后，完成任务的积分倍率 = `1.0 + N × 0.1`（上限 2.0x）
- 若当日未完成任何任务，次日 `currentStreak` 重置为 0
- `maxStreak` 记录历史最长连续天数

## 6. 文件结构

```
Child-task/
├── index.html              # 入口页（模式选择）
├── child.html              # 孩子看板
├── admin.html              # 管理员面板
├── css/
│   ├── common.css          # 公共样式 + CSS变量
│   ├── child.css           # 孩子页样式
│   └── admin.css           # 管理员页样式
├── js/
│   ├── firebase-config.js  # Firebase 初始化配置
│   ├── app-config.js       # 应用全局配置常量
│   ├── store.js            # Firestore 数据读写封装
│   ├── points.js           # 积分计算逻辑
│   ├── tasks.js             # 任务生命周期管理
│   ├── rewards.js          # 奖励兑换逻辑
│   ├── streak.js           # 连续打卡计算
│   ├── child-app.js        # 孩子模式主逻辑
│   ├── admin-app.js        # 管理员模式主逻辑
│   ├── router.js           # 简单路由 + 模式守卫
│   ├── ui.js               # DOM工具 + 动画 + Toast通知
│   └── animations.js       # 积分飞入、进度条等动画
├── plan.md                 # 本文件
└── CLAUDE.md               # 代码生成规范
```

## 7. 安全设计

- 管理员PIN使用 SHA-256 哈希存储（前端crypto.subtle），不存明文
- Firestore 安全规则: 匿名用户可读写（家庭内部使用场景）
- 管理员模式通过 PIN 验证进入，验证状态存 sessionStorage
- 孩子界面不暴露任何管理入口

## 8. UI/UX 设计要点

### 8.1 目标用户画像
- **主要使用者**: 6-12岁男孩
- **设计方向**: 科幻科技风 (Sci-Fi Tech) — 太空、电路板、机甲元素融合
- **情感目标**: 让孩子感觉自己是"太空站指挥官"在执行任务，而非"做家务"

### 8.2 视觉主题 — 「星际指挥部」

#### 配色方案
| 用途 | 色值 | 说明 |
|------|------|------|
| 主背景 | `#0a0e17` | 深空蓝黑，模拟太空 |
| 卡片/面板背景 | `#141b2d` | 半透明深蓝灰，控制台面板感 |
| 主强调色 | `#00d4ff` | 电光蓝，按钮、链接、活跃状态 |
| 成功/积分 | `#00ff88` | 霓虹绿，积分数字、完成状态 |
| 警告/进行中 | `#ffb800` | 琥珀黄，进行中状态、打卡火焰 |
| 危险/过期 | `#ff4757` | 霓虹红，过期任务、删除按钮 |
| 文字主色 | `#e0e6f0` | 浅灰蓝白 |
| 文字辅色 | `#8892a4` | 暗灰蓝 |
| 边框/分割线 | `#1e2d4a` | 深蓝边框 |

#### 设计元素
- **网格背景**: 页面背景使用细微的科技网格线（类似雷达屏幕/战术地图）
- **发光边框**: 卡片使用半透明边框 + `box-shadow` 霓虹发光效果
- **扫描线效果**: 卡片hover时出现水平扫描线动画
- **电路纹理**: 关键区域边缘使用CSS绘制的简易电路节点装饰
- **字体**: 主字体 `Inter` 或系统无衬线字体；积分/标题使用 `'Orbitron'` (Google Font) 科技感字体

#### 图标体系
- 使用 CSS 绘制或 SVG 内联图标，主题统一为科幻风格
- 任务图标: 目标靶、扳手、书本、运动鞋 (SVG)
- 状态图标: 脉冲点 (活跃)、锁定 (关闭)、齿轮 (进行中)
- 导航图标: 火箭 (主页)、奖杯 (奖励)、雷达 (任务)
- 打卡图标: 递增的火焰等级 (小火苗 → 烈焰)

### 8.3 页面设计

#### index.html — 模式选择入口
- 深空背景 + 缓慢旋转的星球/光环动画 (CSS only)
- 两个卡片并列: 左侧"宇航员模式"(孩子) — 蓝调；右侧"指挥中心"(管理员) — 金色
- 孩子卡片: 宇航员头盔剪影图标
- 管理员卡片: 盾牌/星标图标 + "需要密码"提示

#### child.html — 孩子看板
- **顶部状态栏**: 积分环形图 + 等级 + 连续打卡火焰
- **任务区域**: 卡片网格，每张卡片有"接受任务"按钮，进行中显示脉冲动画
- **兑换商店**: 底部Tab切换，奖励卡片带发光"兑换"按钮
- **底部导航**: 三个Tab — 任务 / 兑换商店 / 我的

#### admin.html — 管理员面板
- 暗色仪表盘风格，左侧/顶部导航Tab切换
- 数据卡片: 总任务数、活跃任务、待兑换奖励数
- 表单使用控制台终端风格输入框（暗底 + 发光边框）
- 设置区域使用齿轮/滑块等控件

### 8.4 动画规范
- **加载动画**: 旋转的三重光环 (CSS spinner)
- **积分飞入**: 积分数字从任务卡片飞向顶部积分栏，带粒子尾迹
- **任务完成**: 卡片短暂发光脉冲 → 绿色确认勾出现
- **兑换成功**: 奖励卡片放大 + 粒子爆炸效果
- **打卡升级**: 火焰图标从小到大跳动 + 数字滚动
- **Toast通知**: 顶部滑入，带左侧色条（成功绿/错误红/信息蓝）
- **页面切换**: 淡入淡出 200ms

### 8.5 响应式策略
- **移动端优先** (< 768px): 单列卡片布局，底部Tab导航
- **平板** (768px - 1024px): 双列卡片网格
- **桌面** (> 1024px): 三列卡片网格，侧边栏导航

## 9. 实施步骤

### Phase 1: 项目初始化
- 创建 Firebase 项目，启用 Firestore + Anonymous Auth
- 编写 `firebase-config.js` 模板
- 创建 `index.html` 入口页 + 模式选择

### Phase 2: 管理员模式
- `admin.html` + PIN验证
- 任务管理 CRUD（含任务类型选择、时限设定）
- 奖励管理 CRUD（含周期/限次数选择）
- 积分配置面板（基础积分、上限设置）

### Phase 3: 孩子模式
- `child.html` 任务看板（领取任务、查看进度、获取积分）
- 积分展示（基础积分环形图 + 成果积分 + 总积分）
- 奖励商店（兑换 + 确认弹窗）
- 连续打卡展示

### Phase 4: 核心逻辑
- 积分系统（基础积分每日发放、消费优先级）
- 每日任务自动重置
- 限时任务过期检查
- 奖励周期性重置
- 连续打卡计算 + 倍率

### Phase 5: 动画与打磨
- 积分飞入动画
- Toast 通知系统
- 卡片hover/点击微交互
- 进度条/环形图动画

## 10. 验证方案

1. **Firebase连接测试**: 确认 `firebase-config.js` 配置正确，页面可正常读写 Firestore
2. **模式隔离测试**: 孩子入口无法访问 admin.html，管理员需PIN才能进入
3. **任务全生命周期测试**: 创建 → 领取 → 完成 → 获取积分，每日任务重置
4. **积分测试**: 基础积分每日发放、上限、消费优先级（先基础后成果）
5. **奖励兑换测试**: 积分扣除、次数限制、周期重置
6. **连续打卡测试**: 打卡天数递增、倍率计算、中断重置
7. **跨设备同步测试**: 家长端修改任务 → 孩子端实时看到变化
8. **限时任务过期测试**: 模拟超时任务自动关闭
