// child-app.js — 孩子模式主逻辑

document.addEventListener('firebase:ready', async () => {
  const C = APP_CONFIG;
  const uid = window._uid;

  // ========== DOM 引用 ==========
  const $navTabs = document.querySelectorAll('.nav-tab');
  const $panels = document.querySelectorAll('.child-panel');

  // Points
  const $totalPoints = document.getElementById('totalPoints');
  const $basePoints = document.getElementById('basePoints');
  const $basePointsCap = document.getElementById('basePointsCap');
  const $achievePoints = document.getElementById('achievePoints');

  // Streak
  const $streakDays = document.getElementById('streakDays');
  const $streakMultiplier = document.getElementById('streakMultiplier');
  const $streakFlame = document.getElementById('streakFlame');
  const $profileStreak = document.getElementById('profileStreak');
  const $profileMaxStreak = document.getElementById('profileMaxStreak');
  const $profileMultiplier = document.getElementById('profileMultiplier');

  // Task
  const $taskGrid = document.getElementById('taskGrid');

  // Reward
  const $rewardGrid = document.getElementById('rewardGrid');

  // Reports
  const $weeklyCards = document.getElementById('weeklyCards');
  const $monthlyCard = document.getElementById('monthlyCard');
  const $monthLabel = document.getElementById('monthLabel');
  const $btnMonthPrev = document.getElementById('btnMonthPrev');
  const $btnMonthNext = document.getElementById('btnMonthNext');

  let currentMonthOffset = 0;

  // Report detail
  const $reportDetailOverlay = document.getElementById('reportDetailOverlay');
  const $reportDetailTitle = document.getElementById('reportDetailTitle');
  const $reportDetailBody = document.getElementById('reportDetailBody');
  const $btnReportDetailClose = document.getElementById('btnReportDetailClose');
  let reportData = {};

  // Exchange log
  const $exchangeLogList = document.getElementById('exchangeLogList');
  const $exchangeLogHeader = document.getElementById('exchangeLogHeader');
  const $logCollapseArrow = document.getElementById('logCollapseArrow');
  const $btnClearLogs = document.getElementById('btnClearLogs');

  let hiddenLogIds = new Set();

  // State
  let tasks = [];
  let rewards = [];
  let pointsConfig = null;
  let streak = null;

  // ========== 初始化 ==========

  await PointsManager.grantDailyBasePoints();
  await TaskManager.runScheduledChecks();
  await RewardManager.checkPeriodicReset();
  await StreakManager.checkStreakReset(uid);
  loadWeeklyReports();
  loadMonthlyReport(0);

  // 实时监听
  Store.onTasksChange(t => {
    tasks = t;
    renderTasks();
  });

  Store.onRewardsChange(r => {
    rewards = r;
    renderRewards();
  });

  Store.onPointsConfigChange(c => {
    pointsConfig = c;
    updatePointsDisplay();
    renderRewards(); // 积分变化可能影响兑换按钮状态
  });

  Store.onStreakChange(uid, s => {
    streak = s;
    updateStreakDisplay();
  });

  // 加载兑换记录（一次性）
  loadExchangeLogs();

  // 定时重新渲染（处理不刷新页面的过期清理）
  setInterval(() => {
    renderTasks();
    renderRewards();
  }, 3600000);

  // 折叠切换
  $exchangeLogHeader.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    $exchangeLogList.classList.toggle('is-collapsed');
    $logCollapseArrow.classList.toggle('is-collapsed');
  });

  // 清空显示（仅过滤当前可见记录，不删后台数据）
  $btnClearLogs.addEventListener('click', async () => {
    try {
      const logs = await Store.getExchangeLogs();
      logs.forEach(l => hiddenLogIds.add(l.id));
      loadExchangeLogs();
      UI.toast('显示已清空', 'info');
    } catch (err) { /* 静默 */ }
  });

  // ========== Tab 导航 ==========

  $navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      $navTabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      const panelId = tab.dataset.panel;
      $panels.forEach(p => p.classList.remove('is-active'));
      document.getElementById('panel-' + panelId).classList.add('is-active');
    });
  });

  // ========== 积分显示 ==========

  function updatePointsDisplay() {
    if (!pointsConfig) return;
    const total = (pointsConfig.currentBasePoints || 0) + (pointsConfig.achievementPoints || 0);

    $totalPoints.textContent = total;
    $basePoints.textContent = pointsConfig.currentBasePoints || 0;
    $basePointsCap.textContent = pointsConfig.basePointsCap || 100;
    $achievePoints.textContent = pointsConfig.achievementPoints || 0;
  }

  // ========== 打卡显示 ==========

  function updateStreakDisplay() {
    if (!streak) return;
    $streakDays.textContent = streak.currentStreak || 0;
    $streakMultiplier.textContent = StreakManager.getTodayMultiplier(streak).toFixed(1) + 'x';
    $profileStreak.textContent = streak.currentStreak || 0;
    $profileMaxStreak.textContent = streak.maxStreak || 0;
    $profileMultiplier.textContent = StreakManager.getTodayMultiplier(streak).toFixed(1) + 'x';

    // 火焰动画
    if (streak.currentStreak > 0) {
      $streakFlame.classList.add('is-active');
      // 根据天数选火焰
      const flames = ['🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥'];
      if (streak.currentStreak >= 30) $streakFlame.textContent = '🔥';
      else if (streak.currentStreak >= 14) $streakFlame.textContent = '🔥';
      else if (streak.currentStreak >= 7) $streakFlame.textContent = '🔥';
      else $streakFlame.textContent = '🔥';
    } else {
      $streakFlame.classList.remove('is-active');
      $streakFlame.textContent = '🕯️';
    }
  }

  // ========== 任务渲染 ==========

  function renderTasks() {
    const now = Date.now();
    const activeTasks = tasks.filter(t => {
      if (t.status !== C.TASK_STATUS_CLOSED) return true;
      // 过期/管理员关闭 → graceExpiresAt 之前保留
      if (t.graceExpiresAt) return t.graceExpiresAt.toDate().getTime() > now;
      // 正常领取完成 → 立即消失（含旧数据残留的 closedAt 字段）
      return false;
    });

    if (activeTasks.length === 0) {
      $taskGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🛰️</div>
          <p class="empty-state__text">暂无任务，等待指挥官发布...</p>
        </div>`;
      return;
    }

    $taskGrid.innerHTML = activeTasks.map(t => {
      const statusClass = 'task-card--' + t.status;
      const statusLabel = {
        available: '可领取',
        in_progress: '进行中',
        completed: '任务完成！'
      }[t.status] || '';
      const typeLabel = t.type === 'daily' ? '每日' : '限时';

      let timerHTML = '';
      if (t.type === 'timed' && t.deadline) {
        const remaining = t.deadline.toDate().getTime() - Date.now();
        if (remaining > 0) {
          const days = Math.ceil(remaining / 86400000);
          const deadline = t.deadline.toDate();
          const expireDate = `${deadline.getMonth() + 1}/${deadline.getDate()}`;
          timerHTML = `<span class="task-card__timer">⏳ ${days}天 · ${expireDate}到期</span>`;
        } else if (t.status !== C.TASK_STATUS_CLOSED) {
          timerHTML = '<span class="task-card__timer is-expired">已过期</span>';
        }
      }

      let actionBtn = '';
      if (t.status === C.TASK_STATUS_AVAILABLE) {
        actionBtn = `<button class="btn btn--primary btn--sm" data-action="accept" data-id="${t.id}">接受任务</button>`;
      } else if (t.status === C.TASK_STATUS_COMPLETED) {
        const mult = (t.type === 'daily' && streak) ? StreakManager.getTodayMultiplier(streak) : 1.0;
        const earned = Math.round(t.points * mult);
        actionBtn = `<button class="btn btn--success btn--sm glow-btn" data-action="claim" data-id="${t.id}">领取 +${earned}</button>`;
      }

      return `
        <div class="task-card ${statusClass}" data-task-id="${t.id}">
          <div class="task-card__header">
            <span class="task-card__title">${_esc(t.title)}</span>
            <span class="task-card__points">+${t.points}</span>
          </div>
          ${t.description ? `<p class="task-card__desc">${_esc(t.description)}</p>` : ''}
          <div class="task-card__footer">
            <span class="task-card__status">
              <span class="status-dot status-dot--${t.status}"></span>
              ${statusLabel}
              <span class="tag ${t.type === 'daily' ? 'tag--daily' : 'tag--timed'}">${typeLabel}</span>
            </span>
            ${timerHTML}
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  }

  // 任务按钮事件（事件委托）
  $taskGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const taskId = btn.dataset.id;

    if (action === 'accept') {
      try {
        await TaskManager.acceptTask(taskId);
        UI.toast('任务已接受，开始执行吧！', 'success');
      } catch (err) {
        UI.toast('操作失败: ' + err.message, 'error');
      }
    } else if (action === 'claim') {
      const taskEl = document.querySelector(`[data-task-id="${taskId}"]`);
      try {
        const result = await TaskManager.claimTaskPoints(taskId, uid);

        // 飞入动画
        if (taskEl && $totalPoints) {
          const pointsEl = taskEl.querySelector('.task-card__points');
          Animations.flyingPoints(pointsEl || taskEl, $totalPoints, result.earnedPoints);
        }

        // 粒子爆炸
        if (taskEl) setTimeout(() => Animations.particleBurst(taskEl, '#00ff88', 10), 200);

        UI.toast(`获得 ${result.earnedPoints} 积分！${result.multiplier > 1 ? ' (倍率 ' + result.multiplier.toFixed(1) + 'x)' : ''}`, 'success');
      } catch (err) {
        UI.toast('领取失败: ' + err.message, 'error');
      }
    }
  });

  // ========== 奖励渲染 ==========

  function renderRewards() {
    if (rewards.length === 0) {
      $rewardGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🎁</div>
          <p class="empty-state__text">暂无奖励，等待指挥官设置...</p>
        </div>`;
      return;
    }

    // 过滤：过期/停用项保留1天
    const oneDayAgo = Date.now() - 86400000;
    const visibleRewards = rewards.filter(r => {
      if (!r.isActive) {
        if (r.disabledAt) return r.disabledAt.toDate().getTime() > oneDayAgo;
        return false;
      }
      if (r.type === C.REWARD_TYPE_LIMITED && r.exchangedCount >= r.maxExchanges) {
        if (r.exhaustedAt) return r.exhaustedAt.toDate().getTime() > oneDayAgo;
        return false;
      }
      return true;
    });

    if (visibleRewards.length === 0) {
      $rewardGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🎁</div>
          <p class="empty-state__text">暂无奖励，等待指挥官设置...</p>
        </div>`;
      return;
    }

    const total = pointsConfig
      ? (pointsConfig.currentBasePoints || 0) + (pointsConfig.achievementPoints || 0)
      : 0;

    $rewardGrid.innerHTML = visibleRewards.map(r => {
      const check = RewardManager.isExchangeable(r);
      const canExchange = check.available && total >= r.cost;
      const cardClass = check.available ? 'is-available' : 'is-unavailable';

      let metaStr = '';
      if (r.type === C.REWARD_TYPE_PERIODIC) {
        const periodName = r.period === 'daily' ? '今日' : '本月';
        metaStr = `${periodName}剩余: ${Math.max(0, r.maxExchanges - r.exchangedCount)}/${r.maxExchanges} 次`;
      } else {
        metaStr = `总计剩余: ${Math.max(0, r.maxExchanges - r.exchangedCount)}/${r.maxExchanges} 次`;
      }

      let btnHTML = '';
      if (check.available) {
        if (total >= r.cost) {
          btnHTML = `<button class="btn btn--success btn--block reward-card__btn glow-btn" data-action="exchange" data-id="${r.id}">兑换 -${r.cost} 积分</button>`;
        } else {
          btnHTML = `<button class="btn btn--ghost btn--block reward-card__btn" disabled>积分不足 (差 ${r.cost - total})</button>`;
        }
      } else {
        btnHTML = `<button class="btn btn--ghost btn--block reward-card__btn" disabled>${check.reason}</button>`;
      }

      return `
        <div class="reward-card ${cardClass}" data-reward-id="${r.id}">
          <div class="reward-card__header">
            <span class="reward-card__title">${_esc(r.title)}</span>
            <span class="reward-card__cost">${r.cost} 积分</span>
          </div>
          ${r.description ? `<p class="reward-card__desc">${_esc(r.description)}</p>` : ''}
          <p class="reward-card__meta">${metaStr}</p>
          ${btnHTML}
        </div>
      `;
    }).join('');
  }

  // 奖励按钮事件
  $rewardGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const rewardId = btn.dataset.id;

    if (action === 'exchange') {
      const reward = rewards.find(r => r.id === rewardId);
      if (!reward) return;

      const ok = await UI.confirm(
        '确认兑换',
        `确定要用 ${reward.cost} 积分兑换「${reward.title}」吗？`,
        '确认兑换'
      );
      if (!ok) return;

      try {
        await RewardManager.exchangeReward(rewardId, uid);

        // 粒子动画
        const rewardEl = document.querySelector(`[data-reward-id="${rewardId}"]`);
        if (rewardEl) Animations.particleBurst(rewardEl, '#ffb800', 14);

        UI.toast('兑换成功！', 'success');
        loadExchangeLogs(); // 刷新日志
      } catch (err) {
        UI.toast('兑换失败: ' + err.message, 'error');
      }
    }
  });

  // ========== 报告 ==========

  function _renderReportCard(r, type) {
    const startDate = new Date(r.periodStart + 'T00:00:00');
    const endDate = new Date(r.periodEnd + 'T00:00:00');
    const dateStr = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;
    const reportKey = type;

    let title, cardClass;
    if (type === 'lastWeek') {
      title = '上周';
      cardClass = 'report-card--weekly';
    } else if (type === 'thisWeek') {
      title = '本周';
      cardClass = 'report-card--weekly';
    } else {
      title = `${startDate.getMonth() + 1}月`;
      cardClass = 'report-card--monthly';
    }

    const _sv = (stat, color) =>
      `<div class="report-card__stat-value" style="color:${color}" data-report-key="${reportKey}" data-stat="${stat}">${r[stat]}</div>`;

    return `
      <div class="report-card ${cardClass}">
        <div class="report-card__header">
          <span class="report-card__title">${title}</span>
          <span class="report-card__date">${dateStr}</span>
        </div>
        <div class="report-card__stats">
          <div class="report-card__stat">
            ${_sv('checkInDays', 'var(--color-warning)')}
            <div class="report-card__stat-label">打卡天数</div>
          </div>
          <div class="report-card__stat">
            ${_sv('maxStreakInPeriod', 'var(--color-warning)')}
            <div class="report-card__stat-label">最长连续</div>
          </div>
          <div class="report-card__stat">
            ${_sv('tasksCompleted', 'var(--color-success)')}
            <div class="report-card__stat-label">完成任务</div>
          </div>
          <div class="report-card__stat">
            ${_sv('pointsEarned', 'var(--color-success)')}
            <div class="report-card__stat-label">获得积分</div>
          </div>
          <div class="report-card__stat">
            ${_sv('rewardsExchanged', 'var(--color-accent)')}
            <div class="report-card__stat-label">兑换奖励</div>
          </div>
          <div class="report-card__stat">
            ${_sv('pointsSpent', 'var(--color-accent)')}
            <div class="report-card__stat-label">消耗积分</div>
          </div>
        </div>
      </div>
    `;
  }

  async function loadWeeklyReports() {
    try {
      const thisWeek = ReportManager.getWeekRange(new Date());
      const lastWeek = ReportManager.getLastWeekRange();
      const [thisData, lastData] = await Promise.all([
        ReportManager.computeReport(uid, thisWeek.start, thisWeek.end),
        ReportManager.computeReport(uid, lastWeek.start, lastWeek.end)
      ]);

      reportData.lastWeek = lastData;
      reportData.thisWeek = thisData;

      $weeklyCards.innerHTML =
        _renderReportCard(lastData, 'lastWeek') +
        _renderReportCard(thisData, 'thisWeek');
    } catch (err) { /* 静默 */ }
  }

  async function loadMonthlyReport(monthOffset) {
    try {
      currentMonthOffset = monthOffset;
      const range = ReportManager.getMonthRangeByOffset(monthOffset);
      const data = await ReportManager.computeReport(uid, range.start, range.end);

      reportData.monthly = data;

      const startDate = new Date(range.start + 'T00:00:00');
      $monthLabel.textContent = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`;
      $monthlyCard.innerHTML = _renderReportCard(data, 'monthly');

      // 当前月禁用"下一月"
      $btnMonthNext.disabled = (monthOffset === 0);
      $btnMonthNext.style.opacity = monthOffset === 0 ? '0.3' : '';
    } catch (err) { /* 静默 */ }
  }

  $btnMonthPrev.addEventListener('click', () => loadMonthlyReport(currentMonthOffset - 1));
  $btnMonthNext.addEventListener('click', () => {
    if (currentMonthOffset < 0) loadMonthlyReport(currentMonthOffset + 1);
  });

  // 报告数字点击 → 弹详情
  $weeklyCards.addEventListener('click', (e) => {
    const val = e.target.closest('.report-card__stat-value');
    if (!val) return;
    showReportDetail(val.dataset.reportKey, val.dataset.stat);
  });
  $monthlyCard.addEventListener('click', (e) => {
    const val = e.target.closest('.report-card__stat-value');
    if (!val) return;
    showReportDetail(val.dataset.reportKey, val.dataset.stat);
  });

  $btnReportDetailClose.addEventListener('click', () => {
    $reportDetailOverlay.style.display = 'none';
  });
  $reportDetailOverlay.addEventListener('click', (e) => {
    if (e.target === $reportDetailOverlay) {
      $reportDetailOverlay.style.display = 'none';
    }
  });

  function showReportDetail(reportKey, stat) {
    const r = reportData[reportKey];
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

    $reportDetailTitle.textContent = `${statLabels[stat]} · ${rangeStr}`;

    let bodyHTML = '';

    switch (stat) {
      case 'checkInDays':
        if (r.dateStrings && r.dateStrings.length > 0) {
          bodyHTML = '<div class="detail-date-list">' +
            r.dateStrings.map(d => `<span class="detail-date-chip">${d}</span>`).join('') +
            '</div>';
        } else {
          bodyHTML = '<div class="detail-empty">该周期无打卡记录</div>';
        }
        break;

      case 'maxStreakInPeriod':
        bodyHTML = `<div class="detail-empty" style="color:var(--color-warning);font-family:var(--font-display);font-size:var(--text-lg)">${r.maxStreakInPeriod} 天</div>`;
        break;

      case 'tasksCompleted':
        if (r.taskBreakdown && r.taskBreakdown.length > 0) {
          bodyHTML = `<table class="detail-table">
            <thead><tr><th>任务</th><th>次数</th></tr></thead>
            <tbody>${r.taskBreakdown.map(t => `<tr>
              <td>${_esc(t.title)}</td>
              <td><span class="detail-table__number">${t.count}</span></td>
            </tr>`).join('')}</tbody></table>`;
        } else {
          bodyHTML = '<div class="detail-empty">该周期无完成任务</div>';
        }
        break;

      case 'pointsEarned':
        if (r.taskBreakdown && r.taskBreakdown.length > 0) {
          bodyHTML = `<table class="detail-table">
            <thead><tr><th>任务</th><th>次数</th><th>积分</th></tr></thead>
            <tbody>${r.taskBreakdown.map(t => `<tr>
              <td>${_esc(t.title)}</td>
              <td><span class="detail-table__number">${t.count}</span></td>
              <td><span class="detail-table__number">${t.totalPoints}</span></td>
            </tr>`).join('')}</tbody></table>`;
        } else {
          bodyHTML = '<div class="detail-empty">该周期无获得积分</div>';
        }
        break;

      case 'rewardsExchanged':
        if (r.rewardBreakdown && r.rewardBreakdown.length > 0) {
          bodyHTML = `<table class="detail-table">
            <thead><tr><th>奖励</th><th>次数</th></tr></thead>
            <tbody>${r.rewardBreakdown.map(rw => `<tr>
              <td>${_esc(rw.title)}</td>
              <td><span class="detail-table__number">${rw.count}</span></td>
            </tr>`).join('')}</tbody></table>`;
        } else {
          bodyHTML = '<div class="detail-empty">该周期无兑换奖励</div>';
        }
        break;

      case 'pointsSpent':
        if (r.rewardBreakdown && r.rewardBreakdown.length > 0) {
          bodyHTML = `<table class="detail-table">
            <thead><tr><th>奖励</th><th>次数</th><th>消耗</th></tr></thead>
            <tbody>${r.rewardBreakdown.map(rw => `<tr>
              <td>${_esc(rw.title)}</td>
              <td><span class="detail-table__number">${rw.count}</span></td>
              <td><span class="detail-table__number">${rw.totalCost}</span></td>
            </tr>`).join('')}</tbody></table>`;
        } else {
          bodyHTML = '<div class="detail-empty">该周期无消耗积分</div>';
        }
        break;
    }

    $reportDetailBody.innerHTML = bodyHTML;
    $reportDetailOverlay.style.display = 'flex';
  }

  // ========== 兑换记录 ==========

  async function loadExchangeLogs() {
    try {
      const logs = await Store.getExchangeLogs();
      const visibleLogs = logs.filter(l => !hiddenLogIds.has(l.id));

      if (visibleLogs.length === 0) {
        $exchangeLogList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-lg)">暂无兑换记录</p>';
        $btnClearLogs.style.display = 'none';
        return;
      }

      $btnClearLogs.style.display = '';
      $exchangeLogList.innerHTML = visibleLogs.map(l => {
        let timeStr = '';
        if (l.exchangedAt) {
          const d = l.exchangedAt.toDate();
          timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }
        return `
          <div class="log-item">
            <span class="log-item__title">${_esc(l.rewardTitle)}</span>
            <span class="log-item__cost">-${l.cost}</span>
            <span class="log-item__time">${timeStr}</span>
          </div>
        `;
      }).join('');
    } catch (err) {
      // 静默失败
    }
  }

  // ========== 工具 ==========

  function _esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
