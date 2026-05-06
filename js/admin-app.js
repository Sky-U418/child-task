// admin-app.js — 管理员模式主逻辑

document.addEventListener('firebase:ready', () => {
  const C = APP_CONFIG;

  // ========== DOM 引用 ==========
  const $pinScreen = document.getElementById('pinScreen');
  const $pinInputs = document.querySelectorAll('#pinInputs .pin-input');
  const $pinError = document.getElementById('pinError');
  const $btnPinSubmit = document.getElementById('btnPinSubmit');
  const $pinTitle = document.getElementById('pinTitle');
  const $pinDesc = document.getElementById('pinDesc');

  const $adminPanel = document.getElementById('adminPanel');
  const $btnLogout = document.getElementById('btnLogout');

  const $tabs = document.querySelectorAll('.admin-tab');
  const $panels = document.querySelectorAll('.admin-panel');

  // Stats
  const $statTotalTasks = document.getElementById('statTotalTasks');
  const $statActiveTasks = document.getElementById('statActiveTasks');
  const $statActiveRewards = document.getElementById('statActiveRewards');

  // Task
  const $taskList = document.getElementById('taskList');
  const $taskForm = document.getElementById('taskForm');
  const $taskFormTitle = document.getElementById('taskFormTitle');
  const $taskTitle = document.getElementById('taskTitle');
  const $taskDesc = document.getElementById('taskDesc');
  const $taskType = document.getElementById('taskType');
  const $taskPoints = document.getElementById('taskPoints');
  const $taskDeadline = document.getElementById('taskDeadline');
  const $deadlineGroup = document.getElementById('deadlineGroup');
  const $taskEditId = document.getElementById('taskEditId');
  const $btnAddTask = document.getElementById('btnAddTask');
  const $btnTaskCancel = document.getElementById('btnTaskCancel');
  const $btnTaskSave = document.getElementById('btnTaskSave');

  // Reward
  const $rewardList = document.getElementById('rewardList');
  const $rewardForm = document.getElementById('rewardForm');
  const $rewardFormTitle = document.getElementById('rewardFormTitle');
  const $rewardTitle = document.getElementById('rewardTitle');
  const $rewardDesc = document.getElementById('rewardDesc');
  const $rewardCost = document.getElementById('rewardCost');
  const $rewardType = document.getElementById('rewardType');
  const $rewardPeriod = document.getElementById('rewardPeriod');
  const $rewardMaxExchanges = document.getElementById('rewardMaxExchanges');
  const $periodRow = document.getElementById('periodRow');
  const $limitedRow = document.getElementById('limitedRow');
  const $rewardMaxTotal = document.getElementById('rewardMaxTotal');
  const $rewardEditId = document.getElementById('rewardEditId');
  const $btnAddReward = document.getElementById('btnAddReward');
  const $btnRewardCancel = document.getElementById('btnRewardCancel');
  const $btnRewardSave = document.getElementById('btnRewardSave');

  // Points Config
  const $cfgBasePoints = document.getElementById('cfgBasePoints');
  const $cfgAchievePoints = document.getElementById('cfgAchievePoints');
  const $cfgTotalPoints = document.getElementById('cfgTotalPoints');
  const $cfgDailyBase = document.getElementById('cfgDailyBase');
  const $cfgCap = document.getElementById('cfgCap');
  const $cfgSetBase = document.getElementById('cfgSetBase');
  const $cfgSetAchieve = document.getElementById('cfgSetAchieve');
  const $cfgNewPIN = document.getElementById('cfgNewPIN');
  const $btnSavePointsConfig = document.getElementById('btnSavePointsConfig');
  const $btnApplyManualPoints = document.getElementById('btnApplyManualPoints');
  const $btnResetAllPoints = document.getElementById('btnResetAllPoints');
  const $btnChangePIN = document.getElementById('btnChangePIN');
  const $cfgStreakDays = document.getElementById('cfgStreakDays');
  const $cfgStreakMult = document.getElementById('cfgStreakMult');
  const $cfgSetStreak = document.getElementById('cfgSetStreak');
  const $cfgSetMultiplier = document.getElementById('cfgSetMultiplier');
  const $btnSetStreak = document.getElementById('btnSetStreak');
  const $btnSetMultiplier = document.getElementById('btnSetMultiplier');
  const $btnResetStreak = document.getElementById('btnResetStreak');

  // Deduction
  const $cfgDeductAmount = document.getElementById('cfgDeductAmount');
  const $cfgDeductReason = document.getElementById('cfgDeductReason');
  const $btnDeductPoints = document.getElementById('btnDeductPoints');

  // Reports
  const $adminWeeklyCards = document.getElementById('adminWeeklyCards');
  const $adminMonthlyCard = document.getElementById('adminMonthlyCard');
  const $adminMonthLabel = document.getElementById('adminMonthLabel');
  const $btnAdminMonthPrev = document.getElementById('btnAdminMonthPrev');
  const $btnAdminMonthNext = document.getElementById('btnAdminMonthNext');

  let adminMonthOffset = 0;

  // Report detail
  const $adminReportDetailOverlay = document.getElementById('adminReportDetailOverlay');
  const $adminReportDetailTitle = document.getElementById('adminReportDetailTitle');
  const $adminReportDetailBody = document.getElementById('adminReportDetailBody');
  const $btnAdminReportDetailClose = document.getElementById('btnAdminReportDetailClose');
  let adminReportData = {};

  // Exchange log
  const $adminExchangeLogList = document.getElementById('adminExchangeLogList');
  const $adminLogHeader = document.getElementById('adminLogHeader');
  const $adminLogCollapseArrow = document.getElementById('adminLogCollapseArrow');
  const $btnAdminClearLogs = document.getElementById('btnAdminClearLogs');
  function _getLogHiddenBefore() {
    return parseInt(localStorage.getItem('exchangeLogHiddenBefore') || '0', 10);
  }

  let isFirstTime = false;
  let allTasks = [];
  let allRewards = [];

  // ========== 排序工具函数 ==========

  const ORDER_INTERVAL = Store.ORDER_INTERVAL;
  const MIN_ORDER_GAP = 0.5;

  function getNextOrder(items) {
    if (!items || items.length === 0) return ORDER_INTERVAL;
    const maxOrder = Math.max(...items.map(i => i.order || 0));
    return maxOrder + ORDER_INTERVAL;
  }

  function needsRebalance(items) {
    const sorted = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i].order || 0) - (sorted[i - 1].order || 0) < MIN_ORDER_GAP) return true;
    }
    return false;
  }

  async function rebalanceItems(items, collectionName) {
    const sorted = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
    const ops = sorted.map((item, i) => ({
      collection: collectionName,
      id: item.id,
      type: 'update',
      data: { order: ORDER_INTERVAL + i * ORDER_INTERVAL }
    }));
    await Store.batchWrite(ops);
  }

  async function handleMoveUp(collectionName, id, items) {
    const sorted = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex(i => i.id === id);
    if (idx <= 0) return;
    const current = sorted[idx];
    const prev = sorted[idx - 1];
    const currentOrder = current.order || 0;
    const prevOrder = prev.order || 0;
    const ops = [
      { collection: collectionName, id: current.id, type: 'update', data: { order: prevOrder } },
      { collection: collectionName, id: prev.id, type: 'update', data: { order: currentOrder } }
    ];
    await Store.batchWrite(ops);
    if (needsRebalance(items)) {
      await rebalanceItems(items, collectionName);
    }
  }

  async function handleMoveDown(collectionName, id, items) {
    const sorted = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex(i => i.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const current = sorted[idx];
    const next = sorted[idx + 1];
    const currentOrder = current.order || 0;
    const nextOrder = next.order || 0;
    const ops = [
      { collection: collectionName, id: current.id, type: 'update', data: { order: nextOrder } },
      { collection: collectionName, id: next.id, type: 'update', data: { order: currentOrder } }
    ];
    await Store.batchWrite(ops);
    if (needsRebalance(items)) {
      await rebalanceItems(items, collectionName);
    }
  }

  // ========== PIN 验证 ==========
  // 状态机: 'verify' | 'setup' | 'done'
  let pinState = 'verify';

  function initPinInputs() {
    $pinInputs.forEach((input, idx) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^0-9]/g, '');
        if (input.value && idx < $pinInputs.length - 1) {
          $pinInputs[idx + 1].focus();
        }
        updatePinSubmitState();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && idx > 0) {
          $pinInputs[idx - 1].focus();
        }
        if (e.key === 'Enter') {
          handlePinSubmit();
        }
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '');
        for (let i = 0; i < Math.min(pasted.length, $pinInputs.length); i++) {
          $pinInputs[i].value = pasted[i];
        }
        updatePinSubmitState();
      });
    });
  }

  function getPINValue() {
    return Array.from($pinInputs).map(i => i.value).join('');
  }

  function updatePinSubmitState() {
    const pin = getPINValue();
    const valid = pin.length >= C.PIN_MIN_LENGTH && pin.length <= C.PIN_MAX_LENGTH;
    $btnPinSubmit.disabled = !valid;
  }

  function clearPinInputs() {
    $pinInputs.forEach(i => i.value = '');
    $pinInputs[0].focus();
    updatePinSubmitState();
  }

  function showPinError(msg) {
    $pinError.textContent = msg;
    $pinInputs.forEach(i => i.classList.add('is-error'));
    setTimeout(() => $pinInputs.forEach(i => i.classList.remove('is-error')), 400);
    clearPinInputs();
  }

  async function handlePinSubmit() {
    const pin = getPINValue();
    if (pin.length < C.PIN_MIN_LENGTH) return;

    $pinError.textContent = '';
    $btnPinSubmit.disabled = true;

    try {
      if (pinState === 'verify') {
        const result = await Router.verifyPIN(pin);

        if (result.firstTime) {
          // 切换到首次设置 PIN 模式
          pinState = 'setup';
          $pinTitle.textContent = '设置管理员密码';
          $pinDesc.textContent = '请设置 4-8 位数字密码（请务必记住！）';
          $btnPinSubmit.textContent = '设置密码';
          clearPinInputs();
          return;
        }

        if (result.success) {
          pinState = 'done';
          showAdmin();
        } else {
          showPinError('密码错误，请重试');
        }
      } else if (pinState === 'setup') {
        await Router.setAdminPIN(pin);
        UI.toast('管理员密码设置成功', 'success');
        pinState = 'done';
        showAdmin();
      }
    } catch (err) {
      showPinError('操作失败: ' + err.message);
    }
    $btnPinSubmit.disabled = false;
  }

  // 绑定
  initPinInputs();
  $btnPinSubmit.addEventListener('click', handlePinSubmit);

  // 检查是否已登录
  if (Router.isAdminAuthenticated()) {
    pinState = 'done';
    showAdmin();
  } else {
    $pinInputs[0].focus();
  }

  // ========== 主面板显示 ==========

  async function showAdmin() {
    $pinScreen.style.display = 'none';
    $adminPanel.style.display = 'block';

    // 一次性迁移：为缺少 order 字段的文档补充初始值
    // 注意：不能用 Store.getTasks/getRewards，因为它们的 orderBy('order') 会过滤掉缺少 order 的文档
    try {
      const [taskSnap, rewardSnap] = await Promise.all([
        db.collection(C.COLL_TASKS).get(),
        db.collection(C.COLL_REWARDS).get()
      ]);
      const tasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const rewards = rewardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const migrateOps = [];
      if (tasks.some(t => t.order === undefined)) {
        const sorted = [...tasks].sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        sorted.forEach((t, i) => {
          migrateOps.push({
            collection: C.COLL_TASKS, id: t.id, type: 'update',
            data: { order: ORDER_INTERVAL + i * ORDER_INTERVAL }
          });
        });
      }
      if (rewards.some(r => r.order === undefined)) {
        const sorted = [...rewards].sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        sorted.forEach((r, i) => {
          migrateOps.push({
            collection: C.COLL_REWARDS, id: r.id, type: 'update',
            data: { order: ORDER_INTERVAL + i * ORDER_INTERVAL }
          });
        });
      }
      if (migrateOps.length > 0) {
        await Store.batchWrite(migrateOps);
      }
    } catch (e) { /* migration failure is non-fatal */ }

    // 实时监听
    Store.onTasksChange(tasks => {
      allTasks = tasks;
      renderTaskList();
      updateStats();
    });

    Store.onRewardsChange(rewards => {
      allRewards = rewards;
      renderRewardList();
      updateStats();
    });

    Store.onPointsConfigChange(config => {
      updatePointsDisplay(config);
    });

    Store.onStreakChange(window._uid, s => {
      updateStreakConfigDisplay(s);
    });

    // 定时检查
    await TaskManager.runScheduledChecks();
    await RewardManager.checkPeriodicReset();
    await PointsManager.grantDailyBasePoints();

    // 周报/月报
    loadAdminWeeklyReports();
    loadAdminMonthlyReport(0);

    // 兑换记录
    loadAdminExchangeLogs();

    $adminLogHeader.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      $adminExchangeLogList.classList.toggle('is-collapsed');
      $adminLogCollapseArrow.classList.toggle('is-collapsed');
    });

    $btnAdminClearLogs.addEventListener('click', () => {
      localStorage.setItem('exchangeLogHiddenBefore', Date.now().toString());
      loadAdminExchangeLogs();
      UI.toast('显示已清空', 'info');
    });
  }

  // ========== Tab 切换 ==========

  $tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      $tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const panelId = tab.dataset.panel;
      $panels.forEach(p => p.classList.remove('is-active'));
      document.getElementById('panel-' + panelId).classList.add('is-active');
    });
  });

  // ========== 统计 ==========

  function updateStats() {
    $statTotalTasks.textContent = allTasks.length;
    $statActiveTasks.textContent = allTasks.filter(t =>
      t.status === C.TASK_STATUS_IN_PROGRESS
    ).length;
    $statActiveRewards.textContent = allRewards.filter(r => r.isActive).length;
  }

  // ========== 任务管理 ==========

  function renderTaskList() {
    if (allTasks.length === 0) {
      $taskList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-xl)">暂无任务，点击上方按钮添加</p>';
      return;
    }

    $taskList.innerHTML = allTasks.map((t, idx) => {
      const statusLabels = {
        available: '可领取',
        in_progress: '进行中',
        completed: '已完成',
        closed: '已关闭'
      };
      const typeLabel = t.type === 'daily' ? '每日' : '限时';
      const typeClass = t.type === 'daily' ? 'tag--daily' : 'tag--timed';
      let deadlineStr = '';
      if (t.type === 'timed' && t.deadline) {
        const d = t.deadline.toDate();
        deadlineStr = ` 截止: ${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
      }
      const actions = [];
      actions.push(`<button class="btn btn--sm" style="background:rgba(124,92,252,0.15);color:#7c5cfc;border:1px solid rgba(124,92,252,0.3)" data-action="editTask" data-id="${t.id}">编辑</button>`);
      if (t.status === C.TASK_STATUS_IN_PROGRESS) {
        actions.push(`<button class="btn btn--success btn--sm" data-action="complete" data-id="${t.id}">标记完成</button>`);
      }
      if (t.status !== C.TASK_STATUS_CLOSED) {
        actions.push(`<button class="btn btn--ghost btn--sm" data-action="close" data-id="${t.id}">关闭</button>`);
      }
      actions.push(`<button class="btn btn--outline btn--sm" data-action="reset" data-id="${t.id}">重置任务</button>`);
      actions.push(`<button class="btn btn--danger btn--sm" data-action="delete" data-id="${t.id}">删除</button>`);

      const isFirst = idx === 0;
      const isLast = idx === allTasks.length - 1;
      actions.push(`<span class="sort-btns"><button class="btn btn--ghost btn--sm" data-action="moveUp" data-id="${t.id}" ${isFirst ? 'disabled' : ''} title="上移">▲</button><button class="btn btn--ghost btn--sm" data-action="moveDown" data-id="${t.id}" ${isLast ? 'disabled' : ''} title="下移">▼</button></span>`);

      return `
        <div class="admin-list-item">
          <div class="admin-list-item__info">
            <div class="admin-list-item__title">${SharedUI.esc(t.title)} <span class="tag ${typeClass}">${typeLabel}</span> <span class="tag tag--${t.status === 'closed' ? 'closed' : 'active'}">${statusLabels[t.status]}</span></div>
            <div class="admin-list-item__meta">
              <span>+${t.points} 积分</span>
              ${deadlineStr ? '<span>' + deadlineStr + '</span>' : ''}
              ${t.description ? '<span>' + SharedUI.esc(t.description) + '</span>' : ''}
            </div>
          </div>
          <div class="admin-list-item__actions">${actions.join('')}</div>
        </div>
      `;
    }).join('');
  }

  $taskList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'editTask') {
      const task = allTasks.find(t => t.id === id);
      if (!task) return;
      $taskEditId.value = id;
      $taskFormTitle.textContent = '编辑任务';
      $taskTitle.value = task.title || '';
      $taskDesc.value = task.description || '';
      $taskType.value = task.type || 'daily';
      $taskPoints.value = task.points || 5;
      if (task.deadline) {
        $taskDeadline.value = _fmtDate(task.deadline.toDate());
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        $taskDeadline.value = _fmtDate(tomorrow);
      }
      $deadlineGroup.style.display = task.type === 'timed' ? 'block' : 'none';
      $taskForm.style.display = 'block';
      $taskForm.scrollIntoView({ behavior: 'smooth' });
    } else if (action === 'complete') {
      await TaskManager.markCompleted(id);
      // 直接重新查询判断是否所有每日任务已完成，避免 onSnapshot 快照延迟
      const task = allTasks.find(t => t.id === id);
      if (task && task.type === C.TASK_TYPE_DAILY) {
        const fresh = await Store.getTasks();
        const dailies = fresh.filter(t => t.type === C.TASK_TYPE_DAILY);
        if (dailies.length > 0 && dailies.every(t => t.status === C.TASK_STATUS_COMPLETED || t.status === C.TASK_STATUS_CLOSED)) {
          await StreakManager.onTaskCompleted(window._uid);
        }
      }
      UI.toast('任务已标记为完成', 'success');
    } else if (action === 'close') {
      const now = firebase.firestore.Timestamp.now();
      await Store.updateTask(id, {
        status: C.TASK_STATUS_CLOSED,
        graceExpiresAt: new firebase.firestore.Timestamp(now.seconds + 86400, 0)
      });
      UI.toast('任务已关闭', 'info');
    } else if (action === 'reset') {
      const task = allTasks.find(t => t.id === id);
      if (!task) return;
      const data = { status: C.TASK_STATUS_AVAILABLE, completedAt: null };
      if (task.type === C.TASK_TYPE_DAILY) {
        const d = new Date();
        d.setHours(24, 0, 0, 0);
        data.resetAt = firebase.firestore.Timestamp.fromDate(d);
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(23, 59, 59, 999);
        data.deadline = firebase.firestore.Timestamp.fromDate(d);
      }
      await Store.updateTask(id, data);
      UI.toast('任务已重置', 'success');
    } else if (action === 'delete') {
      const ok = await UI.confirm('删除任务', '确定删除该任务吗？此操作不可撤销。');
      if (ok) {
        await TaskManager.removeTask(id);
        UI.toast('任务已删除', 'info');
      }
    } else if (action === 'moveUp') {
      await handleMoveUp(C.COLL_TASKS, id, allTasks);
    } else if (action === 'moveDown') {
      await handleMoveDown(C.COLL_TASKS, id, allTasks);
    }
  });

  // 添加/编辑任务表单
  $btnAddTask.addEventListener('click', () => {
    $taskEditId.value = '';
    $taskFormTitle.textContent = '添加任务';
    $taskTitle.value = '';
    $taskDesc.value = '';
    $taskType.value = 'daily';
    $taskPoints.value = '5';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    $taskDeadline.value = _fmtDate(tomorrow);
    $deadlineGroup.style.display = 'none';
    $taskForm.style.display = 'block';
    $taskForm.scrollIntoView({ behavior: 'smooth' });
  });

  $taskType.addEventListener('change', () => {
    $deadlineGroup.style.display = $taskType.value === 'timed' ? 'block' : 'none';
  });

  $btnTaskCancel.addEventListener('click', () => {
    $taskForm.style.display = 'none';
  });

  $btnTaskSave.addEventListener('click', async () => {
    const title = $taskTitle.value.trim();
    if (!title) { UI.toast('请输入任务名称', 'error'); return; }

    const data = {
      title,
      description: $taskDesc.value.trim(),
      type: $taskType.value,
      points: parseInt($taskPoints.value, 10)
    };

    const editId = $taskEditId.value;
    try {
      if (editId) {
        // 编辑现有任务
        if ($taskType.value === 'timed') {
          data.deadline = _dateToEndOfDay($taskDeadline.value);
        } else {
          const d = new Date();
          d.setHours(24, 0, 0, 0);
          data.resetAt = firebase.firestore.Timestamp.fromDate(d);
        }
        await Store.updateTask(editId, data);
        UI.toast('任务更新成功', 'success');
      } else {
        // 创建新任务
        await TaskManager.createTask({
          ...data,
          deadline: $taskType.value === 'timed' ? _dateToEndOfDay($taskDeadline.value) : null,
          order: getNextOrder(allTasks)
        });
        UI.toast('任务创建成功', 'success');
      }
      $taskEditId.value = '';
      $taskForm.style.display = 'none';
    } catch (err) {
      UI.toast('保存失败: ' + err.message, 'error');
    }
  });

  // ========== 奖励管理 ==========

  function renderRewardList() {
    if (allRewards.length === 0) {
      $rewardList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-xl)">暂无奖励，点击上方按钮添加</p>';
      return;
    }

    $rewardList.innerHTML = allRewards.map((r, idx) => {
      const typeLabel = r.type === 'periodic' ? '周期性' : '限次数';
      const typeClass = r.type === 'periodic' ? 'tag--periodic' : 'tag--limited';
      const periodStr = r.period === 'daily' ? '每日' : r.period === 'monthly' ? '每月' : '';
      const statusLabel = r.isActive ? '激活' : '关闭';
      const statusClass = r.isActive ? 'tag--active' : 'tag--closed';
      const actions = [];
      actions.push(`<button class="btn btn--sm" style="background:rgba(124,92,252,0.15);color:#7c5cfc;border:1px solid rgba(124,92,252,0.3)" data-action="editReward" data-id="${r.id}">编辑</button>`);
      actions.push(`<button class="btn btn--sm ${r.isActive ? 'btn--ghost' : 'btn--success'}" data-action="toggle" data-id="${r.id}">${r.isActive ? '停用' : '启用'}</button>`);
      actions.push(`<button class="btn btn--outline btn--sm" data-action="resetReward" data-id="${r.id}">重置奖励</button>`);
      actions.push(`<button class="btn btn--danger btn--sm" data-action="deleteReward" data-id="${r.id}">删除</button>`);

      const isFirst = idx === 0;
      const isLast = idx === allRewards.length - 1;
      actions.push(`<span class="sort-btns"><button class="btn btn--ghost btn--sm" data-action="moveUp" data-id="${r.id}" ${isFirst ? 'disabled' : ''} title="上移">▲</button><button class="btn btn--ghost btn--sm" data-action="moveDown" data-id="${r.id}" ${isLast ? 'disabled' : ''} title="下移">▼</button></span>`);

      return `
        <div class="admin-list-item">
          <div class="admin-list-item__info">
            <div class="admin-list-item__title">${SharedUI.esc(r.title)} <span class="tag ${typeClass}">${typeLabel}${periodStr ? ' · ' + periodStr : ''}</span> <span class="tag ${statusClass}">${statusLabel}</span></div>
            <div class="admin-list-item__meta">
              <span>${r.cost} 积分</span>
              <span>已兑换: ${r.exchangedCount}/${r.maxExchanges}</span>
              ${r.description ? '<span>' + SharedUI.esc(r.description) + '</span>' : ''}
            </div>
          </div>
          <div class="admin-list-item__actions">${actions.join('')}</div>
        </div>
      `;
    }).join('');
  }

  $rewardList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'editReward') {
      const reward = allRewards.find(r => r.id === id);
      if (!reward) return;
      $rewardEditId.value = id;
      $rewardFormTitle.textContent = '编辑奖励';
      $rewardTitle.value = reward.title || '';
      $rewardDesc.value = reward.description || '';
      $rewardCost.value = reward.cost || 20;
      $rewardType.value = reward.type || 'periodic';
      if (reward.type === 'periodic') {
        $rewardPeriod.value = reward.period || 'daily';
        $rewardMaxExchanges.value = reward.maxExchanges || 1;
        $periodRow.style.display = 'flex';
        $limitedRow.style.display = 'none';
      } else {
        $rewardMaxTotal.value = reward.maxExchanges || 3;
        $periodRow.style.display = 'none';
        $limitedRow.style.display = 'flex';
      }
      $rewardForm.style.display = 'block';
      $rewardForm.scrollIntoView({ behavior: 'smooth' });
    } else if (action === 'toggle') {
      const reward = allRewards.find(r => r.id === id);
      if (reward) {
        const newActive = !reward.isActive;
        const toggleData = { isActive: newActive };
        if (!newActive) {
          toggleData.disabledAt = firebase.firestore.Timestamp.now();
        } else {
          toggleData.disabledAt = null;
          toggleData.exhaustedAt = null;
        }
        await Store.updateReward(id, toggleData);
        UI.toast(reward.isActive ? '奖励已停用' : '奖励已启用', 'info');
      }
    } else if (action === 'resetReward') {
      await RewardManager.resetLimitedReward(id);
      UI.toast('奖励已重置', 'success');
    } else if (action === 'deleteReward') {
      const ok = await UI.confirm('删除奖励', '确定删除该奖励吗？');
      if (ok) {
        await RewardManager.removeReward(id);
        UI.toast('奖励已删除', 'info');
      }
    } else if (action === 'moveUp') {
      await handleMoveUp(C.COLL_REWARDS, id, allRewards);
    } else if (action === 'moveDown') {
      await handleMoveDown(C.COLL_REWARDS, id, allRewards);
    }
  });

  // 添加奖励表单
  $btnAddReward.addEventListener('click', () => {
    $rewardEditId.value = '';
    $rewardFormTitle.textContent = '添加奖励';
    $rewardTitle.value = '';
    $rewardDesc.value = '';
    $rewardCost.value = '20';
    $rewardType.value = 'periodic';
    $rewardPeriod.value = 'daily';
    $rewardMaxExchanges.value = '1';
    $rewardMaxTotal.value = '3';
    $periodRow.style.display = 'flex';
    $limitedRow.style.display = 'none';
    $rewardForm.style.display = 'block';
    $rewardForm.scrollIntoView({ behavior: 'smooth' });
  });

  $rewardType.addEventListener('change', () => {
    if ($rewardType.value === 'periodic') {
      $periodRow.style.display = 'flex';
      $limitedRow.style.display = 'none';
    } else {
      $periodRow.style.display = 'none';
      $limitedRow.style.display = 'flex';
    }
  });

  $btnRewardCancel.addEventListener('click', () => {
    $rewardForm.style.display = 'none';
  });

  $btnRewardSave.addEventListener('click', async () => {
    const title = $rewardTitle.value.trim();
    if (!title) { UI.toast('请输入奖励名称', 'error'); return; }

    const data = {
      title,
      description: $rewardDesc.value.trim(),
      cost: parseInt($rewardCost.value, 10),
      type: $rewardType.value,
      period: $rewardType.value === 'periodic' ? $rewardPeriod.value : null,
      maxExchanges: parseInt(
        $rewardType.value === 'periodic' ? $rewardMaxExchanges.value : $rewardMaxTotal.value,
        10
      )
    };

    const editId = $rewardEditId.value;
    try {
      if (editId) {
        await Store.updateReward(editId, data);
        UI.toast('奖励更新成功', 'success');
      } else {
        await RewardManager.createReward({ ...data, order: getNextOrder(allRewards) });
        UI.toast('奖励创建成功', 'success');
      }
      $rewardEditId.value = '';
      $rewardForm.style.display = 'none';
    } catch (err) {
      UI.toast('保存失败: ' + err.message, 'error');
    }
  });

  // ========== 积分配置 ==========

  function updatePointsDisplay(config) {
    if (!config) return;
    $cfgBasePoints.textContent = config.currentBasePoints || 0;
    $cfgAchievePoints.textContent = config.achievementPoints || 0;
    $cfgTotalPoints.textContent = (config.currentBasePoints || 0) + (config.achievementPoints || 0);
    $cfgDailyBase.value = config.dailyBasePoints || 10;
    $cfgCap.value = config.basePointsCap || 100;
    $cfgSetBase.value = config.currentBasePoints || 0;
    $cfgSetAchieve.value = config.achievementPoints || 0;
  }

  $btnSavePointsConfig.addEventListener('click', async () => {
    try {
      await Store.updatePointsConfig({
        dailyBasePoints: parseInt($cfgDailyBase.value, 10) || 10,
        basePointsCap: parseInt($cfgCap.value, 10) || 100
      });
      UI.toast('积分配置已保存', 'success');
    } catch (err) {
      UI.toast('保存失败: ' + err.message, 'error');
    }
  });

  $btnApplyManualPoints.addEventListener('click', async () => {
    const ok = await UI.confirm('修改积分', '确定要手动修改积分余额吗？');
    if (!ok) return;
    try {
      await Store.updatePointsConfig({
        currentBasePoints: parseInt($cfgSetBase.value, 10) || 0,
        achievementPoints: parseInt($cfgSetAchieve.value, 10) || 0
      });
      UI.toast('积分已更新', 'success');
    } catch (err) {
      UI.toast('更新失败: ' + err.message, 'error');
    }
  });

  $btnResetAllPoints.addEventListener('click', async () => {
    const ok = await UI.confirm('重置积分', '确定要清空所有积分吗？此操作不可撤销！');
    if (!ok) return;
    try {
      await PointsManager.resetAllPoints();
      UI.toast('积分已全部重置', 'info');
    } catch (err) {
      UI.toast('重置失败: ' + err.message, 'error');
    }
  });

  $btnChangePIN.addEventListener('click', async () => {
    const newPIN = $cfgNewPIN.value.trim();
    if (!newPIN) { UI.toast('请输入新 PIN', 'error'); return; }
    try {
      await Router.setAdminPIN(newPIN);
      UI.toast('PIN 修改成功', 'success');
      $cfgNewPIN.value = '';
    } catch (err) {
      UI.toast('修改失败: ' + err.message, 'error');
    }
  });

  // ========== 打卡倍率管理 ==========

  function updateStreakConfigDisplay(s) {
    if (!s) return;
    $cfgStreakDays.textContent = s.currentStreak || 0;
    $cfgStreakMult.textContent = StreakManager.getTodayMultiplier(s).toFixed(1) + 'x';
    $cfgSetStreak.value = s.currentStreak || 0;
    $cfgSetMultiplier.value = StreakManager.getTodayMultiplier(s);
  }

  $btnSetStreak.addEventListener('click', async () => {
    const days = parseInt($cfgSetStreak.value, 10) || 0;
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    // 设置连续天数为 days，并将 lastTaskDate 设为昨天以激活倍率
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.getFullYear() + '-' +
      String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');

    const mult = days > 0 ? StreakManager.calcMultiplier(days) : 1.0;
    await Store.setStreak(window._uid, {
      currentStreak: days,
      lastTaskDate: yesterdayStr,
      maxStreak: Math.max(days, 0),
      multiplier: mult
    });
    UI.toast(`连续天数已设为 ${days}，倍率 ${mult.toFixed(1)}x`, 'success');
  });

  $btnSetMultiplier.addEventListener('click', async () => {
    const mult = parseFloat($cfgSetMultiplier.value) || 1.0;
    const clampedMult = Math.round(Math.min(Math.max(mult, 1.0), C.MAX_STREAK_MULTIPLIER) * 100) / 100;
    const days = Math.round((clampedMult - 1.0) / C.STREAK_INCREMENT);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.getFullYear() + '-' +
      String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');

    await Store.setStreak(window._uid, {
      currentStreak: days,
      lastTaskDate: yesterdayStr,
      maxStreak: Math.max(days, 0),
      multiplier: clampedMult
    });
    UI.toast(`倍率已设为 ${clampedMult.toFixed(1)}x（连续 ${days} 天）`, 'success');
  });

  $btnResetStreak.addEventListener('click', async () => {
    const ok = await UI.confirm('重置打卡', '确定要重置连续打卡数据吗？倍率将回到 1.0x。');
    if (!ok) return;
    await Store.setStreak(window._uid, {
      currentStreak: 0,
      lastTaskDate: '',
      maxStreak: 0,
      multiplier: 1.0
    });
    UI.toast('打卡数据已重置', 'info');
  });

  // ========== 扣分处理 ==========

  $btnDeductPoints.addEventListener('click', async () => {
    const amount = parseInt($cfgDeductAmount.value, 10);
    const reason = $cfgDeductReason.value.trim();

    if (!amount || amount <= 0) { UI.toast('请输入有效的扣除积分数', 'error'); return; }
    if (!reason) { UI.toast('请输入扣除理由', 'error'); return; }

    const ok = await UI.confirm('确认扣分', `确定要扣除 ${amount} 积分吗？理由：「${reason}」`);
    if (!ok) return;

    try {
      const result = await PointsManager.deductPoints(amount, reason, window._uid);
      const msg = result.actualDeduct < amount
        ? `已扣除 ${result.actualDeduct} 积分（可用积分不足，已归零）`
        : `已扣除 ${result.actualDeduct} 积分`;
      UI.toast(msg, 'info');
      $cfgDeductAmount.value = '';
      $cfgDeductReason.value = '';
      loadAdminExchangeLogs();
    } catch (err) {
      UI.toast('扣分失败: ' + err.message, 'error');
    }
  });

  // ========== 退出 ==========

  $btnLogout.addEventListener('click', () => {
    Router.logoutAdmin();
  });

  // ========== 报告 ==========

  async function loadAdminWeeklyReports() {
    try {
      const thisWeek = ReportManager.getWeekRange(new Date());
      const lastWeek = ReportManager.getLastWeekRange();
      const [thisData, lastData] = await Promise.all([
        ReportManager.computeReport(window._uid, thisWeek.start, thisWeek.end),
        ReportManager.computeReport(window._uid, lastWeek.start, lastWeek.end)
      ]);
      adminReportData.lastWeek = lastData;
      adminReportData.thisWeek = thisData;
      $adminWeeklyCards.innerHTML =
        SharedUI.renderReportCard(lastData, 'lastWeek') +
        SharedUI.renderReportCard(thisData, 'thisWeek');
    } catch (err) { _handleReportError(err, $adminWeeklyCards); }
  }

  async function loadAdminMonthlyReport(monthOffset) {
    try {
      adminMonthOffset = monthOffset;
      const range = ReportManager.getMonthRangeByOffset(monthOffset);
      const data = await ReportManager.computeReport(window._uid, range.start, range.end);
      adminReportData.monthly = data;
      const startDate = new Date(range.start + 'T00:00:00');
      $adminMonthLabel.textContent = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`;
      $adminMonthlyCard.innerHTML = SharedUI.renderReportCard(data, 'monthly');
      $btnAdminMonthNext.disabled = (monthOffset === 0);
      $btnAdminMonthNext.style.opacity = monthOffset === 0 ? '0.3' : '';
    } catch (err) { _handleReportError(err, $adminMonthlyCard); }
  }

  function _handleReportError(err, $container) {
    console.error('报告加载失败:', err);
    const msg = err.message || '';
    if (msg.includes('index') || msg.includes('FAILED_PRECONDITION')) {
      const urlMatch = msg.match(/https?:\/\/[^\s]+/);
      const link = urlMatch ? urlMatch[0] : '';
      $container.innerHTML = `<p style="color:var(--color-danger);text-align:center;padding:var(--space-md);font-size:var(--text-sm)">
        数据库索引未创建。<br>请在 Firebase Console 中创建复合索引：<br>
        ${link ? `<a href="${link}" target="_blank" rel="noopener" style="color:var(--color-accent);word-break:break-all">点击创建索引</a>` : '请检查 taskLog 和 exchangeLog 集合的复合索引'}
      </p>`;
    } else {
      $container.innerHTML = `<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-md)">报告加载失败，请刷新重试</p>`;
    }
  }

  $btnAdminMonthPrev.addEventListener('click', () => loadAdminMonthlyReport(adminMonthOffset - 1));
  $btnAdminMonthNext.addEventListener('click', () => {
    if (adminMonthOffset < 0) loadAdminMonthlyReport(adminMonthOffset + 1);
  });

  // 报告数字点击 → 弹详情
  $adminWeeklyCards.addEventListener('click', (e) => {
    const val = e.target.closest('.report-card__stat-value');
    if (!val) return;
    showAdminReportDetail(val.dataset.reportKey, val.dataset.stat);
  });
  $adminMonthlyCard.addEventListener('click', (e) => {
    const val = e.target.closest('.report-card__stat-value');
    if (!val) return;
    showAdminReportDetail(val.dataset.reportKey, val.dataset.stat);
  });

  $btnAdminReportDetailClose.addEventListener('click', () => {
    $adminReportDetailOverlay.style.display = 'none';
  });
  $adminReportDetailOverlay.addEventListener('click', (e) => {
    if (e.target === $adminReportDetailOverlay) {
      $adminReportDetailOverlay.style.display = 'none';
    }
  });

  function showAdminReportDetail(reportKey, stat) {
    const r = adminReportData[reportKey];
    if (!r) return;

    const startDate = new Date(r.periodStart + 'T00:00:00');
    const endDate = new Date(r.periodEnd + 'T00:00:00');
    const rangeStr = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;

    const statLabels = {
      checkInDays: '打卡天数',
      maxStreakInPeriod: '最长连续',
      tasksCompleted: '完成任务',
      pointsEarned: '获得积分',
      rewardsExchanged: '兑换奖励',
      pointsSpent: '消耗积分'
    };

    $adminReportDetailTitle.textContent = `${statLabels[stat]} · ${rangeStr}`;
    $adminReportDetailBody.innerHTML = SharedUI.renderReportDetailBody(r, stat);
    $adminReportDetailOverlay.style.display = 'flex';
  }

  // ========== 兑换记录 ==========

  async function loadAdminExchangeLogs() {
    try {
      const [exchangeLogs, deductionLogs] = await Promise.all([
        Store.getExchangeLogs(),
        Store.getDeductionLogs()
      ]);

      const hiddenBefore = _getLogHiddenBefore();

      const visibleExchanges = hiddenBefore
        ? exchangeLogs.filter(l => l.exchangedAt.toDate().getTime() > hiddenBefore)
        : exchangeLogs;

      const visibleDeductions = hiddenBefore
        ? deductionLogs.filter(l => l.deductedAt.toDate().getTime() > hiddenBefore)
        : deductionLogs;

      // 合并并按时间倒序
      const allLogs = [
        ...visibleExchanges.map(l => ({ ...l, _type: 'exchange', _time: l.exchangedAt.toDate().getTime() })),
        ...visibleDeductions.map(l => ({ ...l, _type: 'deduction', _time: l.deductedAt.toDate().getTime() }))
      ].sort((a, b) => b._time - a._time);

      if (allLogs.length === 0) {
        $adminExchangeLogList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-lg)">暂无记录</p>';
        $btnAdminClearLogs.style.display = 'none';
        return;
      }

      $btnAdminClearLogs.style.display = '';
      $adminExchangeLogList.innerHTML = allLogs.map(l => {
        if (l._type === 'deduction') {
          return SharedUI.renderDeductionLogItem(l);
        }
        return SharedUI.renderExchangeLogItem(l);
      }).join('');
    } catch (err) { /* 静默 */ }
  }

  // ========== 工具 ==========

  function _fmtDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function _dateToEndOfDay(dateStr) {
    const d = new Date(dateStr + 'T23:59:59');
    return firebase.firestore.Timestamp.fromDate(d);
  }
});
