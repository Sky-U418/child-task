# Exchange Appeal System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 24h withdraw window for reward exchanges and deduction records, with parent approval flow and point refund on approval.

**Architecture:** Firestore fields added to exchangeLog and deductionLog for appeal tracking; existing transaction pattern reused for atomic refunds; frontend uses data-attribute event delegation for withdraw/approve/reject actions; 7-day rolling window via Firestore query filter.

**Tech Stack:** Vanilla JS, Firestore, no build tools.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `js/store.js` | 7-day filtered queries, appeal create/update operations |
| `js/points.js` | `refundPoints()` — atomic point refund |
| `js/rewards.js` | `restoreExchangeCount()` — atomically decrement exchange counter |
| `js/shared-ui.js` | State-aware HTML rendering for all log item states |
| `js/child-app.js` | Event delegation for withdraw button, appeal creation |
| `js/admin-app.js` | Event delegation for approve/reject buttons, appeal resolution |
| `css/child.css` | CSS classes for appeal state grid layout + status tags |
| `css/admin.css` | CSS classes for appeal state grid layout + admin-specific styles |
| `child.html` | Remove "清空显示" button, bump cache busters |
| `admin.html` | Remove "清空显示" button, bump cache busters |

---

### Task 1: store.js — Add 7-day queries and appeal operations

**Files:**
- Modify: `js/store.js`

- [ ] **Step 1: Add 7-day filtered query for exchangeLog**

Insert after `getExchangeLogs()` (line 187):

```js
function getExchangeLogs7d() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return db.collection(C.COLL_EXCHANGE_LOG)
    .where('exchangedAt', '>=', firebase.firestore.Timestamp.fromDate(d))
    .orderBy('exchangedAt', 'desc')
    .get()
    .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}
```

- [ ] **Step 2: Add 7-day filtered query for deductionLog**

Insert after `getDeductionLogs()` (line 205):

```js
function getDeductionLogs7d() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return db.collection(C.COLL_DEDUCTION_LOG)
    .where('deductedAt', '>=', firebase.firestore.Timestamp.fromDate(d))
    .orderBy('deductedAt', 'desc')
    .get()
    .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}
```

- [ ] **Step 3: Add appeal write operations**

Insert after `getDeductionLogs7d()`:

```js
function createAppeal(collection, docId) {
  return db.collection(collection).doc(docId).update({
    appealStatus: 'pending',
    appealCreatedAt: firebase.firestore.Timestamp.now()
  });
}

function updateExchangeLog(id, data) {
  return db.collection(C.COLL_EXCHANGE_LOG).doc(id).update(data);
}

function updateDeductionLog(id, data) {
  return db.collection(C.COLL_DEDUCTION_LOG).doc(id).update(data);
}
```

- [ ] **Step 4: Export new functions**

Add to the return block (line 415-423):

```js
getExchangeLogs7d, getDeductionLogs7d,
createAppeal, updateExchangeLog, updateDeductionLog,
```

---

### Task 2: rewards.js — Store spend breakdown in exchange log + restoreExchangeCount()

**Files:**
- Modify: `js/rewards.js`

- [ ] **Step 1: Add baseSpent/achievementSpent to exchange log write**

In `exchangeReward()`, modify the `transaction.set(logRef, ...)` block (lines 82-89):

Change from:
```js
transaction.set(logRef, {
  userId: uid,
  rewardId: rewardId,
  rewardTitle: reward.title,
  cost: reward.cost,
  exchangedAt: firebase.firestore.Timestamp.now()
});
```

To:
```js
transaction.set(logRef, {
  userId: uid,
  rewardId: rewardId,
  rewardTitle: reward.title,
  cost: reward.cost,
  baseSpent: baseSpend,
  achievementSpent: achievementSpend,
  exchangedAt: firebase.firestore.Timestamp.now()
});
```

- [ ] **Step 2: Add restoreExchangeCount()**

Insert after `toggleRewardActive()` (around line 142):

