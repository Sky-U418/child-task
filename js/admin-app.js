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

  // Resources
  const $resUrl = document.getElementById('resUrl');
  const $resName = document.getElementById('resName');
  const $resType = document.getElementById('resType');
  const $btnAddResource = document.getElementById('btnAddResource');
  const $resourceGrid = document.getElementById('resourceGrid');

  // Blackboard
  const $bbStatus = document.getElementById('bbStatus');
  const $bbText = document.getElementById('bbText');
  const $btnBBPushText = document.getElementById('btnBBPushText');
  const $btnBBClearText = document.getElementById('btnBBClearText');
  const $btnBBClear = document.getElementById('btnBBClear');

  // Quiz
  const $quizTitle = document.getElementById('quizTitle');
  const $quizQuestions = document.getElementById('quizQuestions');
  const $quizQuestionsHint = document.getElementById('quizQuestionsHint');
  const $quizEditId = document.getElementById('quizEditId');
  const $btnAddQuestion = document.getElementById('btnAddQuestion');
  const $btnSaveQuiz = document.getElementById('btnSaveQuiz');
  const $btnCancelQuizEdit = document.getElementById('btnCancelQuizEdit');
  const $quizList = document.getElementById('quizList');
  let quizQuestionsState = [];
  let allQuizzes = [];
  var _currentBlackboard = null;

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

    // 黑板状态监听
    Store.onBlackboardChange(function(data) {
      _currentBlackboard = data;
      updateBBStatus(data);
      // 只在测验列表已加载时刷新卡片按钮状态，避免覆盖"暂无测验"
      if (allQuizzes.length > 0) renderQuizList();
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
      $taskPoints.value = task.points !== undefined ? task.points : 5;
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
          try {
            await StreakManager.onTaskCompleted(window._uid);
          } catch (err) {
            console.error('打卡更新失败:', err);
            UI.toast('任务已标记完成，但打卡记录更新失败: ' + err.message, 'error');
          }
        }
      }
      UI.toast('任务已标记为完成', 'success');
    } else if (action === 'close') {
      await Store.updateTask(id, {
        status: C.TASK_STATUS_CLOSED,
        graceExpiresAt: null
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

  // ========== 资源管理 ==========

  function renderResources(resources) {
    if (!resources || resources.length === 0) {
      $resourceGrid.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-xl)">暂无资源</p>';
      return;
    }

    $resourceGrid.innerHTML = resources.map(r => {
      let preview;
      if (r.contentType && r.contentType.startsWith('image/')) {
        preview = `<img class="resource-card__preview" src="${r.url}" alt="${SharedUI.esc(r.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="resource-card__preview resource-card__preview--icon" style="display:none">🖼️</div>`;
      } else if (r.contentType && r.contentType.startsWith('audio/')) {
        preview = `<div class="resource-card__preview resource-card__preview--icon">🎵</div>`;
      } else if (r.contentType && r.contentType.startsWith('video/')) {
        preview = `<div class="resource-card__preview resource-card__preview--icon">🎬</div>`;
      } else {
        preview = `<div class="resource-card__preview resource-card__preview--icon">📄</div>`;
      }

      return `<div class="resource-card">
        ${preview}
        <div class="resource-card__name" title="${SharedUI.esc(r.name)}">${SharedUI.esc(r.name)}</div>
        <button class="resource-card__push" data-action="pushToBB" data-id="${r.id}" data-name="${SharedUI.esc(r.name)}" data-url="${SharedUI.esc(r.url)}" data-type="${SharedUI.esc(r.contentType || '')}" aria-label="推送到黑板">📌</button>
        <button class="resource-card__delete" data-id="${r.id}" aria-label="删除资源">&times;</button>
      </div>`;
    }).join('');

    $resourceGrid.querySelectorAll('.resource-card__delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ok = await UI.confirm('确认删除', '确定要删除该资源吗？');
        if (!ok) return;
        try {
          await ResourceManager.remove(id);
          UI.toast('资源已删除', 'success');
        } catch (err) {
          UI.toast('删除失败: ' + err.message, 'error');
        }
      });
    });
  }

  Store.onResourcesChange(resources => renderResources(resources));

  // 资源卡片事件委托（推送 + 删除）
  $resourceGrid.addEventListener('click', async (e) => {
    const pushBtn = e.target.closest('.resource-card__push');
    if (pushBtn) {
      const id = pushBtn.dataset.id;
      const name = pushBtn.dataset.name;
      const url = pushBtn.dataset.url;
      const type = pushBtn.dataset.type;
      try {
        await Store.setBlackboard({
          contentType: 'resource',
          resourceId: id,
          resourceName: name,
          resourceUrl: url,
          resourceContentType: type
        });
        UI.toast('已推送到黑板', 'success');
      } catch (err) {
        UI.toast('推送失败: ' + err.message, 'error');
      }
      return;
    }
  });

  // 文字推送
  $btnBBPushText.addEventListener('click', async () => {
    const text = $bbText.value.trim();
    if (!text) { UI.toast('请输入文字内容', 'error'); return; }
    try {
      await Store.setBlackboard({
        contentType: 'text',
        textContent: text,
        resourceId: '',
        resourceName: '',
        resourceUrl: '',
        resourceContentType: ''
      });
      UI.toast('文字已推送到黑板', 'success');
    } catch (err) {
      UI.toast('推送失败: ' + err.message, 'error');
    }
  });

  // 清空文字输入
  $btnBBClearText.addEventListener('click', () => {
    $bbText.value = '';
  });

  // 清空黑板
  $btnBBClear.addEventListener('click', async () => {
    try {
      await Store.setBlackboard({
        contentType: null,
        textContent: '',
        resourceId: '',
        resourceName: '',
        resourceUrl: '',
        resourceContentType: ''
      });
      UI.toast('黑板已清空', 'info');
    } catch (err) {
      UI.toast('清空失败: ' + err.message, 'error');
    }
  });

  // ========== 测验管理 ==========

  let _questionIdCounter = 0;

  function renderQuestionForm(index, data) {
    data = data || { question: '', type: 'choice', options: ['', '', '', ''], correctIndex: 0, points: 5, timeLimit: 0, acceptableAnswers: [] };
    const qId = 'q_' + (++_questionIdCounter);
    var type = data.type || 'choice';
    var html = '<div class="quiz-question" data-qid="' + qId + '">' +
      '<div class="quiz-question__header">' +
        '<span class="quiz-question__number">第 ' + (index + 1) + ' 题</span>' +
        '<button class="quiz-question__remove" data-action="removeQuestion" data-qid="' + qId + '" title="删除此题">&times;</button>' +
      '</div>' +
      '<div class="form-group">' +
        '<input type="text" class="form-input" data-field="questionText" value="' + SharedUI.esc(data.question) + '" placeholder="输入题目，例如：1+1等于几？" maxlength="200">' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:var(--space-sm)">' +
        '<div class="quiz-type-tabs" data-field="questionType">' +
          '<button type="button" class="quiz-type-tab' + (type === 'choice' ? ' is-active' : '') + '" data-type-value="choice">选择题</button>' +
          '<button type="button" class="quiz-type-tab' + (type === 'fill' ? ' is-active' : '') + '" data-type-value="fill">填空题</button>' +
          '<button type="button" class="quiz-type-tab' + (type === 'read' ? ' is-active' : '') + '" data-type-value="read">朗读题</button>' +
        '</div>' +
      '</div>';

    if (type === 'choice') {
      html += '<div class="quiz-question__options">' +
        data.options.map(function(opt, oi) {
          return '<label class="quiz-option">' +
            '<input type="radio" class="quiz-option__input" name="correct_' + qId + '" value="' + oi + '"' + (oi === data.correctIndex ? ' checked' : '') + '>' +
            '<input type="text" class="quiz-option__text" data-field="option_' + oi + '" value="' + SharedUI.esc(opt) + '" placeholder="选项 ' + String.fromCharCode(65 + oi) + '" maxlength="100">' +
          '</label>';
        }).join('') +
      '</div>';
    } else if (type === 'fill') {
      html += '<div class="form-group">' +
        '<label class="form-label" style="font-size:var(--text-xs);color:var(--color-text-secondary)">参考答案（逗号分隔，供家长批改参考）</label>' +
        '<input type="text" class="form-input" data-field="acceptableAnswers" value="' + SharedUI.esc((data.acceptableAnswers || []).join('、')) + '" placeholder="例如：光合作用,photosynthesis" maxlength="500">' +
      '</div>';
    } else if (type === 'read') {
      html += '<p style="font-size:var(--text-xs);color:var(--color-text-muted);padding:var(--space-sm) 0">📖 孩子朗读题目内容，家长在批改面板评判</p>';
    }

    html += '<div class="quiz-question__points-row">' +
      '<span class="quiz-question__points-label">分值</span>' +
      '<input type="number" class="quiz-question__points-input" data-field="points" value="' + data.points + '" min="0" max="999">' +
      '<span class="quiz-question__points-label" style="margin-left:var(--space-md)">限时(秒)</span>' +
      '<input type="number" class="quiz-question__points-input" data-field="timeLimit" value="' + (data.timeLimit || 0) + '" min="0" max="999" title="0=不限时">' +
    '</div>' +
    '</div>';
    return html;
  }

  function collectQuestionsFromDOM() {
    var els = $quizQuestions.querySelectorAll('.quiz-question');
    var questions = [];
    els.forEach(function(el) {
      var question = el.querySelector('[data-field="questionText"]').value.trim();
      if (!question) return;
      var type = el.querySelector('.quiz-type-tab.is-active').dataset.typeValue;
      var pts = parseInt(el.querySelector('[data-field="points"]').value, 10);
      if (isNaN(pts) || pts < 0) pts = 0;

      var tlInput = el.querySelector('[data-field="timeLimit"]');
      var timeLimit = tlInput ? parseInt(tlInput.value, 10) : 0;
      if (isNaN(timeLimit) || timeLimit < 0) timeLimit = 0;
      var q = { question: question, type: type, points: pts, timeLimit: timeLimit };

      if (type === 'choice') {
        var options = [];
        for (var i = 0; i < 4; i++) {
          options.push(el.querySelector('[data-field="option_' + i + '"]').value.trim());
        }
        var selected = el.querySelector('input[type="radio"]:checked');
        var correctIndex = selected ? parseInt(selected.value, 10) : 0;
        q.options = options;
        q.correctIndex = correctIndex;
      } else if (type === 'fill') {
        var aaInput = el.querySelector('[data-field="acceptableAnswers"]');
        var aa = aaInput ? aaInput.value : '';
        q.acceptableAnswers = aa.split(/[,，、]/).map(function(s) { return s.trim(); }).filter(function(s) { return s; });
      }
      // read 类型不需要额外字段

      questions.push(q);
    });
    return questions;
  }

  /** 将 DOM 输入同步到 quizQuestionsState（保留空题，防止重渲染丢数据） */
  function syncQuizStateFromDOM() {
    var els = $quizQuestions.querySelectorAll('.quiz-question');
    var newState = [];
    els.forEach(function(el, idx) {
      var qTextInput = el.querySelector('[data-field="questionText"]');
      var typeTab = el.querySelector('.quiz-type-tab.is-active');
      var ptsInput = el.querySelector('[data-field="points"]');

      var qText = qTextInput ? qTextInput.value : '';
      var type = typeTab ? typeTab.dataset.typeValue : 'choice';
      var pts = ptsInput ? parseInt(ptsInput.value, 10) : 0;
      if (isNaN(pts) || pts < 0) pts = 0;

      // 从旧状态继承之前的数据（包括选项、答案等）
      var old = quizQuestionsState[idx] || {};

      var tlInput = el.querySelector('[data-field="timeLimit"]');
      var timeLimit = tlInput ? parseInt(tlInput.value, 10) : (old.timeLimit || 0);
      if (isNaN(timeLimit) || timeLimit < 0) timeLimit = 0;

      var entry = { question: qText, type: type, points: pts, timeLimit: timeLimit };

      if (type === 'choice') {
        // 选项输入框可能不存在（刚从其他题型切换过来），不存在则用旧值
        var opt0 = el.querySelector('[data-field="option_0"]');
        if (opt0) {
          var opts = [];
          for (var i = 0; i < 4; i++) {
            opts.push(el.querySelector('[data-field="option_' + i + '"]').value);
          }
          var selected = el.querySelector('input[type="radio"]:checked');
          var cIdx = selected ? parseInt(selected.value, 10) : 0;
          entry.options = opts;
          entry.correctIndex = cIdx;
        } else {
          entry.options = old.options || ['', '', '', ''];
          entry.correctIndex = old.correctIndex !== undefined ? old.correctIndex : 0;
        }
      } else {
        // 非选择题：继承旧状态的选项数据，防止切换回来时丢失
        entry.options = old.options || ['', '', '', ''];
        entry.correctIndex = old.correctIndex !== undefined ? old.correctIndex : 0;

        if (type === 'fill') {
          // 参考答案输入框可能不存在（刚从其他题型切换过来）
          var aaInput = el.querySelector('[data-field="acceptableAnswers"]');
          if (aaInput) {
            entry.acceptableAnswers = aaInput.value.split(/[,，、]/).map(function(s) { return s.trim(); }).filter(function(s) { return s; });
          } else {
            entry.acceptableAnswers = old.acceptableAnswers || [];
          }
        }
      }

      newState.push(entry);
    });
    quizQuestionsState = newState;
  }

  function refreshQuizQuestionsUI() {
    if (quizQuestionsState.length === 0) {
      $quizQuestions.innerHTML = '';
      $quizQuestionsHint.style.display = '';
      return;
    }
    $quizQuestionsHint.style.display = 'none';
    var html = '';
    for (var i = 0; i < quizQuestionsState.length; i++) {
      html += renderQuestionForm(i, quizQuestionsState[i]);
    }
    $quizQuestions.innerHTML = html;
  }

  $btnAddQuestion.addEventListener('click', function() {
    syncQuizStateFromDOM();
    var last = quizQuestionsState[quizQuestionsState.length - 1] || {};
    quizQuestionsState.push({
      question: '', type: 'choice',
      options: ['', '', '', ''], correctIndex: 0,
      points: last.points || 0,
      timeLimit: last.timeLimit || 0
    });
    refreshQuizQuestionsUI();
  });

  // 删除题目
  $quizQuestions.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="removeQuestion"]');
    if (!btn) return;
    syncQuizStateFromDOM();
    var qid = btn.dataset.qid;
    var els = $quizQuestions.querySelectorAll('.quiz-question');
    var idx = -1;
    for (var i = 0; i < els.length; i++) {
      if (els[i].dataset.qid === qid) { idx = i; break; }
    }
    if (idx >= 0) {
      quizQuestionsState.splice(idx, 1);
      refreshQuizQuestionsUI();
    }
  });

  // 切换题型 → 重新渲染该题
  $quizQuestions.addEventListener('click', function(e) {
    var tab = e.target.closest('.quiz-type-tab');
    if (!tab) return;
    var group = tab.closest('.quiz-type-tabs');
    if (!group) return;
    group.querySelectorAll('.quiz-type-tab').forEach(function(t) { t.classList.remove('is-active'); });
    tab.classList.add('is-active');
    syncQuizStateFromDOM();
    refreshQuizQuestionsUI();
  });

  $btnSaveQuiz.addEventListener('click', async function() {
    var title = $quizTitle.value.trim();
    if (!title) { UI.toast('请输入测验标题', 'error'); return; }

    var questions = collectQuestionsFromDOM();
    if (questions.length === 0) { UI.toast('请至少添加一道题目', 'error'); return; }

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      if (!q.question) { UI.toast('第 ' + (i + 1) + ' 题缺少题目内容', 'error'); return; }
      if (q.type === 'choice') {
        var emptyIdx = q.options.indexOf('');
        if (emptyIdx >= 0) { UI.toast('第 ' + (i + 1) + ' 题的选项 ' + String.fromCharCode(65 + emptyIdx) + ' 为空', 'error'); return; }
      }
    }

    var totalPoints = 0;
    for (var i = 0; i < questions.length; i++) {
      totalPoints += (questions[i].points !== undefined ? questions[i].points : 5);
    }
    var editId = $quizEditId.value;

    try {
      if (editId) {
        await Store.deleteQuiz(editId);
      }
      await Store.addQuiz({ title: title, questions: questions, totalPoints: totalPoints });
      UI.toast('测验已保存', 'success');
      resetQuizForm();
      loadQuizzes();
    } catch (err) {
      UI.toast('保存失败: ' + err.message, 'error');
    }
  });

  $btnCancelQuizEdit.addEventListener('click', resetQuizForm);

  function loadQuizToForm(quiz) {
    $quizTitle.value = quiz.title || '';
    $quizEditId.value = quiz.id;

    quizQuestionsState = (quiz.questions || []).map(function(q) {
      return {
        question: q.question || '',
        type: q.type || 'choice',
        options: q.options || ['', '', '', ''],
        correctIndex: q.correctIndex !== undefined ? q.correctIndex : 0,
        points: q.points || 0,
        timeLimit: q.timeLimit || 0,
        acceptableAnswers: q.acceptableAnswers || []
      };
    });
    refreshQuizQuestionsUI();
    $btnCancelQuizEdit.style.display = '';
    // 滚动到表单区域
    $quizTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetQuizForm() {
    $quizTitle.value = '';
    $quizQuestions.innerHTML = '';
    $quizQuestionsHint.style.display = '';
    $quizEditId.value = '';
    quizQuestionsState = [];
    $btnCancelQuizEdit.style.display = 'none';
  }

  async function loadQuizzes() {
    try {
      allQuizzes = await Store.getQuizzes();
      renderQuizList();
    } catch (err) {
      console.error('加载测验列表失败:', err);
    }
  }

  function renderQuizList() {
    if (allQuizzes.length === 0) {
      $quizList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-xl)">暂无测验</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < allQuizzes.length; i++) {
      var q = allQuizzes[i];
      var qCount = (q.questions && q.questions.length) || 0;
      // 统计题型分布
      var typeLabels = { choice: '选择', fill: '填空', read: '朗读' };
      var typeCount = {};
      (q.questions || []).forEach(function(x) {
        var t = x.type || 'choice';
        typeCount[t] = (typeCount[t] || 0) + 1;
      });
      var typeStr = Object.keys(typeCount).map(function(t) {
        return typeLabels[t] || t;
      }).join('+');
      var isPushed = _currentBlackboard && _currentBlackboard.contentType === 'quiz' && _currentBlackboard.quizId === q.id;
      html += '<div class="quiz-card">' +
        '<div class="quiz-card__info">' +
          '<div class="quiz-card__title">' + SharedUI.esc(q.title) + '</div>' +
          '<div class="quiz-card__meta">' + qCount + ' 题 · 共 ' + (q.totalPoints || 0) + ' 分' +
            (typeStr ? ' · ' + typeStr : '') +
          '</div>' +
        '</div>' +
        '<div class="quiz-card__actions">' +
          (isPushed
            ? '<button class="quiz-card__retract" data-action="retractQuiz" data-id="' + q.id + '" title="撤回测验">撤回</button>'
            : '<button class="quiz-card__push" data-action="pushQuiz" data-id="' + q.id + '" title="推送到黑板">📌</button>'
          ) +
          '<button class="quiz-card__edit" data-action="editQuiz" data-id="' + q.id + '" title="编辑测验">✏️</button>' +
          '<button class="quiz-card__delete" data-action="deleteQuiz" data-id="' + q.id + '" title="删除测验">&times;</button>' +
        '</div>' +
      '</div>';
    }
    $quizList.innerHTML = html;
  }

  $quizList.addEventListener('click', async function(e) {
    var retractBtn = e.target.closest('[data-action="retractQuiz"]');
    if (retractBtn) {
      try {
        await Store.deleteQuizSession();
        await Store.setBlackboard({
          contentType: null,
          textContent: '',
          resourceId: '',
          resourceName: '',
          resourceUrl: '',
          resourceContentType: ''
        });
        UI.toast('测验已撤回', 'info');
      } catch (err) {
        UI.toast('撤回失败: ' + err.message, 'error');
      }
      loadQuizzes();
      return;
    }

    var pushBtn = e.target.closest('[data-action="pushQuiz"]');
    if (pushBtn) {
      var id = pushBtn.dataset.id;
      try {
        await Store.setBlackboard({
          contentType: 'quiz',
          quizId: id,
          textContent: '',
          resourceId: '',
          resourceName: '',
          resourceUrl: '',
          resourceContentType: ''
        });
        UI.toast('测验已推送到黑板', 'success');
      } catch (err) {
        UI.toast('推送失败: ' + err.message, 'error');
      }
      return;
    }

    var editBtn = e.target.closest('[data-action="editQuiz"]');
    if (editBtn) {
      var id = editBtn.dataset.id;
      var quiz = allQuizzes.find(function(q) { return q.id === id; });
      if (quiz) loadQuizToForm(quiz);
      return;
    }

    var delBtn = e.target.closest('[data-action="deleteQuiz"]');
    if (delBtn) {
      var id = delBtn.dataset.id;
      var ok = await UI.confirm('删除测验', '确定要删除该测验吗？');
      if (!ok) return;
      try {
        await Store.deleteQuiz(id);
        UI.toast('测验已删除', 'info');
        loadQuizzes();
      } catch (err) {
        UI.toast('删除失败: ' + err.message, 'error');
      }
      return;
    }
  });

  // 黑板状态显示
  function updateBBStatus(data) {
    var ct = data && data.contentType ? data.contentType : null;
    if (!ct) {
      $bbStatus.innerHTML = '当前：<span style="color:var(--color-text-muted)">空</span>';
    } else if (ct === 'text') {
      var preview = (data.textContent || '').substring(0, 20);
      $bbStatus.innerHTML = '当前：文字 <span class="bb-status__accent">"' + SharedUI.esc(preview) + (data.textContent && data.textContent.length > 20 ? '...' : '') + '"</span>';
    } else if (ct === 'resource') {
      $bbStatus.innerHTML = '当前：资源 <span class="bb-status__accent">"' + SharedUI.esc(data.resourceName || '未命名') + '"</span>';
    } else if (ct === 'quiz') {
      $bbStatus.innerHTML = '当前：<span class="bb-status__accent">📝 测验</span>';
    }
  }




  // ========== 批改面板 ==========

  const $gradingPanel = document.getElementById('gradingPanel');
  const $gradingQuizTitle = document.getElementById('gradingQuizTitle');
  const $gradingList = document.getElementById('gradingList');
  var _gradingQuiz = null;
  var _gradingSessionUnsub = null;

  function cleanupGrading() {
    if (_gradingSessionUnsub) { _gradingSessionUnsub(); _gradingSessionUnsub = null; }
    _gradingQuiz = null;
    $gradingPanel.style.display = 'none';
  }

  function initGrading(session) {
    if (!session || !session.quizId) { cleanupGrading(); return; }
    $gradingPanel.style.display = '';

    // 加载测验信息
    Store.getQuiz(session.quizId).then(function(quiz) {
      if (!quiz) { $gradingList.innerHTML = '<p style="color:var(--color-text-muted)">测验已删除</p>'; return; }
      _gradingQuiz = quiz;
      renderGrading(quiz, session);
    });
  }

  function renderGrading(quiz, session) {
    $gradingQuizTitle.textContent = SharedUI.esc(quiz.title);
    var questions = quiz.questions || [];
    var results = session.questionResults || [];

    var html = '';
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var r = results[i] || {};
      var type = q.type || 'choice';

      html += '<div class="grading-card' + (needsGrading(r, type) ? ' is-pending' : '') + '">';
      html += '<div class="grading-card__header">';
      html += '<span class="grading-card__num">第 ' + (i + 1) + ' 题</span>';
      html += '<span class="grading-card__type">' + getTypeLabel(type) + '</span>';
      html += '</div>';
      html += '<div class="grading-card__question">' + SharedUI.esc(q.question) + '</div>';

      if (type === 'choice') {
        var cIdx = q.correctIndex;
        var chosen = r.childAnswer;
        if (r.status === 'timedout') {
          html += '<div class="grading-card__result"><span class="grading-badge is-wrong">⏰ 超时</span></div>';
        } else if (r.isCorrect === true) {
          html += '<div class="grading-card__result"><span class="grading-badge is-correct">✅ 正确</span></div>';
        } else if (r.isCorrect === false) {
          html += '<div class="grading-card__result"><span class="grading-badge is-wrong">❌ 错误</span> 选了: ' + SharedUI.esc(q.options[chosen]) + '</div>';
        } else if (r.status === 'pending') {
          html += '<div class="grading-card__result"><span class="grading-badge is-pending">⏳ 待回答</span></div>';
        }
        // 回访状态
        if (r.retryIsCorrect === true) {
          html += '<div class="grading-card__retry-note">回访: ✅ 正确 (+' + (r.retryEarned || 0) + '分)</div>';
        } else if (r.retryIsCorrect === false) {
          html += '<div class="grading-card__retry-note">回访: ❌ 错误</div>';
        }
      } else if (type === 'fill') {
        // 检查首次答题状态
        if (r.status === 'submitted' && r.isCorrect === null) {
          html += '<div class="grading-card__answer">答案：' + SharedUI.esc(r.childAnswer) + '</div>';
          html += '<div class="grading-card__actions">';
          html += '<button class="btn btn--sm btn--success grading-btn" data-action="gradeFill" data-qidx="' + i + '" data-correct="true">✓ 正确</button>';
          html += '<button class="btn btn--sm btn--danger grading-btn" data-action="gradeFill" data-qidx="' + i + '" data-correct="false">✗ 错误</button>';
          html += '</div>';
        } else if (r.isCorrect === true) {
          html += '<div class="grading-card__result"><span class="grading-badge is-correct">✅ 已批改: 正确 (' + (r.earned || 0) + '分)</span></div>';
          html += '<div class="grading-card__answer">答案：' + SharedUI.esc(r.childAnswer) + '</div>';
        } else if (r.isCorrect === false) {
          html += '<div class="grading-card__result"><span class="grading-badge is-wrong">已批改: 错误</span></div>';
          html += '<div class="grading-card__answer">答案：' + SharedUI.esc(r.childAnswer) + '</div>';
        } else if (r.status === 'pending') {
          html += '<div class="grading-card__result"><span class="grading-badge is-pending">⏳ 待作答</span></div>';
        }
        // 回访状态
        if (r.retryStatus === 'retry-submitted' && r.retryIsCorrect === null) {
          html += '<div class="grading-card__answer">回访答案：' + SharedUI.esc(r.retryChildAnswer || '') + '</div>';
          html += '<div class="grading-card__actions">';
          html += '<button class="btn btn--sm btn--success grading-btn" data-action="gradeFillRetry" data-qidx="' + i + '" data-correct="true">✓ 回访正确</button>';
          html += '<button class="btn btn--sm btn--danger grading-btn" data-action="gradeFillRetry" data-qidx="' + i + '" data-correct="false">✗ 回访错误</button>';
          html += '</div>';
        } else if (r.retryIsCorrect === true) {
          html += '<div class="grading-card__retry-note">回访: ✅ 正确 (+' + (r.retryEarned || 0) + '分)</div>';
        } else if (r.retryIsCorrect === false) {
          html += '<div class="grading-card__retry-note">回访: ❌ 错误</div>';
        }
      } else if (type === 'read') {
        if (r.status === 'submitted' && r.isCorrect === null) {
          html += '<div class="grading-card__actions">';
          html += '<button class="btn btn--sm btn--success grading-btn" data-action="gradeRead" data-qidx="' + i + '" data-correct="true">✓ 过关</button>';
          html += '<button class="btn btn--sm btn--danger grading-btn" data-action="gradeRead" data-qidx="' + i + '" data-correct="false">✗ 不过关</button>';
          html += '</div>';
        } else if (r.status === 'pending') {
          html += '<div class="grading-card__result"><span class="grading-badge is-pending">⏳ 待朗读</span></div>';
        } else if (r.isCorrect === true) {
          html += '<div class="grading-card__result"><span class="grading-badge is-correct">✅ 已判: 过关 (' + (r.earned || 0) + '分)</span></div>';
        } else if (r.isCorrect === false) {
          html += '<div class="grading-card__result"><span class="grading-badge is-wrong">已判: 不过关</span></div>';
        }
        // 回访
        if (r.retryIsCorrect === null && r.retryStatus === 'retry-submitted') {
          html += '<div class="grading-card__actions">';
          html += '<button class="btn btn--sm btn--success grading-btn" data-action="gradeReadRetry" data-qidx="' + i + '" data-correct="true">✓ 回访过关</button>';
          html += '<button class="btn btn--sm btn--danger grading-btn" data-action="gradeReadRetry" data-qidx="' + i + '" data-correct="false">✗ 回访不过关</button>';
          html += '</div>';
        } else if (r.retryIsCorrect === true) {
          html += '<div class="grading-card__retry-note">回访过关 (+' + (r.retryEarned || 0) + '分)</div>';
        } else if (r.retryIsCorrect === false) {
          html += '<div class="grading-card__retry-note">回访不过关</div>';
        }
      }

      // 参考答案（填空）
      if (type === 'fill' && q.acceptableAnswers && q.acceptableAnswers.length > 0) {
        html += '<div class="grading-card__ref">参考答案：' + SharedUI.esc(q.acceptableAnswers.join('、')) + '</div>';
      }

      html += '</div>';
    }

    $gradingList.innerHTML = html;

    // 绑批改按钮事件
    $gradingList.querySelectorAll('.grading-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var action = this.dataset.action;
        var qIdx = parseInt(this.dataset.qidx, 10);
        var correct = this.dataset.correct === 'true';
        handleGrade(action, qIdx, correct);
      });
    });
  }

  function needsGrading(r, type) {
    if (type === 'fill' && r.status === 'submitted' && r.isCorrect === null) return true;
    if (type === 'fill' && r.retryStatus === 'retry-submitted' && r.retryIsCorrect === null) return true;
    if (type === 'read' && r.status === 'submitted' && r.isCorrect === null) return true;
    if (type === 'read' && r.retryIsCorrect === null && r.retryStatus === 'retry-submitted') return true;
    return false;
  }

  function getTypeLabel(type) {
    if (type === 'choice') return '选择';
    if (type === 'fill') return '填空';
    if (type === 'read') return '朗读';
    return type;
  }

  function handleGrade(action, qIdx, correct) {
    var session = _gradingSession; // set in listener
    if (!session) return;
    var results = session.questionResults.slice();
    var r = results[qIdx];

    if (action === 'gradeFill') {
      var pts = correct ? ((_gradingQuiz.questions[qIdx].points !== undefined ? _gradingQuiz.questions[qIdx].points : 5)) : 0;
      results[qIdx] = Object.assign({}, r, {
        isCorrect: correct,
        earned: pts
      });
    } else if (action === 'gradeFillRetry') {
      var pts = correct ? Math.floor(((_gradingQuiz.questions[qIdx].points !== undefined ? _gradingQuiz.questions[qIdx].points : 5)) / 2) : 0;
      results[qIdx] = Object.assign({}, r, {
        retryIsCorrect: correct,
        retryEarned: pts,
        retryStatus: 'retry-graded'
      });
    } else if (action === 'gradeRead') {
      var pts = correct ? ((_gradingQuiz.questions[qIdx].points !== undefined ? _gradingQuiz.questions[qIdx].points : 5)) : 0;
      results[qIdx] = Object.assign({}, r, {
        status: 'graded',
        isCorrect: correct,
        earned: pts
      });
    } else if (action === 'gradeReadRetry') {
      var pts = correct ? Math.floor(((_gradingQuiz.questions[qIdx].points !== undefined ? _gradingQuiz.questions[qIdx].points : 5)) / 2) : 0;
      results[qIdx] = Object.assign({}, r, {
        retryIsCorrect: correct,
        retryEarned: pts,
        retryStatus: 'retry-graded'
      });
    }

    // 重新计算总分
    var newTotal = 0;
    results.forEach(function(res) {
      newTotal += (res.earned || 0);
      if (res.retryEarned) newTotal += res.retryEarned;
    });

    Store.updateQuizSession({ questionResults: results, totalEarned: newTotal });
    UI.toast('已评分', 'success');
  }

  var _gradingSession = null;

  // 监听 session → 控制批改面板
  Store.onQuizSessionChange(function(session) {
    _gradingSession = session;
    if (session && session.phase !== 'done' && session.phase !== null) {
      initGrading(session);
    } else {
      cleanupGrading();
    }
  });

  loadQuizzes();

  $btnAddResource.addEventListener('click', async () => {
    const url = $resUrl.value.trim();
    if (!url) { UI.toast('请输入资源 URL', 'error'); return; }
    try {
      await ResourceManager.add({
        url,
        name: $resName.value.trim(),
        type: $resType.value
      });
      $resUrl.value = '';
      $resName.value = '';
      UI.toast('资源已添加', 'success');
    } catch (err) {
      UI.toast('添加失败: ' + err.message, 'error');
    }
  });

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
