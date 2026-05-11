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

  /**
   * 管理员扣除积分（优先基础积分，不出现负数）
   * @param {number} amount - 扣除金额
   * @param {string} reason - 扣除理由
   * @param {string} uid - 用户ID
   * @returns {{ actualDeduct: number, baseDeducted: number, achievementDeducted: number }}
   */
  async function deductPoints(amount, reason, uid) {
    if (!amount || amount <= 0) throw new Error('扣除积分必须大于0');

    return Store.runTransaction(async transaction => {
      const ref = db.collection(C.COLL_POINTS).doc('config');
      const doc = await transaction.get(ref);
      if (!doc.exists) throw new Error('积分配置不存在');

      const config = doc.data();
      const total = (config.currentBasePoints || 0) + (config.achievementPoints || 0);
      const actualDeduct = Math.min(amount, total);

      const baseDeducted = Math.min(config.currentBasePoints || 0, actualDeduct);
      const achievementDeducted = actualDeduct - baseDeducted;

      transaction.update(ref, {
        currentBasePoints: (config.currentBasePoints || 0) - baseDeducted,
        achievementPoints: (config.achievementPoints || 0) - achievementDeducted
      });

      // 在事务内写扣分日志
      const logRef = db.collection(C.COLL_DEDUCTION_LOG).doc();
      transaction.set(logRef, {
        userId: uid,
        reason: reason,
        amount: actualDeduct,
        baseDeducted: baseDeducted,
        achievementDeducted: achievementDeducted,
        deductedAt: firebase.firestore.Timestamp.now()
      });

      return { actualDeduct, baseDeducted, achievementDeducted };
    });
  }

  /** 重置积分（管理员操作） */
  async function resetAllPoints() {
    await Store.updatePointsConfig({
      currentBasePoints: 0,
      achievementPoints: 0
    });
  }

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

  return {
    grantDailyBasePoints,
    getTotalPoints,
    addAchievementPoints,
    spendPoints,
    deductPoints,
    resetAllPoints,
    refundPoints
  };
})();