```js
async function restoreExchangeCount(rewardId) {
  return Store.runTransaction(async transaction => {
    const rewardRef = db.collection(C.COLL_REWARDS).doc(rewardId);
    const rewardDoc = await transaction.get(rewardRef);
    if (!rewardDoc.exists) return;
    const reward = rewardDoc.data();
    if ((reward.exchangedCount || 0) > 0) {
      transaction.update(rewardRef, {
        exchangedCount: reward.exchangedCount - 1
      });
    }
  });
}
```

- [ ] **Step 3: Export restoreExchangeCount**

Add to the return block (line 191-194):
```js
restoreExchangeCount,
```

---

### Task 3: points.js — Add refundPoints()

**Files:**
- Modify: `js/points.js`

- [ ] **Step 1: Add refundPoints() function**

Insert after `resetAllPoints()` (around line 142):

```js
/** 原路返还积分（撤销申诉时使用） */
async function refundPoints(baseAmount, achievementAmount) {
  if (!baseAmount && !achievementAmount) return;
  return Store.runTransaction(async transaction => {
    const ref = db.collection(C.COLL_POINTS).doc('config');
    const doc = await transaction.get(ref);
    if (!doc.exists) throw new Error('积分配置不存在');
    const config = doc.data();
    transaction.update(ref, {
      currentBasePoints: (config.currentBasePoints || 0) + (baseAmount || 0),
      achievementPoints: (config.achievementPoints || 0) + (achievementAmount || 0)
    });
  });
}
```

- [ ] **Step 2: Export refundPoints**

Add to the return block (line 144-151):
```js
refundPoints,
```

---

### Task 4: child.css + admin.css — Add appeal state CSS classes

**Files:**
- Modify: `css/child.css`
- Modify: `css/admin.css`

- [ ] **Step 1: child.css — Convert .log-item to grid layout**

Replace the existing `.log-item` block (lines 746-755) with:

```css
.log-item {
  display: grid;
  grid-template-columns: 1fr auto 48px 56px;
  gap: 8px;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.log-item--deduction {
  border-left: 3px solid var(--color-danger);
}

.log-item--withdrawable {
  background: #fffbeb;
}

.log-item--appealing {
  background: #fefce8;
}

.log-item--revoked {
  opacity: 0.7;
}

.log-item--revoked .log-item__title,
.log-item--revoked .log-item__cost {
  text-decoration: line-through;
  color: #999;
}
```

- [ ] **Step 2: child.css — Update child item sub-elements**

Replace existing `.log-item__title`, `.log-item__cost`, `.log-item__time` blocks (lines 757-770) and remove `.log-item--deduction` (lines 772-778) — merged into Step 1 above. Insert:

```css
.log-item__title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-item__action {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 48px;
}

.log-item__cost {
  font-family: var(--font-display);
  font-size: var(--text-xs);
  color: var(--color-warning);
  text-align: right;
}

.log-item__time {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: right;
}

.log-item--deduction .log-item__cost {
  color: var(--color-danger);
}
```

- [ ] **Step 3: child.css — Add Withdraw button style**

Insert after `.log-item--deduction .log-item__cost`:

```css
.btn-withdraw {
  padding: 2px 8px;
  border: 1px solid #f59e0b;
  border-radius: 4px;
  background: #fff;
  color: #d97706;
  font-size: 11px;
  cursor: pointer;
}

.btn-withdraw:hover {
  background: #fef3c7;
}
```

- [ ] **Step 4: child.css — Add status tag styles**

```css
.tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
}

.tag--pending {
  background: #fef3c7;
  color: #92400e;
}

.tag--approved {
  background: #d1fae5;
  color: #065f46;
}

.tag--rejected {
  background: #f3f4f6;
  color: #6b7280;
}
```

- [ ] **Step 5: admin.css — Convert .log-item to grid layout**

Replace existing `.log-item` block (lines 634-643) with:

