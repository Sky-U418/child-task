// reports.js — 周报/月报实时计算（不存储，每次从 taskLog + exchangeLog 查询）

const ReportManager = (() => {

  function _fmt(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // ========== 周范围（周一 ~ 周日）==========

  function getWeekRange(date) {
    const day = date.getDay();
    const offset = day === 0 ? 6 : day - 1;
    const monday = new Date(date);
    monday.setDate(date.getDate() - offset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: _fmt(monday), end: _fmt(sunday) };
  }

  function getLastWeekRange() {
    const d = new Date();
    const day = d.getDay();
    const offset = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - offset - 7);
    return getWeekRange(d);
  }

  // ========== 月范围 ==========

  function getMonthRange(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    last.setHours(23, 59, 59, 999);
    return { start: _fmt(first), end: _fmt(last) };
  }

  function getMonthRangeByOffset(monthOffset) {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return getMonthRange(d);
  }

  // ========== 最长连续天数 ==========

  function calcMaxStreak(dates) {
    const sorted = [...dates].sort();
    let max = 0, cur = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { cur = 1; }
      else {
        const diff = (new Date(sorted[i]) - new Date(sorted[i-1])) / 86400000;
        cur = (diff === 1) ? cur + 1 : 1;
      }
      max = Math.max(max, cur);
    }
    return max;
  }

  // ========== 实时计算报告（不存储）==========

  async function computeReport(uid, periodStart, periodEnd) {
    const [taskLogs, exchangeLogs, deductionLogs] = await Promise.all([
      Store.getTaskLogs(uid, periodStart, periodEnd),
      Store.getExchangeLogsByDateRange(uid, periodStart, periodEnd),
      Store.getDeductionLogsByDateRange(uid, periodStart, periodEnd)
    ]);

    const dateSet = new Set();
    const taskByTitle = {};
    let pointsEarned = 0;

    for (const l of taskLogs) {
      const d = l.completedAt.toDate();
      dateSet.add(_fmt(d));
      if (!taskByTitle[l.taskTitle]) {
        taskByTitle[l.taskTitle] = { count: 0, totalPoints: 0 };
      }
      taskByTitle[l.taskTitle].count++;
      taskByTitle[l.taskTitle].totalPoints += (l.earnedPoints || 0);
      pointsEarned += (l.earnedPoints || 0);
    }

    const rewardByTitle = {};
    let pointsSpent = 0;

    for (const l of exchangeLogs) {
      if (!rewardByTitle[l.rewardTitle]) {
        rewardByTitle[l.rewardTitle] = { count: 0, totalCost: 0 };
      }
      rewardByTitle[l.rewardTitle].count++;
      rewardByTitle[l.rewardTitle].totalCost += (l.cost || 0);
      pointsSpent += (l.cost || 0);
    }

    let totalDeducted = 0;
    for (const l of deductionLogs) {
      totalDeducted += (l.amount || 0);
    }
    pointsSpent += totalDeducted;

    const dateStrings = [...dateSet].sort().map(d => {
      const parts = d.split('-');
      return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
    });

    return {
      periodStart,
      periodEnd,
      checkInDays: dateSet.size,
      dateStrings,
      maxStreakInPeriod: calcMaxStreak(dateSet),
      tasksCompleted: taskLogs.length,
      taskBreakdown: Object.entries(taskByTitle).map(([title, d]) => ({
        title, count: d.count, totalPoints: d.totalPoints
      })),
      pointsEarned,
      rewardsExchanged: exchangeLogs.length,
      rewardBreakdown: Object.entries(rewardByTitle).map(([title, d]) => ({
        title, count: d.count, totalCost: d.totalCost
      })),
      pointsSpent
    };
  }

  return {
    computeReport,
    getWeekRange, getLastWeekRange,
    getMonthRange, getMonthRangeByOffset
  };
})();
