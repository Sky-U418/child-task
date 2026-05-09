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
  const $streakImg = document.getElementById('streakImg');
  const $streakProgressBar = document.getElementById('streakProgressBar');
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

  // Blackboard
  const $blackboardEmpty = document.getElementById('blackboardEmpty');
  const $blackboardText = document.getElementById('blackboardText');
  const $blackboardTextContent = document.getElementById('blackboardTextContent');
  const $blackboardResource = document.getElementById('blackboardResource');
  const $blackboardImg = document.getElementById('blackboardImg');
  const $blackboardVideo = document.getElementById('blackboardVideo');
  const $blackboardAudio = document.getElementById('blackboardAudio');
  const $blackboardOther = document.getElementById('blackboardOther');
  const $blackboardOtherName = document.getElementById('blackboardOtherName');
  const $blackboardYoutube = document.getElementById('blackboardYoutube');
  const $blackboardYoutubeIframe = document.getElementById('blackboardYoutubeIframe');
  const $blackboardExtLink = document.getElementById('blackboardExtLink');
  const $blackboardExtLinkName = document.getElementById('blackboardExtLinkName');
  const $blackboardExtLinkBtn = document.getElementById('blackboardExtLinkBtn');

  function _getLogHiddenBefore() {
    return parseInt(localStorage.getItem('exchangeLogHiddenBefore') || '0', 10);
  }

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
    renderTasks();
  });

  // 加载兑换记录（一次性）
  loadExchangeLogs();

  // 小黑板实时监听
  Store.onBlackboardChange(renderBlackboard);

  // 窗口 resize 时重新计算黑板文字字号

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

  // 清空显示（记录时间戳，不删后台数据）
  $btnClearLogs.addEventListener('click', () => {
    localStorage.setItem('exchangeLogHiddenBefore', Date.now().toString());
    loadExchangeLogs();
    UI.toast('显示已清空', 'info');
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
    const current = streak.currentStreak || 0;
    const mult = StreakManager.getTodayMultiplier(streak);

    $streakDays.textContent = current;
    $streakMultiplier.textContent = mult.toFixed(1) + 'x';
    $profileStreak.textContent = current;
    $profileMaxStreak.textContent = streak.maxStreak || 0;
    $profileMultiplier.textContent = mult.toFixed(1) + 'x';

    // 徽章图片与进度条
    let imgSrc, barColor, barPct;
    if (current === 0) {
      imgSrc = 'images/0.png';
      barColor = '#444';
      barPct = 0;
    } else {
      const posInCycle = ((current - 1) % 5) + 1;
      const cycle = Math.floor((current - 1) / 5);

      if (current >= 15) {
        imgSrc = 'images/1c.png';
      } else if (current >= 10) {
        imgSrc = 'images/1b.png';
      } else if (current >= 5) {
        imgSrc = 'images/1a.png';
      } else {
        imgSrc = 'images/0.png';
      }

      if (cycle >= 2) {
        barColor = '#42a5f5';
        barPct = current >= 15 ? 100 : posInCycle * 20;
      } else if (cycle === 1) {
        barColor = '#ff9800';
        barPct = posInCycle * 20;
      } else {
        barColor = '#ffe082';
        barPct = posInCycle * 20;
      }
    }

    $streakImg.src = imgSrc;
    $streakProgressBar.style.width = barPct + '%';
    $streakProgressBar.style.backgroundColor = barColor;
  }

  // ========== 小黑板工具函数 ==========

  function isYouTubeUrl(url) {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
  }

  function getYouTubeEmbedUrl(url) {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&rel=0' : url;
  }

  function isNonEmbeddableUrl(url) {
    return /drive\.google\.com|1drv\.ms|onedrive\.live\.com/.test(url);
  }

  function isBilibiliUrl(url) {
    return /bilibili\.com\/video\/|b23\.tv/.test(url);
  }

  function getBilibiliEmbedUrl(url) {
    // BV 号: bilibili.com/video/BVxxxxxxxxx
    const bv = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
    if (bv) return 'https://player.bilibili.com/player.html?bvid=' + bv[1] + '&autoplay=1';
    // AV 号 (旧格式): bilibili.com/video/av123456
    const av = url.match(/bilibili\.com\/video\/(av\d+)/i);
    if (av) return 'https://player.bilibili.com/player.html?aid=' + av[1].replace('av', '') + '&autoplay=1';
    return url;
  }

  // ========== 小黑板渲染 ==========

  function renderBlackboard(data) {
    const ct = data && data.contentType ? data.contentType : null;

    // 隐藏所有
    $blackboardEmpty.style.display = 'none';
    $blackboardText.style.display = 'none';
    $blackboardResource.style.display = 'none';

    if (!ct) {
      $blackboardEmpty.style.display = '';
      return;
    }

    if (ct === 'text' && data.textContent) {
      $blackboardTextContent.textContent = data.textContent;
      $blackboardText.style.display = '';
      fitBlackboardText();
    } else if (ct === 'resource') {
      $blackboardResource.style.display = '';
      $blackboardImg.style.display = 'none';
      $blackboardVideo.style.display = 'none';
      $blackboardAudio.style.display = 'none';
      $blackboardOther.style.display = 'none';
      $blackboardYoutube.style.display = 'none';
      $blackboardExtLink.style.display = 'none';
      $blackboardYoutubeIframe.src = '';

      const rct = data.resourceContentType || '';
      const url = data.resourceUrl || '';

      if (rct.startsWith('image/')) {
        $blackboardImg.src = url;
        $blackboardImg.style.display = '';
      } else if (rct.startsWith('video/')) {
        if (isYouTubeUrl(url)) {
          $blackboardYoutubeIframe.src = getYouTubeEmbedUrl(url);
          $blackboardYoutube.style.display = '';
        } else if (isBilibiliUrl(url)) {
          $blackboardYoutubeIframe.src = getBilibiliEmbedUrl(url);
          $blackboardYoutube.style.display = '';
        } else if (isNonEmbeddableUrl(url)) {
          $blackboardExtLinkName.textContent = data.resourceName || '视频资源';
          $blackboardExtLinkBtn.href = url;
          $blackboardExtLink.style.display = '';
        } else {
          $blackboardVideo.src = url;
          $blackboardVideo.onerror = () => {
            $blackboardVideo.style.display = 'none';
            $blackboardExtLinkName.textContent = data.resourceName || '视频资源';
            $blackboardExtLinkBtn.href = url;
            $blackboardExtLink.style.display = '';
          };
          $blackboardVideo.style.display = '';
        }
      } else if (rct.startsWith('audio/')) {
        if (isNonEmbeddableUrl(url)) {
          $blackboardExtLinkName.textContent = data.resourceName || '音频资源';
          $blackboardExtLinkBtn.href = url;
          $blackboardExtLink.style.display = '';
        } else {
          $blackboardAudio.src = url;
          $blackboardAudio.style.display = '';
        }
      } else {
        $blackboardOtherName.textContent = data.resourceName || '未知资源';
        $blackboardOther.style.display = '';
      }
    }
  }

  function fitBlackboardText() {
    const frame = document.querySelector('.blackboard-frame');
    const span = $blackboardTextContent;
    if (!frame || !span) return;

    span.style.fontSize = '';
    const maxW = frame.clientWidth - 32;
    const maxH = frame.clientHeight - 32;

    let lo = 16, hi = 120, best = 16;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      span.style.fontSize = mid + 'px';
      if (span.scrollWidth <= maxW && span.scrollHeight <= maxH) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    span.style.fontSize = best + 'px';
  }

  window.addEventListener('resize', () => {
    if ($blackboardText.style.display !== 'none') {
      fitBlackboardText();
    }
  });

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
      const isExpired = t.status === 'closed' && t.graceExpiresAt;
      const effectiveStatus = isExpired ? 'expired' : t.status;
      const statusClass = 'task-card--' + effectiveStatus;
      const statusLabel = {
        available: '可领取',
        in_progress: '进行中',
        completed: '任务完成！',
        expired: '已过期'
      }[effectiveStatus] || '';
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
            <span class="task-card__title">${SharedUI.esc(t.title)}</span>
            <span class="task-card__points">+${(t.type === 'daily' && streak) ? Math.round(t.points * StreakManager.getTodayMultiplier(streak)) : t.points}</span>
          </div>
          ${t.description ? `<p class="task-card__desc">${SharedUI.esc(t.description)}</p>` : ''}
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
            <span class="reward-card__title">${SharedUI.esc(r.title)}</span>
            <span class="reward-card__cost">${r.cost} 积分</span>
          </div>
          ${r.description ? `<p class="reward-card__desc">${SharedUI.esc(r.description)}</p>` : ''}
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
        SharedUI.renderReportCard(lastData, 'lastWeek') +
        SharedUI.renderReportCard(thisData, 'thisWeek');
    } catch (err) { _handleReportError(err, $weeklyCards); }
  }

  async function loadMonthlyReport(monthOffset) {
    try {
      currentMonthOffset = monthOffset;
      const range = ReportManager.getMonthRangeByOffset(monthOffset);
      const data = await ReportManager.computeReport(uid, range.start, range.end);

      reportData.monthly = data;

      const startDate = new Date(range.start + 'T00:00:00');
      $monthLabel.textContent = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`;
      $monthlyCard.innerHTML = SharedUI.renderReportCard(data, 'monthly');

      // 当前月禁用"下一月"
      $btnMonthNext.disabled = (monthOffset === 0);
      $btnMonthNext.style.opacity = monthOffset === 0 ? '0.3' : '';
    } catch (err) { _handleReportError(err, $monthlyCard); }
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
    $reportDetailBody.innerHTML = SharedUI.renderReportDetailBody(r, stat);
    $reportDetailOverlay.style.display = 'flex';
  }

  // ========== 兑换记录 ==========

  async function loadExchangeLogs() {
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

      const allLogs = [
        ...visibleExchanges.map(l => ({ ...l, _type: 'exchange', _time: l.exchangedAt.toDate().getTime() })),
        ...visibleDeductions.map(l => ({ ...l, _type: 'deduction', _time: l.deductedAt.toDate().getTime() }))
      ].sort((a, b) => b._time - a._time);

      if (allLogs.length === 0) {
        $exchangeLogList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-lg)">暂无记录</p>';
        $btnClearLogs.style.display = 'none';
        return;
      }

      $btnClearLogs.style.display = '';
      $exchangeLogList.innerHTML = allLogs.map(l => {
        if (l._type === 'deduction') {
          return SharedUI.renderDeductionLogItem(l);
        }
        return SharedUI.renderExchangeLogItem(l);
      }).join('');
    } catch (err) {
      // 静默失败
    }
  }

});