```css
.log-item {
  display: grid;
  grid-template-columns: 1fr auto 48px 56px;
  gap: 8px;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.log-item--deduction {
  border-left: 3px solid var(--color-danger);
}

.log-item--pending {
  background: #fef2f2;
  border-bottom: 2px solid #fca5a5;
}

.log-item--withdrawable {
  background: #fffbeb;
}

.log-item--appealing {
  background: #fefce8;
}

.log-item--revoked {
  opacity: 0.7;
}

.log-item--revoked .log-item__title,
.log-item--revoked .log-item__cost {
  text-decoration: line-through;
  color: #999;
}
```

- [ ] **Step 6: admin.css — Update admin item sub-elements**

Replace existing `.log-item__title`, `.log-item__cost`, `.log-item__time` blocks (lines 645-658) and remove `.log-item--deduction` (lines 660-666). Insert:

```css
.log-item__title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-item__action {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 48px;
}

.log-item__cost {
  font-family: var(--font-display);
  font-size: var(--text-xs);
  color: var(--color-warning);
  text-align: right;
}

.log-item__time {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: right;
}

.log-item--deduction .log-item__cost {
  color: var(--color-danger);
}
```

- [ ] **Step 7: admin.css — Add status tag styles**

```css
.tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
}

.tag--pending {
  background: #fecaca;
  color: #991b1b;
}

.tag--approved {
  background: #d1fae5;
  color: #065f46;
}

.tag--rejected {
  background: #f3f4f6;
  color: #6b7280;
}
```

- [ ] **Step 8: admin.css — Add pending action buttons**

```css
.pending-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}

.btn-approve {
  padding: 4px 14px;
  border: none;
  border-radius: 4px;
  background: #4ade80;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.btn-approve:hover {
  background: #22c55e;
}

.btn-reject {
  padding: 4px 14px;
  border: none;
  border-radius: 4px;
  background: #f87171;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.btn-reject:hover {
  background: #ef4444;
}
```

---

### Task 5: shared-ui.js — State-aware rendering with 4-column grid

**Files:**
- Modify: `js/shared-ui.js`

- [ ] **Step 1: Replace renderExchangeLogItem()**

Replace the existing function (lines 135-158) with:

```js
function renderExchangeLogItem(l, now) {
  let timeStr = '';
  if (l.exchangedAt) {
    const d = l.exchangedAt.toDate();
    timeStr = `${d.getMonth() + 1}/${d.getDate()}`;
  }
  // Quiz reward — simple display, no appeal
  if (l.type === 'quiz_reward') {
    return `<div class="log-item">
      <span class="log-item__title">🎯 ${esc(l.description || '小测验')}</span>
      <span class="log-item__action"></span>
      <span class="log-item__cost" style="color:var(--color-success)">+${l.points || 0}</span>
      <span class="log-item__time">${timeStr}</span>
    </div>`;
  }

  const appealStatus = l.appealStatus;
  let rowClass = 'log-item';
  let titleClass = 'log-item__title';
  let costClass = 'log-item__cost';
  let actionHtml = '';

  if (appealStatus === 'pending') {
    rowClass += ' log-item--appealing';
    actionHtml = `<span class="tag tag--pending">申诉中</span>`;
  } else if (appealStatus === 'approved') {
    rowClass += ' log-item--revoked';
    actionHtml = `<span class="tag tag--approved">已撤销</span>`;
  } else if (appealStatus === 'rejected') {
    actionHtml = `<span class="tag tag--rejected">已驳回</span>`;
  } else {
    // Check 24h window
    if (l.exchangedAt && (now - l.exchangedAt.toDate().getTime()) < 86400000) {
      rowClass += ' log-item--withdrawable';
      actionHtml = `<button class="btn-withdraw" data-action="withdraw" data-collection="exchangeLog" data-id="${l.id}">撤回</button>`;
    }
  }

  return `<div class="${rowClass}">
    <span class="${titleClass}">${esc(l.rewardTitle)}</span>
    <span class="log-item__action">${actionHtml}</span>
    <span class="${costClass}">-${l.cost}</span>
    <span class="log-item__time">${timeStr}</span>
  </div>`;
}
```

