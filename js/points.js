// points.js — 积分计算与管理

const PointsManager = (() => {
  const C = APP_CONFIG;

  /**
   * 检查并发放每日基础积分
   * 规则: 每天发放一次，未达上限才发放，发放量不超过上限
   */
  async function grantDailyBasePoints() {
    const config = await Store.getPointsConfig();
    const now = new Date();
    const lastGrant = config.lastBaseGrantAt ? config.lastBaseGrantAt.toDate() : null;

    // 判断是否需要发放（今天尚未发放）
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const lastGrantDay = lastGrant
      ? new Date(lastGrant.getFullYear(), lastGrant.getMonth(), lastGrant.getDate()).getTime()
      : 0;

    if (today > lastGrantDay) {
      // 可以加的空间
      const room = Math.max(0, config.basePointsCap - config.currentBasePoints);
      const toGrant = Math.min(config.dailyBasePoints, room);

      if (toGrant > 0) {
        await Store.updatePointsConfig({
          currentBasePoints: config.currentBasePoints + toGrant,
          lastBaseGrantAt: firebase.firestore.Timestamp.now()
        });
      } else {
        // 已达上限，只更新时间戳
        await Store.updatePointsConfig({
          lastBaseGrantAt: firebase.firestore.Timestamp.now()
        });
      }
    }
  }

  /** 获取总积分 */
  async function getTotalPoints() {
    const config = await Store.getPointsConfig();
    return config.currentBasePoints + (config.achievementPoints || 0);
  }

  /** 添加成果积分（完成任务） */
  async function addAchievementPoints(amount) {
    const config = await Store.getPointsConfig();
    const newAchievement = (config.achievementPoints || 0) + amount;
    await Store.updatePointsConfig({ achievementPoints: newAchievement });
    return { basePoints: config.currentBasePoints, achievementPoints: newAchievement };
  }

  /**
   * 消费积分（优先基础积分）
   * 返回 { success: boolean, remaining: number }
   */
  async function spendPoints(cost) {
    const config = await Store.getPointsConfig();

    const total = (config.currentBasePoints || 0) + (config.achievementPoints || 0);
    if (total < cost) {
      return { success: false, remaining: total, needed: cost };
    }

    // 先扣基础积分
    const baseSpend = Math.min(config.currentBasePoints, cost);
    const achievementSpend = cost - baseSpend;

    const newBase = config.currentBasePoints - baseSpend;
    const newAchievement = (config.achievementPoints || 0) - achievementSpend;

    await Store.updatePointsConfig({
      currentBasePoints: newBase,
      achievementPoints: newAchievement
    });

    return {
      success: true,
      remaining: newBase + newAchievement,
      baseSpent: baseSpend,
      achievementSpent: achievementSpend
    };
  }

  /** 重置积分（管理员操作） */
  async function resetAllPoints() {
    await Store.updatePointsConfig({
      currentBasePoints: 0,
      achievementPoints: 0
    });
  }

  return {
    grantDailyBasePoints,
    getTotalPoints,
    addAchievementPoints,
    spendPoints,
    resetAllPoints
  };
})();
