// points.js — 积分计算与管理

const PointsManager = (() => {
  const C = APP_CONFIG;

  /**
   * 检查并发放每日基础积分（事务保证不重复发放）
   */
  async function grantDailyBasePoints() {
    try {
      await Store.runTransaction(async transaction => {
        const ref = db.collection(C.COLL_POINTS).doc('config');
        const doc = await transaction.get(ref);
        if (!doc.exists) return;

        const config = doc.data();
        const now = new Date();
        const lastGrant = config.lastBaseGrantAt ? config.lastBaseGrantAt.toDate() : null;

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const lastGrantDay = lastGrant
          ? new Date(lastGrant.getFullYear(), lastGrant.getMonth(), lastGrant.getDate()).getTime()
          : 0;

        if (today <= lastGrantDay) return;

        const room = Math.max(0, config.basePointsCap - config.currentBasePoints);
        const toGrant = Math.min(config.dailyBasePoints, room);

        transaction.update(ref, {
          currentBasePoints: config.currentBasePoints + toGrant,
          lastBaseGrantAt: firebase.firestore.Timestamp.now()
        });
      });
    } catch (err) {
      console.error('grantDailyBasePoints 失败:', err);
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
   * 消费积分（优先基础积分）— 事务保证不会超额消费
   * 返回 { success: boolean, remaining: number }
   */
  async function spendPoints(cost) {
    try {
      return await Store.runTransaction(async transaction => {
        const ref = db.collection(C.COLL_POINTS).doc('config');
        const doc = await transaction.get(ref);
        if (!doc.exists) {
          return { success: false, remaining: 0, needed: cost };
        }

        const config = doc.data();
        const total = (config.currentBasePoints || 0) + (config.achievementPoints || 0);
        if (total < cost) {
          return { success: false, remaining: total, needed: cost };
        }

        const baseSpend = Math.min(config.currentBasePoints, cost);
        const achievementSpend = cost - baseSpend;

        transaction.update(ref, {
          currentBasePoints: config.currentBasePoints - baseSpend,
          achievementPoints: (config.achievementPoints || 0) - achievementSpend
        });

        return {
          success: true,
          remaining: (config.currentBasePoints - baseSpend) + ((config.achievementPoints || 0) - achievementSpend),
          baseSpent: baseSpend,
          achievementSpent: achievementSpend
        };
      });
    } catch (err) {
      console.error('spendPoints 事务失败:', err);
      return { success: false, remaining: 0, needed: cost };
    }
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
