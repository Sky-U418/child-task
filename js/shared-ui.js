// shared-ui.js — 共享渲染工具（child & admin 共用）

const SharedUI = (() => {

  /** HTML 转义 */
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /** 渲染报告卡片 HTML */
  function renderReportCard(r, type) {
    const startDate = new Date(r.periodStart + 'T00:00:00');
    const endDate = new Date(r.periodEnd + 'T00:00:00');
    const dateStr = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;
    const reportKey = type;

    let title, cardClass;
    if (type === 'lastWeek') {
      title = '上周'; cardClass = 'report-card--weekly';
    } else if (type === 'thisWeek') {
      title = '本周'; cardClass = 'report-card--weekly';
    } else {
      title = `${startDate.getMonth() + 1}月`; cardClass = 'report-card--monthly';
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

  /** 渲染报告详情弹窗 body HTML */
  function renderReportDetailBody(r, stat) {
    switch (stat) {
      case 'checkInDays':
        if (r.dateStrings && r.dateStrings.length > 0) {
          return '<div class="detail-date-list">' +
            r.dateStrings.map(d => `<span class="detail-date-chip">${d}</span>`).join('') +
            '</div>';
        }
        return '<div class="detail-empty">该周期无打卡记录</div>';

      case 'maxStreakInPeriod':
        return `<div class="detail-empty" style="color:var(--color-warning);font-family:var(--font-display);font-size:var(--text-lg)">${r.maxStreakInPeriod} 天</div>`;

      case 'tasksCompleted':
        if (r.taskBreakdown && r.taskBreakdown.length > 0) {
          return `<table class="detail-table">
            <thead><tr><th>任务</th><th>次数</th></tr></thead>
            <tbody>${r.taskBreakdown.map(t => `<tr>
              <td>${esc(t.title)}</td>
              <td><span class="detail-table__number">${t.count}</span></td>
            </tr>`).join('')}</tbody></table>`;
        }
        return '<div class="detail-empty">该周期无完成任务</div>';

      case 'pointsEarned':
        if (r.taskBreakdown && r.taskBreakdown.length > 0) {
          return `<table class="detail-table">
            <thead><tr><th>任务</th><th>次数</th><th>积分</th></tr></thead>
            <tbody>${r.taskBreakdown.map(t => `<tr>
              <td>${esc(t.title)}</td>
              <td><span class="detail-table__number">${t.count}</span></td>
              <td><span class="detail-table__number">${t.totalPoints}</span></td>
            </tr>`).join('')}</tbody></table>`;
        }
        return '<div class="detail-empty">该周期无获得积分</div>';

      case 'rewardsExchanged':
        if (r.rewardBreakdown && r.rewardBreakdown.length > 0) {
          return `<table class="detail-table">
            <thead><tr><th>奖励</th><th>次数</th></tr></thead>
            <tbody>${r.rewardBreakdown.map(rw => `<tr>
              <td>${esc(rw.title)}</td>
              <td><span class="detail-table__number">${rw.count}</span></td>
            </tr>`).join('')}</tbody></table>`;
        }
        return '<div class="detail-empty">该周期无兑换奖励</div>';

      case 'pointsSpent':
        if (r.rewardBreakdown && r.rewardBreakdown.length > 0) {
          return `<table class="detail-table">
            <thead><tr><th>奖励</th><th>次数</th><th>消耗</th></tr></thead>
            <tbody>${r.rewardBreakdown.map(rw => {
              const isDeduction = rw.title.startsWith('⚠ ');
              const cls = isDeduction ? 'detail-table__number detail-table__number--danger' : 'detail-table__number';
              return `<tr>
                <td>${esc(rw.title)}</td>
                <td><span class="${cls}">${rw.count}</span></td>
                <td><span class="${cls}">${rw.totalCost}</span></td>
              </tr>`;
            }).join('')}</tbody></table>`;
        }
        return '<div class="detail-empty">该周期无消耗积分</div>';
    }
    return '';
  }

  /** 渲染单条兑换日志 HTML */
  function renderExchangeLogItem(l) {
    let timeStr = '';
    if (l.exchangedAt) {
      const d = l.exchangedAt.toDate();
      timeStr = `${d.getMonth() + 1}/${d.getDate()}`;
    }
    // 测验积分：正向显示
    if (l.type === 'quiz_reward') {
      return `
        <div class="log-item">
          <span class="log-item__title">🎯 ${esc(l.description || '小测验')}</span>
          <span class="log-item__cost" style="color:var(--color-success)">+${l.points || 0}</span>
          <span class="log-item__time">${timeStr}</span>
        </div>
      `;
    }
    return `
      <div class="log-item">
        <span class="log-item__title">${esc(l.rewardTitle)}</span>
        <span class="log-item__cost">-${l.cost}</span>
        <span class="log-item__time">${timeStr}</span>
      </div>
    `;
  }

  /** 渲染单条扣分日志 HTML */
  function renderDeductionLogItem(l) {
    let timeStr = '';
    if (l.deductedAt) {
      const d = l.deductedAt.toDate();
      timeStr = `${d.getMonth() + 1}/${d.getDate()}`;
    }
    return `
      <div class="log-item log-item--deduction">
        <span class="log-item__title">${esc(l.reason)}</span>
        <span class="log-item__cost">-${l.amount}</span>
        <span class="log-item__time">${timeStr}</span>
      </div>
    `;
  }

  return { esc, renderReportCard, renderReportDetailBody, renderExchangeLogItem, renderDeductionLogItem };
})();
