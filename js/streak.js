// streak.js — 连续打卡系统
// 核心规则: 今天的倍率由昨天的连续天数决定，全天不变

const StreakManager = (() => {
  const C = APP_CONFIG;

  function _todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function _isYesterday(dateStr) {
    if (!dateStr) return false;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    return dateStr === yesterday;
  }

  /**
   * 计算倍率: 1.0 + streak * 0.1, 上限 MAX_STREAK_MULTIPLIER
   * @param {number} streak - 已完成的连续天数（截至昨天）
   */
  function calcMultiplier(streak) {
    return Math.round(Math.min(1.0 + streak * C.STREAK_INCREMENT, C.MAX_STREAK_MULTIPLIER) * 100) / 100;
  }

  /**
   * 获取今天的积分倍率（全天不变）
   */
  function getTodayMultiplier(streak) {
    return streak.multiplier || 1.0;
  }

  /**
   * 孩子在完成任务后调用，更新打卡状态
   * 不改变今天的倍率，只更新连续天数和明天的倍率
   */
  async function onTaskCompleted(uid) {
    const streak = await Store.getStreak(uid);
    const today = _todayStr();

    // 同一天完成多个任务，不重复计算
    if (streak.lastTaskDate === today) {
      return streak;
    }

    let newStreak;
    if (_isYesterday(streak.lastTaskDate)) {
      newStreak = streak.currentStreak + 1;
    } else {
      newStreak = 1;
    }

    const maxStreak = Math.max(streak.maxStreak || 0, newStreak);

    // todayMultiplier 不变，明天才用新的
    await Store.updateStreak(uid, {
      currentStreak: newStreak,
      lastTaskDate: today,
      maxStreak
    });

    return { ...streak, currentStreak: newStreak, lastTaskDate: today, maxStreak };
  }

  /**
   * 页面加载时调用：确定今天的倍率并重置中断的打卡
   */
  async function checkStreakReset(uid) {
    const streak = await Store.getStreak(uid);
    const today = _todayStr();

    // 今天已经处理过，倍率不变
    if (streak.lastTaskDate === today) return streak;

    if (_isYesterday(streak.lastTaskDate)) {
      // 昨天完成了 → 连续中，今天倍率基于昨天的连续天数
      const todayMult = calcMultiplier(streak.currentStreak);
      await Store.updateStreak(uid, { multiplier: todayMult });
      return { ...streak, multiplier: todayMult };
    }

    // 中断了 → 重置
    if (streak.currentStreak !== 0 || streak.multiplier !== 1.0) {
      await Store.updateStreak(uid, { currentStreak: 0, multiplier: 1.0 });
      return { ...streak, currentStreak: 0, multiplier: 1.0 };
    }

    return streak;
  }

  return { onTaskCompleted, checkStreakReset, calcMultiplier, getTodayMultiplier };
})();