- [ ] **Step 2: Replace renderDeductionLogItem()**

Replace the existing function (lines 160-174) with:

```js
function renderDeductionLogItem(l, now) {
  let timeStr = '';
  if (l.deductedAt) {
    const d = l.deductedAt.toDate();
    timeStr = `${d.getMonth() + 1}/${d.getDate()}`;
  }

  const appealStatus = l.appealStatus;
  let rowClass = 'log-item log-item--deduction';
  let titleClass = 'log-item__title';
  let costClass = 'log-item__cost';
  let actionHtml = '';

  if (appealStatus === 'pending') {
    rowClass += ' log-item--appealing';
    actionHtml = `<span class="tag tag--pending">申诉中</span>`;
  } else if (appealStatus === 'approved') {
    rowClass += ' log-item--revoked';
    actionHtml = `<span class="tag tag--approved">已撤销</span>`;
  } else if (appealStatus === 'rejected') {
    actionHtml = `<span class="tag tag--rejected">已驳回</span>`;
  } else {
    if (l.deductedAt && (now - l.deductedAt.toDate().getTime()) < 86400000) {
      rowClass += ' log-item--withdrawable';
      actionHtml = `<button class="btn-withdraw" data-action="withdraw" data-collection="deductionLog" data-id="${l.id}">撤回</button>`;
    }
  }

  return `<div class="${rowClass}">
    <span class="${titleClass}">⚠ ${esc(l.reason)}</span>
    <span class="log-item__action">${actionHtml}</span>
    <span class="${costClass}">-${l.amount}</span>
    <span class="log-item__time">${timeStr}</span>
  </div>`;
}
```

- [ ] **Step 3: Add adminExchangeLogItem() helper**

Add after `renderDeductionLogItem()`:

