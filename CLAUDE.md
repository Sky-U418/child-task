# CLAUDE.md — Child-Task 项目代码生成规范

> 以下规范在对本项目进行 HTML/CSS/JS 代码生成和修改时必须遵守。

---

## 1. 文件组织规范

### 1.1 目录结构
- 所有 `.html` 文件放在项目根目录
- `.css` 文件统一放在 `css/` 目录，按页面拆分
- `.js` 文件统一放在 `js/` 目录，按功能模块拆分
- 禁止在 HTML 文件中写内联 `<style>` 或 `<script>`（除 Firebase SDK CDN 引用外）

### 1.2 文件命名
- 使用小写 + 连字符: `child-app.js`, `admin-app.js`
- HTML 文件名使用小写: `index.html`, `child.html`, `admin.html`
- JS 模块文件每个文件只负责一个领域

---

## 2. HTML 规范

### 2.1 文档结构
- 使用 `<!DOCTYPE html>` 声明
- `<meta charset="UTF-8">` 必须在 `<head>` 最前
- 必须包含 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- 外部资源使用现代 CDN（如 `cdnjs.cloudflare.com` 或 Google Fonts）

### 2.2 语义化
- 使用语义化标签: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- 按钮使用 `<button>` 而非 `<div onclick>`
- 表单必须使用 `<form>` + `<label>` 绑定

### 2.3 数据属性
- 动态数据绑定使用 `data-*` 属性: `data-task-id`, `data-status`, `data-reward-id`
- 禁止使用 `onclick` 等内联事件处理器，统一在 JS 中使用 `addEventListener`

### 2.4 无障碍
- 所有交互元素必须有 `aria-label` 或可见文本
- 图标按钮至少设置 `aria-label`
- 模态框使用 `role="dialog"` + `aria-modal="true"`

---

## 3. CSS 规范

### 3.1 变量体系
- 所有颜色、间距、字体大小、圆角等设计 Token 统一在 `common.css` 中通过 `:root` CSS 变量定义
- 变量命名格式: `--{category}-{property}[-{variant}]`
  ```css
  --color-bg-main: #0a0e17;
  --color-accent: #00d4ff;
  --space-md: 16px;
  --radius-sm: 6px;
  --font-display: 'Orbitron', sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  ```

### 3.2 命名约定
- 类名使用 kebab-case: `.task-card`, `.reward-card`, `.points-ring`
- 状态类使用 `is-` 前缀: `.is-active`, `.is-completed`, `.is-expired`
- 修饰类使用 `--` 分隔: `.task-card--daily`, `.task-card--timed`
- 避免超过 3 层嵌套选择器

### 3.3 布局规范
- 移动端优先: 基础样式为 `< 768px`，使用 `@media (min-width: 768px)` 覆盖
- 网格使用 CSS Grid 或 Flexbox，禁止使用 float 布局
- 卡片间距使用 `gap` 属性

### 3.4 动画规范
- 入场动画时长 200-300ms，出场 150-200ms
- 使用 `@keyframes` 定义动画，通过类名触发
- 连续动画（如脉冲、旋转）使用 `animation` + `infinite`
- 页面切换使用 `opacity` + `transform`，禁止动画 `width/height`

### 3.5 性能
- 阴影和发光效果使用 `box-shadow` + `filter`，避免使用 `box-shadow` spread 过大（≤20px）
- 动画属性限定为 `opacity` 和 `transform`（GPU 加速）

---

## 4. JavaScript 规范

### 4.1 模块模式
- 每个 JS 文件使用 IIFE 或 ES Module 封装命名空间:
  ```js
  const AppStore = (() => {
    // private
    const db = firebase.firestore();
    // public API
    return { getTasks, addTask, updateTask };
  })();
  ```
- 模块间依赖通过命名空间调用（如 `AppStore.getTasks()`），禁止全局变量泄露

### 4.2 异步操作
- Firebase 操作统一使用 `async/await`
- 所有 Firestore 读写必须有 `.catch()` 处理或 `try/catch` 包裹
- 网络请求期间的 UI 状态: 按钮禁用 + loading 动画

### 4.3 DOM 操作
- 使用 `document.querySelector()` / `querySelectorAll()`
- 批量插入使用 `DocumentFragment` 或 `innerHTML`（仅对可信数据源）
- 事件委托: 列表容器使用单一 `addEventListener` 处理子元素事件

### 4.4 数据流
- 单向数据流:
  1. 用户操作 → 调用 Store 方法 → 更新 Firestore
  2. Firestore 实时监听 `onSnapshot` → 更新 UI
- 禁止直接操作 DOM 来反映数据变化，必须通过 render 函数

### 4.5 命名约定
- 函数: camelCase (`getActiveTasks`, `claimPoints`)
- 常量: UPPER_SNAKE_CASE (`MAX_STREAK_MULTIPLIER`, `DAILY_RESET_HOUR`)
- 模块命名空间: PascalCase (`AppStore`, `PointsManager`)
- DOM 元素引用变量以 `$` 前缀: `$taskList`, `$pointsDisplay`

### 4.6 时间处理
- 所有日期计算使用 UTC 时间戳 (`Date.now()` / `Firestore Timestamp`)
- 显示时转换为本地时区
- "当天24:00" 的计算: `new Date(d).setHours(24, 0, 0, 0)`

---

## 5. Firebase 使用规范

### 5.1 初始化
- Firebase 配置对象集中在 `firebase-config.js`
- 使用 `firebase.initializeApp(config)` 单次初始化
- Anonymous Auth 在应用启动时自动执行 `signInAnonymously()`

### 5.2 数据结构
- 文档 ID 使用 Firestore 自动生成（短 ID 用于任务/奖励/日志）
- 配置类文档使用固定 ID（如 `"config"`）
- Timestamp 类型统一使用 Firestore `firebase.firestore.Timestamp`

### 5.3 读写模式
- 页面数据使用 `onSnapshot` 实时监听（任务列表、奖励列表、积分配置）
- 写操作使用 `set()` / `update()` / `add()` / `delete()`
- 批量写入使用 `batch()` 或 `runTransaction()` 确保一致性

### 5.4 安全
- `firebase-config.js` 中的配置信息可公开（Firebase 设计如此）
- 安全控制通过 Firestore Rules 实现，不在客户端做权限判断
- 管理员 PIN 的 SHA-256 哈希计算使用 `crypto.subtle.digest('SHA-256', data)`

---

## 6. 注释规范

- 仅在 WHY 不明显时添加注释（业务逻辑背景、数值魔数的来源、Firestore 查询的考量）
- 禁止注释 WHAT（函数名和变量名已说明）
- 禁止注释 WHO（`// added by XXX`）
- 禁止注释掉不再使用的代码块 — 直接删除
- Firestore 数据结构在每个集合的首次写入处附一行结构注释

---

## 7. 禁止事项

- 禁止使用 `alert()` / `confirm()` / `prompt()` — 使用自定义 Toast/Modal
- 禁止在 JS 中硬编码 CSS 样式值 — 通过 class 切换控制
- 禁止使用 `eval()` 或 `new Function()`
- 禁止使用 `document.write()`
- 禁止在循环中进行 DOM 操作 — 先构建再一次性插入
- 禁止使用 `var` — 使用 `const` 或 `let`
- 禁止 == 运算符 — 使用 === 和 !==
