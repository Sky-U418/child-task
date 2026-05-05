// rewards.js — 奖励兑换逻辑

const RewardManager = (() => {
  const C = APP_CONFIG;

  /**
   * 判断奖励当前是否可兑换
   * 返回 { available: boolean, reason: string }
   */
  function isExchangeable(reward) {
    if (!reward.isActive) {
      return { available: false, reason: '该奖励已被管理员关闭' };
    }

    if (reward.type === C.REWARD_TYPE_LIMITED) {
      if (reward.exchangedCount >= reward.maxExchanges) {
        return { available: false, reason: '兑换次数已用完' };
      }
    }

    if (reward.type === C.REWARD_TYPE_PERIODIC) {
      if (reward.exchangedCount >= reward.maxExchanges) {
        if (reward.period === C.REWARD_PERIOD_DAILY) {
          return { available: false, reason: '今日兑换次数已达上限，明天再来吧' };
        }
        if (reward.period === C.REWARD_PERIOD_MONTHLY) {
          return { available: false, reason: '本月兑换次数已达上限，下个月再来吧' };
        }
        return { available: false, reason: '兑换次数已用完' };
      }
    }

    return { available: true, reason: '' };
  }

  /**
   * 兑换奖励 — 事务保证原子性（检查→扣积分→增计数→写日志）
   * @param {string} rewardId - 奖励文档 ID
   * @param {string} uid - 用户 ID
   */
  async function exchangeReward(rewardId, uid) {
    return Store.runTransaction(async transaction => {
      // 读取积分
      const pointsRef = db.collection(C.COLL_POINTS).doc('config');
      const pointsDoc = await transaction.get(pointsRef);
      if (!pointsDoc.exists) throw new Error('积分配置不存在');
      const config = pointsDoc.data();

      // 读取奖励（实时数据，非快照）
      const rewardRef = db.collection(C.COLL_REWARDS).doc(rewardId);
      const rewardDoc = await transaction.get(rewardRef);
      if (!rewardDoc.exists) throw new Error('奖励不存在');
      const reward = { id: rewardDoc.id, ...rewardDoc.data() };

      // 检查可兑换性（使用实时数据）
      const check = isExchangeable(reward);
      if (!check.available) throw new Error(check.reason);

      // 检查积分余额
      const total = (config.currentBasePoints || 0) + (config.achievementPoints || 0);
      if (total < reward.cost) {
        throw new Error(`积分不足！需要 ${reward.cost} 但只有 ${total}`);
      }

      // 扣除积分
      const baseSpend = Math.min(config.currentBasePoints, reward.cost);
      const achievementSpend = reward.cost - baseSpend;
      transaction.update(pointsRef, {
        currentBasePoints: config.currentBasePoints - baseSpend,
        achievementPoints: (config.achievementPoints || 0) - achievementSpend
      });

      // 增加兑换次数
      const newCount = (reward.exchangedCount || 0) + 1;
      const rewardUpdate = { exchangedCount: newCount };
      if (reward.type === C.REWARD_TYPE_LIMITED && newCount >= reward.maxExchanges) {
        rewardUpdate.exhaustedAt = firebase.firestore.Timestamp.now();
      }
      transaction.update(rewardRef, rewardUpdate);

      // 写入兑换日志
      const logRef = db.collection(C.COLL_EXCHANGE_LOG).doc();
      transaction.set(logRef, {
        userId: uid,
        rewardId: rewardId,
        rewardTitle: reward.title,
        cost: reward.cost,
        exchangedAt: firebase.firestore.Timestamp.now()
      });

      return {
        success: true,
        remaining: (config.currentBasePoints - baseSpend) + ((config.achievementPoints || 0) - achievementSpend),
        baseSpent: baseSpend,
        achievementSpent: achievementSpend
      };
    });
  }

  // ========== 管理员操作 ==========

  /** 创建奖励 */
  async function createReward({ title, description, cost, type, period, maxExchanges }) {
    const data = {
      title,
      description: description || '',
      cost: parseInt(cost, 10) || 1,
      type,
      period: type === C.REWARD_TYPE_PERIODIC ? period : null,
      maxExchanges: parseInt(maxExchanges, 10) || C.REWARD_MAX_EXCHANGES_DEFAULT,
      periodResetAt: null
    };

    // 设置周期重置时间
    if (type === C.REWARD_TYPE_PERIODIC && period === C.REWARD_PERIOD_DAILY) {
      const d = new Date();
      d.setHours(24, 0, 0, 0);
      data.periodResetAt = firebase.firestore.Timestamp.fromDate(d);
    } else if (type === C.REWARD_TYPE_PERIODIC && period === C.REWARD_PERIOD_MONTHLY) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      data.periodResetAt = firebase.firestore.Timestamp.fromDate(d);
    }

    return Store.addReward(data);
  }

  /** 管理员重置限次数奖励 */
  async function resetLimitedReward(rewardId) {
    return Store.updateReward(rewardId, {
      exchangedCount: 0,
      isActive: true
    });
  }

  /** 管理员切换奖励是否激活 */
  async function toggleRewardActive(rewardId, isActive) {
    return Store.updateReward(rewardId, { isActive });
  }

  /** 删除奖励 */
  async function removeReward(rewardId) {
    return Store.deleteReward(rewardId);
  }

  // ========== 定时检查 ==========

  /** 检查并重置周期奖励的次数 */
  async function checkPeriodicReset() {
    const rewards = await Store.getRewards();
    const now = firebase.firestore.Timestamp.now();

    const batchOps = [];
    for (const reward of rewards) {
      if (reward.type !== C.REWARD_TYPE_PERIODIC) continue;
      if (!reward.periodResetAt) continue;

      if (now.toMillis() > reward.periodResetAt.toMillis()) {
        // 计算下一个重置时间
        let nextReset;
        if (reward.period === C.REWARD_PERIOD_DAILY) {
          const d = new Date();
          d.setHours(24, 0, 0, 0);
          nextReset = firebase.firestore.Timestamp.fromDate(d);
        } else if (reward.period === C.REWARD_PERIOD_MONTHLY) {
          const d = new Date();
          d.setMonth(d.getMonth() + 1);
          d.setDate(1);
          d.setHours(0, 0, 0, 0);
          nextReset = firebase.firestore.Timestamp.fromDate(d);
        }

        batchOps.push({
          collection: C.COLL_REWARDS, id: reward.id, type: 'update',
          data: {
            exchangedCount: 0,
            periodResetAt: nextReset
          }
        });
      }
    }

    if (batchOps.length > 0) {
      await Store.batchWrite(batchOps);
    }
  }

  return {
    isExchangeable, exchangeReward,
    createReward, resetLimitedReward, toggleRewardActive, removeReward,
    checkPeriodicReset
  };
})();