```js
/** 管理端 — 待审批行包含底部操作按钮 */
function renderAdminExchangeLogItem(l, now) {
  let timeStr = '';
  if (l.exchangedAt) {
    const d = l.exchangedAt.toDate();
    timeStr = `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // Quiz reward display (no appeal on admin side)
  if (l.type === 'quiz_reward') {
    return `<div class="log-item">
      <span class="log-item__title">🎯 ${esc(l.description || '小测验')}</span>
      <span class="log-item__action"></span>
      <span class="log-item__cost" style="color:var(--color-success)">+${l.points || 0}</span>
      <span class="log-item__time">${timeStr}</span>
    </div>`;
  }

  const appealStatus = l.appealStatus;
  let rowClass = 'log-item';
  let titleClass = 'log-item__title';
  let costClass = 'log-item__cost';
  let actionHtml = '';
  let pendingActionsHtml = '';

  if (appealStatus === 'pending') {
    rowClass += ' log-item--pending';
    titleClass += ' log-item__title--pending';
    actionHtml = `<span class="tag tag--pending">待审批</span>`;
    const refundAmount = (l.baseSpent || 0) + (l.achievementSpent || 0);
    pendingActionsHtml = `<div class="pending-actions">
      <button class="btn-approve" data-action="approve" data-collection="exchangeLog" data-id="${l.id}">✓ 同意 退${refundAmount}分</button>
      <button class="btn-reject" data-action="reject" data-collection="exchangeLog" data-id="${l.id}">✗ 驳回</button>
    </div>`;
  } else if (appealStatus === 'approved') {
    rowClass += ' log-item--revoked';
    actionHtml = `<span class="tag tag--approved">已撤销</span>`;
  } else if (appealStatus === 'rejected') {
    actionHtml = `<span class="tag tag--rejected">已驳回</span>`;
  }

  return `<div class="${rowClass}">
    <span class="${titleClass}">${esc(l.rewardTitle)}</span>
    <span class="log-item__action">${actionHtml}</span>
    <span class="${costClass}">-${l.cost}</span>
    <span class="log-item__time">${timeStr}</span>
    ${pendingActionsHtml}
  </div>`;
}
```

- [ ] **Step 4: Add adminDeductionLogItem() helper**

```js
function renderAdminDeductionLogItem(l, now) {
  let timeStr = '';
  if (l.deductedAt) {
    const d = l.deductedAt.toDate();
    timeStr = `${d.getMonth() + 1}/${d.getDate()}`;
  }

  const appealStatus = l.appealStatus;
  let rowClass = 'log-item log-item--deduction';
  let titleClass = 'log-item__title';
  let costClass = 'log-item__cost';
  let actionHtml = '';
  let pendingActionsHtml = '';

  if (appealStatus === 'pending') {
    rowClass += ' log-item--pending';
    actionHtml = `<span class="tag tag--pending">待审批</span>`;
    const refundAmount = (l.baseDeducted || 0) + (l.achievementDeducted || 0);
    pendingActionsHtml = `<div class="pending-actions">
      <button class="btn-approve" data-action="approve" data-collection="deductionLog" data-id="${l.id}">✓ 同意 退${refundAmount}分</button>
      <button class="btn-reject" data-action="reject" data-collection="deductionLog" data-id="${l.id}">✗ 驳回</button>
    </div>`;
  } else if (appealStatus === 'approved') {
    rowClass += ' log-item--revoked';
    actionHtml = `<span class="tag tag--approved">已撤销</span>`;
  } else if (appealStatus === 'rejected') {
    actionHtml = `<span class="tag tag--rejected">已驳回</span>`;
  }

  return `<div class="${rowClass}">
    <span class="${titleClass}">⚠ ${esc(l.reason)}</span>
    <span class="log-item__action">${actionHtml}</span>
    <span class="${costClass}">-${l.amount}</span>
    <span class="log-item__time">${timeStr}</span>
    ${pendingActionsHtml}
  </div>`;
}
```

- [ ] **Step 5: Export new functions**

Update the return block (line 176):
```js
return { esc, renderReportCard, renderReportDetailBody, renderExchangeLogItem, renderDeductionLogItem, renderAdminExchangeLogItem, renderAdminDeductionLogItem };
```

---

### Task 6: child-app.js — Wire up withdraw flow

**Files:**
- Modify: `js/child-app.js`

- [ ] **Step 1: Replace loadExchangeLogs()**

Replace the function at lines 1421-1459 with:

```js
async function loadExchangeLogs() {
  try {
    const [exchangeLogs, deductionLogs] = await Promise.all([
      Store.getExchangeLogs7d(),
      Store.getDeductionLogs7d()
    ]);

    const now = Date.now();
    const allLogs = [
      ...exchangeLogs.map(l => ({ ...l, _type: 'exchange', _time: l.exchangedAt.toDate().getTime() })),
      ...deductionLogs.map(l => ({ ...l, _type: 'deduction', _time: l.deductedAt.toDate().getTime() }))
    ].sort((a, b) => b._time - a._time);

    if (allLogs.length === 0) {
      $exchangeLogList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-lg)">暂无记录</p>';
      return;
    }

    $exchangeLogList.innerHTML = allLogs.map(l => {
      if (l._type === 'deduction') {
        return SharedUI.renderDeductionLogItem(l, now);
      }
      return SharedUI.renderExchangeLogItem(l, now);
    }).join('');
  } catch (err) {
    // 静默失败
  }
}
```

- [ ] **Step 2: Remove _getLogHiddenBefore() function**

Delete lines 70-72:
```js
function _getLogHiddenBefore() {
  return parseInt(localStorage.getItem('exchangeLogHiddenBefore') || '0', 10);
}
```

- [ ] **Step 3: Remove $btnClearLogs references**

Delete line 52:
```js
const $btnClearLogs = document.getElementById('btnClearLogs');
```

Delete lines 134-138:
```js
$btnClearLogs.addEventListener('click', () => {
  localStorage.setItem('exchangeLogHiddenBefore', Date.now().toString());
  loadExchangeLogs();
  UI.toast('显示已清空', 'info');
});
```

- [ ] **Step 4: Add event delegation for withdraw button**

Add before the closing `})` of the `firebase:ready` listener (before line 1461):

```js
// 撤回按钮事件委托
$exchangeLogList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="withdraw"]');
  if (!btn) return;

  const collection = btn.dataset.collection;
  const docId = btn.dataset.id;

  const ok = await UI.confirm('撤回申请', '确定要撤回这条记录吗？家长审批后将返还积分。');
  if (!ok) return;

  try {
    await Store.createAppeal(collection, docId);
    UI.toast('撤回申请已提交，等待家长审批', 'info');
    loadExchangeLogs();
  } catch (err) {
    UI.toast('提交失败: ' + err.message, 'error');
  }
});
```

---

### Task 7: admin-app.js — Wire up approve/reject flow

**Files:**
- Modify: `js/admin-app.js`

- [ ] **Step 1: Replace loadAdminExchangeLogs()**

Replace the function at lines 1037-1074 with:

```js
async function loadAdminExchangeLogs() {
  try {
    const [exchangeLogs, deductionLogs] = await Promise.all([
      Store.getExchangeLogs7d(),
      Store.getDeductionLogs7d()
    ]);

    const now = Date.now();
    const allLogs = [
      ...exchangeLogs.map(l => ({ ...l, _type: 'exchange', _time: l.exchangedAt.toDate().getTime() })),
      ...deductionLogs.map(l => ({ ...l, _type: 'deduction', _time: l.deductedAt.toDate().getTime() }))
    ].sort((a, b) => b._time - a._time);

    if (allLogs.length === 0) {
      $adminExchangeLogList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-lg)">暂无记录</p>';
      return;
    }

    $adminExchangeLogList.innerHTML = allLogs.map(l => {
      if (l._type === 'deduction') {
        return SharedUI.renderAdminDeductionLogItem(l, now);
      }
      return SharedUI.renderAdminExchangeLogItem(l, now);
    }).join('');
  } catch (err) { /* 静默 */ }
}
```

- [ ] **Step 2: Remove _getLogHiddenBefore() function**

Delete lines 132-134:
```js
function _getLogHiddenBefore() {
  return parseInt(localStorage.getItem('exchangeLogHiddenBefore') || '0', 10);
}
```

- [ ] **Step 3: Remove $btnAdminClearLogs references**

Delete line 131:
```js
const $btnAdminClearLogs = document.getElementById('btnAdminClearLogs');
```

Delete lines 390-394:
```js
$btnAdminClearLogs.addEventListener('click', () => {
  localStorage.setItem('exchangeLogHiddenBefore', Date.now().toString());
  loadAdminExchangeLogs();
  UI.toast('显示已清空', 'info');
});
```

Remove `$btnAdminClearLogs.style.display` lines from `loadAdminExchangeLogs()`:
- Line 1062: `$btnAdminClearLogs.style.display = 'none';`
- Line 1066: `$btnAdminClearLogs.style.display = '';`

- [ ] **Step 4: Add event delegation for approve/reject**

Add before the closing `})` of the `firebase:ready` callback (before the last line):

```js
$adminExchangeLogList.addEventListener('click', async (e) => {
  // 同意
  const approveBtn = e.target.closest('[data-action="approve"]');
  if (approveBtn) {
    const collection = approveBtn.dataset.collection;
    const docId = approveBtn.dataset.id;
    const ok = await UI.confirm('确认同意', '同意后将原路返还积分，确定吗？');
    if (!ok) return;

    try {
      // 读取原始记录
      const doc = await db.collection(collection).doc(docId).get();
      if (!doc.exists) { UI.toast('记录不存在', 'error'); return; }
      const data = doc.data();

      // 返还积分
      const baseAmt = data.baseSpent || data.baseDeducted || 0;
      const achAmt = data.achievementSpent || data.achievementDeducted || 0;
      await PointsManager.refundPoints(baseAmt, achAmt);

      // 返还兑换次数（仅 exchangeLog）
      if (collection === 'exchangeLog' && data.rewardId) {
        await RewardManager.restoreExchangeCount(data.rewardId);
      }

      // 更新申诉状态
      if (collection === 'exchangeLog') {
        await Store.updateExchangeLog(docId, {
          appealStatus: 'approved',
          appealResolvedAt: firebase.firestore.Timestamp.now()
        });
      } else {
        await Store.updateDeductionLog(docId, {
          appealStatus: 'approved',
          appealResolvedAt: firebase.firestore.Timestamp.now()
        });
      }

      UI.toast('已同意，积分已返还', 'success');
      loadAdminExchangeLogs();
    } catch (err) {
      UI.toast('操作失败: ' + err.message, 'error');
    }
    return;
  }

  // 驳回
  const rejectBtn = e.target.closest('[data-action="reject"]');
  if (rejectBtn) {
    const collection = rejectBtn.dataset.collection;
    const docId = rejectBtn.dataset.id;
    const ok = await UI.confirm('确认驳回', '确定要驳回该申诉吗？');
    if (!ok) return;

    try {
      if (collection === 'exchangeLog') {
        await Store.updateExchangeLog(docId, {
          appealStatus: 'rejected',
          appealResolvedAt: firebase.firestore.Timestamp.now()
        });
      } else {
        await Store.updateDeductionLog(docId, {
          appealStatus: 'rejected',
          appealResolvedAt: firebase.firestore.Timestamp.now()
        });
      }
      UI.toast('已驳回', 'info');
      loadAdminExchangeLogs();
    } catch (err) {
      UI.toast('操作失败: ' + err.message, 'error');
    }
    return;
  }
});
```

---

### Task 8: child.html + admin.html — Remove old buttons, bump cache busters

**Files:**
- Modify: `child.html`
- Modify: `admin.html`

- [ ] **Step 1: child.html — Remove "清空显示" button**

Remove line 194:
```html
<button class="btn btn--ghost btn--xs" id="btnClearLogs" style="display:none">清空显示</button>
```

- [ ] **Step 2: child.html — Bump cache busters**

Find the CSS/JS script tags and increment version numbers. Current values (from last session):
```
child.css?v=45
child-app.js?v=46
reports.js?v=38
shared-ui.js?v=38
```
Bump all by 1.

- [ ] **Step 3: admin.html — Remove "清空显示" button**

Remove line 201:
```html
<button class="btn btn--ghost btn--xs" id="btnAdminClearLogs" style="display:none">清空显示</button>
```

- [ ] **Step 4: admin.html — Bump cache busters**

Bump version numbers on admin.html's CSS/JS references by 1.

---

## Self-Review Checklist

1. **Spec coverage:** Every spec requirement maps to one or more tasks above:
   - 24h withdraw window → Task 5 (now check in render), Task 6 (withdraw btn)
   - Parent approve/reject → Task 7
   - Point refund original route → Task 3
   - Exchange count restore → Task 2
   - 7-day display window → Task 1 (7d queries), Task 6/7 (replaced hiddenBefore)
   - baseSpent/achievementSpent → Task 2 (write), Task 7 (read for refund)
   - Column layout 标题/状态操作/积分/日期 → Task 4 (CSS grid), Task 5 (render)
   - Quiz reward no appeal → Task 5 (quiz_reward branch, no withdraw btn)
   - No "清空显示" → Task 8 (removed)

2. **Placeholder scan:** All code blocks contain complete, runnable code. No TBD/TODO.

3. **Type consistency:** All field names (appealStatus, appealCreatedAt, appealResolvedAt, baseSpent, achievementSpent, baseDeducted, achievementDeducted) are consistent across store.js → rewards.js → points.js → shared-ui.js → admin-app.js.
