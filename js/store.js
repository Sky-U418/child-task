// store.js — Firestore 数据读写封装
// 所有数据操作和实时监听集中在此模块

const Store = (() => {
  const C = APP_CONFIG;
  const ORDER_INTERVAL = 1000;

  /** 客户端排序 — 按 order 字段（缺省视为 0），order 相同则按 createdAt */
  function _sortByOrder(items) {
    return items.sort((a, b) => {
      const aOrder = a.order || 0;
      const bOrder = b.order || 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return aTime - bTime;
    });
  }

  // ========== 任务 ==========

  function getTasks() {
    return db.collection(C.COLL_TASKS)
      .get()
      .then(snap => {
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return _sortByOrder(tasks);
      });
  }

  function onTasksChange(callback) {
    return db.collection(C.COLL_TASKS)
      .onSnapshot(snap => {
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(_sortByOrder(tasks));
      });
  }

  function addTask(data) {
    const doc = {
      ...data,
      status: C.TASK_STATUS_AVAILABLE,
      order: data.order || null,
      createdAt: firebase.firestore.Timestamp.now()
    };
    return db.collection(C.COLL_TASKS).add(doc);
  }

  function updateTask(id, data) {
    return db.collection(C.COLL_TASKS).doc(id).update(data);
  }

  function deleteTask(id) {
    return db.collection(C.COLL_TASKS).doc(id).delete();
  }

  // ========== 奖励 ==========

  function getRewards() {
    return db.collection(C.COLL_REWARDS)
      .get()
      .then(snap => {
        const rewards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return _sortByOrder(rewards);
      });
  }

  function onRewardsChange(callback) {
    return db.collection(C.COLL_REWARDS)
      .onSnapshot(snap => {
        const rewards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(_sortByOrder(rewards));
      });
  }

  function addReward(data) {
    const doc = {
      ...data,
      exchangedCount: 0,
      isActive: true,
      order: data.order || null,
      createdAt: firebase.firestore.Timestamp.now()
    };
    return db.collection(C.COLL_REWARDS).add(doc);
  }

  function updateReward(id, data) {
    return db.collection(C.COLL_REWARDS).doc(id).update(data);
  }

  function deleteReward(id) {
    return db.collection(C.COLL_REWARDS).doc(id).delete();
  }

  // ========== 积分配置 ==========

  const POINTS_DOC_ID = 'config';

  function getPointsConfig() {
    return db.collection(C.COLL_POINTS).doc(POINTS_DOC_ID).get()
      .then(doc => {
        if (!doc.exists) {
          // 首次使用: 创建默认配置
          const defaults = {
            dailyBasePoints: 10,
            basePointsCap: 100,
            currentBasePoints: 10,
            achievementPoints: 0,
            lastBaseGrantAt: firebase.firestore.Timestamp.now()
          };
          return db.collection(C.COLL_POINTS).doc(POINTS_DOC_ID).set(defaults)
            .then(() => defaults);
        }
        return doc.data();
      });
  }

  function onPointsConfigChange(callback) {
    return db.collection(C.COLL_POINTS).doc(POINTS_DOC_ID)
      .onSnapshot(doc => {
        if (doc.exists) {
          callback(doc.data());
        }
      });
  }

  function updatePointsConfig(data) {
    return db.collection(C.COLL_POINTS).doc(POINTS_DOC_ID).update(data);
  }

  function setPointsConfig(data) {
    return db.collection(C.COLL_POINTS).doc(POINTS_DOC_ID).set(data, { merge: true });
  }

  // ========== 连续打卡 ==========

  function getStreak(uid) {
    return db.collection(C.COLL_STREAK).doc(uid).get()
      .then(doc => {
        if (!doc.exists) {
          const defaults = {
            userId: uid,
            currentStreak: 0,
            lastTaskDate: '',
            maxStreak: 0,
            multiplier: 1.0
          };
          return db.collection(C.COLL_STREAK).doc(uid).set(defaults).then(() => defaults);
        }
        return doc.data();
      });
  }

  function onStreakChange(uid, callback) {
    return db.collection(C.COLL_STREAK).doc(uid)
      .onSnapshot(doc => {
        if (doc.exists) {
          callback(doc.data());
        }
      });
  }

  function updateStreak(uid, data) {
    return db.collection(C.COLL_STREAK).doc(uid).update(data);
  }

  function setStreak(uid, data) {
    return db.collection(C.COLL_STREAK).doc(uid).set(data, { merge: true });
  }

  // ========== 兑换日志 ==========

  function addExchangeLog(data) {
    const doc = {
      ...data,
      exchangedAt: firebase.firestore.Timestamp.now()
    };
    return db.collection(C.COLL_EXCHANGE_LOG).add(doc);
  }

  function getExchangeLogs() {
    return db.collection(C.COLL_EXCHANGE_LOG)
      .orderBy('exchangedAt', 'desc')
      .limit(200)
      .get()
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // ========== 扣分日志 ==========

  function addDeductionLog(data) {
    const doc = {
      ...data,
      deductedAt: firebase.firestore.Timestamp.now()
    };
    return db.collection(C.COLL_DEDUCTION_LOG).add(doc);
  }

  function getDeductionLogs() {
    return db.collection(C.COLL_DEDUCTION_LOG)
      .orderBy('deductedAt', 'desc')
      .limit(200)
      .get()
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  function getDeductionLogsByDateRange(uid, fromDateStr, toDateStr) {
    const fromDate = new Date(fromDateStr + 'T00:00:00');
    const toDate = new Date(toDateStr + 'T23:59:59.999');
    return db.collection(C.COLL_DEDUCTION_LOG)
      .where('userId', '==', uid)
      .where('deductedAt', '>=', firebase.firestore.Timestamp.fromDate(fromDate))
      .where('deductedAt', '<=', firebase.firestore.Timestamp.fromDate(toDate))
      .orderBy('deductedAt', 'asc')
      .get()
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // ========== 任务日志 ==========

  function addTaskLog(data) {
    const doc = {
      ...data,
      completedAt: firebase.firestore.Timestamp.now()
    };
    return db.collection(C.COLL_TASK_LOG).add(doc);
  }

  function getTaskLogs(uid, fromDateStr, toDateStr) {
    const fromDate = new Date(fromDateStr + 'T00:00:00');
    const toDate = new Date(toDateStr + 'T23:59:59.999');
    return db.collection(C.COLL_TASK_LOG)
      .where('userId', '==', uid)
      .where('completedAt', '>=', firebase.firestore.Timestamp.fromDate(fromDate))
      .where('completedAt', '<=', firebase.firestore.Timestamp.fromDate(toDate))
      .orderBy('completedAt', 'asc')
      .get()
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  function getExchangeLogsByDateRange(uid, fromDateStr, toDateStr) {
    const fromDate = new Date(fromDateStr + 'T00:00:00');
    const toDate = new Date(toDateStr + 'T23:59:59.999');
    return db.collection(C.COLL_EXCHANGE_LOG)
      .where('userId', '==', uid)
      .where('exchangedAt', '>=', firebase.firestore.Timestamp.fromDate(fromDate))
      .where('exchangedAt', '<=', firebase.firestore.Timestamp.fromDate(toDate))
      .orderBy('exchangedAt', 'asc')
      .get()
      .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // ========== 应用配置 ==========

  const APP_CONFIG_DOC_ID = 'config';

  function getAppConfig() {
    return db.collection(C.COLL_APP_CONFIG).doc(APP_CONFIG_DOC_ID).get()
      .then(doc => doc.exists ? doc.data() : null);
  }

  function updateAppConfig(data) {
    return db.collection(C.COLL_APP_CONFIG).doc(APP_CONFIG_DOC_ID).update(data);
  }

  function setAppConfig(data) {
    return db.collection(C.COLL_APP_CONFIG).doc(APP_CONFIG_DOC_ID).set(data, { merge: true });
  }

  function onAppConfigChange(callback) {
    return db.collection(C.COLL_APP_CONFIG).doc(APP_CONFIG_DOC_ID)
      .onSnapshot(doc => {
        if (doc.exists) callback(doc.data());
      });
  }

  // ========== 批量操作 ==========

  function runTransaction(updateFn) {
    return db.runTransaction(updateFn);
  }

  function batchWrite(operations) {
    const batch = db.batch();
    operations.forEach(op => {
      const ref = db.collection(op.collection).doc(op.id);
      switch (op.type) {
        case 'set': batch.set(ref, op.data); break;
        case 'update': batch.update(ref, op.data); break;
        case 'delete': batch.delete(ref); break;
      }
    });
    return batch.commit();
  }

  return {
    ORDER_INTERVAL,
    getTasks, onTasksChange, addTask, updateTask, deleteTask,
    getRewards, onRewardsChange, addReward, updateReward, deleteReward,
    getPointsConfig, onPointsConfigChange, updatePointsConfig, setPointsConfig,
    getStreak, onStreakChange, updateStreak, setStreak,
    addExchangeLog, getExchangeLogs, getExchangeLogsByDateRange,
    addDeductionLog, getDeductionLogs, getDeductionLogsByDateRange,
    addTaskLog, getTaskLogs,
    getAppConfig, updateAppConfig, setAppConfig, onAppConfigChange,
    runTransaction, batchWrite
  };
})();
