# 兑换/扣分申诉撤回系统 — 设计文档

## 概述

为孩子端的奖励兑换和扣分记录增加申诉撤回功能：孩子在 24 小时内可发起撤回申请，家长在管理端审批，同意后原路返还积分和兑换次数，驳回则记录保留。7 天内的记录可见，超 7 天自动隐藏。

## 涉及端

- **孩子端** (`child.html`)：记录列表展示 +「撤回」按钮 + 状态显示
- **管理端** (`admin.html`)：待审批记录高亮 +「同意/驳回」操作按钮

## 数据模型

### ExchangeLog 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `baseSpent` | `number` | — | 兑换时从基础分扣除的数量 |
| `achievementSpent` | `number` | — | 兑换时从成就分扣除的数量 |
| `appealStatus` | `string?` | `null` | `null`(不可申诉) / `"pending"` / `"approved"` / `"rejected"` |
| `appealCreatedAt` | `Timestamp?` | `null` | 孩子发起申诉的时间 |
| `appealResolvedAt` | `Timestamp?` | `null` | 家长审批时间 |

### DeductionLog 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `appealStatus` | `string?` | `null` | 同上 |
| `appealCreatedAt` | `Timestamp?` | `null` | 同上 |
| `appealResolvedAt` | `Timestamp?` | `null` | 同上 |

DeductionLog 已有 `baseDeducted` / `achievementDeducted`，无需额外拆分字段。

## 用户界面

### 孩子端

四列布局：**标题 | 状态/操作 | 积分 | 日期**（无表头行）

| 状态 | 样式 | 说明 |
|------|------|------|
| 正常 | 白底，无操作 | 超出 24h 或测验积分 |
| 可撤回 | 浅黄底 `#fffbeb`，显示「撤回」按钮 | 24h 内的兑换/扣分 |
| 申诉中 | 浅黄底 `#fefce8`，琥珀色「申诉中」标签 | 家长尚未审批 |
| 已撤销 | 半透明 `opacity:0.7`，删除线，绿色「已撤销」标签 | 家长已同意 |
| 已驳回 | 白底，灰色「已驳回」标签 | 家长已驳回 |

超过 7 天的记录不显示（通过 Firestore 查询条件过滤）。

### 管理端

四列布局：**标题 | 状态/操作 | 积分 | 日期**

待审批行特殊处理：红色边框 `#fca5a5` + 红色背景 `#fef2f2`，行内显示红色「待审批」标签，行底部增加两个按钮：
- 「✓ 同意 退 N 分」(绿色)
- 「✗ 驳回」(红色)

非待审批行与孩子端基本一致，仅「已撤销」/「已驳回」等状态标签显示。

## 数据流

### 发起申诉

```
孩子端点击「撤回」→ 确认弹窗 → Firestore updateDoc:
  写入 appealStatus: "pending"
  写入 appealCreatedAt: serverTimestamp()
→ UI 即时更新为「申诉中」状态
```

### 审批流程（管理端）

```
家长点击「同意」→ Firestore transaction:
  1. 读 exchangeLog / deductionLog 文档 → 获取 baseSpent/achievementSpent
  2. 读 userDoc 当前积分
  3. 加回积分：currentBasePoints += baseSpent, achievementPoints += achievementSpent
  4. 更新 appealStatus = "approved", appealResolvedAt = serverTimestamp()
  5. 如是兑换撤销：读 rewardDoc，若 exchangeCount > 0 则 exchangeCount--

家长点击「驳回」→ Firestore updateDoc:
  写入 appealStatus: "rejected"
  写入 appealResolvedAt: serverTimestamp()
```

### 前端过滤

- `loadExchangeLogs()` / `loadAdminExchangeLogs()` 查询条件增加 `where('exchangedAt', '>=', sevenDaysAgo)` / `where('deductedAt', '>=', sevenDaysAgo)`
- 移除旧的 `hiddenBefore` localStorage 逻辑
- 「撤回」按钮显示条件：`appealStatus === null && (now - exchangedAt) <= 24h`
- 测验积分记录 (`type === 'quiz_reward'`) 不显示任何操作按钮

## 积分返还规则

1. **原路返回**：`baseSpent` → `currentBasePoints`，`achievementSpent` → `achievementPoints`
2. **兑换次数返还**：仅当 `rewardDoc.exchangeCount > 0` 时执行 `exchangeCount--`；若跨月已归零则跳过
3. **原子操作**：积分返还 + 状态更新 在同一 Firestore transaction 中完成

## 涉及文件

| 文件 | 改动内容 |
|------|----------|
| `js/store.js` | 新增 `createAppeal()`, `approveAppeal()`, `rejectAppeal()` 函数；修改 `getExchangeLogs()` / `getDeductionLogs()` 增加 7 天过滤 |
| `js/points.js` | 新增 `refundPoints()` 通用退款函数 |
| `js/rewards.js` | 修改 `exchangeReward()` 同时写入 `baseSpent`/`achievementSpent` 字段；新增 `restoreExchangeCount()` |
| `js/shared-ui.js` | 重写 `renderExchangeLogItem()` 和 `renderDeductionLogItem()`，支持基于 `appealStatus` 的四种渲染状态；增加「撤回」按钮回调参数 |
| `js/child-app.js` | `loadExchangeLogs()` 移除 hiddenBefore 逻辑，接入 7 天过滤；绑定撤回按钮事件 |
| `js/admin-app.js` | `loadAdminExchangeLogs()` 接入 7 天过滤；新增待审批行的同意/驳回按钮事件绑定 |
| `child.html` | 无结构改动，缓存版本号更新 |
| `admin.html` | 无结构改动，缓存版本号更新 |

## 不在此次实现范围

- 测验积分不支持申诉撤回（quiz_reward 类型跳过）
- 已撤销记录不会从 Firestore 删除，仅标记状态
- 超过 24h 不可撤回，前端不显示按钮（不额外校验服务端）
- 无消息推送通知（孩子端无实时通知，刷新后可见状态变化）
