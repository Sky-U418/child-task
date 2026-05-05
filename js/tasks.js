// tasks.js — 任务生命周期管理

const TaskManager = (() => {
  const C = APP_CONFIG;

  /** 获取下一个 24:00（当天结束时刻） */
  function _getNextMidnight() {
    const d = new Date();
    d.setHours(C.DAILY_RESET_HOUR, 0, 0, 0);
    return firebase.firestore.Timestamp.fromDate(d);
  }

  /** 获取某个未来时间点 (小时) */
  function _getDeadline(hoursFromNow) {
    const d = new Date(Date.now() + hoursFromNow * 3600000);
    return firebase.firestore.Timestamp.fromDate(d);
  }

  // ========== 管理员操作 ==========

  /** 创建任务 */
  async function createTask({ title, description, type, points, deadline }) {
    const data = {
      title,
      description: description || '',
      type,
      points: parseInt(points, 10) || 1,
      status: C.TASK_STATUS_AVAILABLE,
      deadline: null,
      resetAt: null,
      completedAt: null,
      createdAt: firebase.firestore.Timestamp.now()
    };

    if (type === C.TASK_TYPE_DAILY) {
      data.resetAt = _getNextMidnight();
    } else if (type === C.TASK_TYPE_TIMED) {
      data.deadline = deadline || _getDeadline(24);
    }

    return Store.addTask(data);
  }

  /** 管理员标记任务完成 */
  async function markCompleted(taskId) {
    return Store.updateTask(taskId, {
      status: C.TASK_STATUS_COMPLETED,
      completedAt: firebase.firestore.Timestamp.now()
    });
  }

  /** 删除任务 */
  async function removeTask(taskId) {
    return Store.deleteTask(taskId);
  }

  // ========== 孩子操作 ==========

  /** 领取任务 (available → in_progress) */
  async function acceptTask(taskId) {
    return Store.updateTask(taskId, { status: C.TASK_STATUS_IN_PROGRESS });
  }

  /** 孩子获取任务积分 (completed → closed) — 事务保证原子性 */
  async function claimTaskPoints(taskId, uid) {
    return Store.runTransaction(async transaction => {
      // 读取任务（实时数据）
      const taskRef = db.collection(C.COLL_TASKS).doc(taskId);
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists) throw new Error('任务不存在');
      const task = taskDoc.data();
      if (task.status !== C.TASK_STATUS_COMPLETED) {
        throw new Error('任务尚未完成');
      }

      // 计算积分享受的倍率
      let multiplier = 1.0;
      if (task.type === C.TASK_TYPE_DAILY) {
        const streakRef = db.collection(C.COLL_STREAK).doc(uid);
        const streakDoc = await transaction.get(streakRef);
        if (streakDoc.exists) {
          multiplier = StreakManager.getTodayMultiplier(streakDoc.data());
        }
      }
      const earnedPoints = Math.round(task.points * multiplier);

      // 增加成果积分
      const pointsRef = db.collection(C.COLL_POINTS).doc('config');
      const pointsDoc = await transaction.get(pointsRef);
      if (pointsDoc.exists) {
        const config = pointsDoc.data();
        transaction.update(pointsRef, {
          achievementPoints: (config.achievementPoints || 0) + earnedPoints
        });
      }

      // 写入任务日志
      const logRef = db.collection(C.COLL_TASK_LOG).doc();
      transaction.set(logRef, {
        userId: uid,
        taskId: taskId,
        taskTitle: task.title,
        points: task.points,
        multiplier: multiplier,
        earnedPoints: earnedPoints,
        completedAt: firebase.firestore.Timestamp.now()
      });

      // 更新任务状态
      if (task.type === C.TASK_TYPE_DAILY) {
        transaction.update(taskRef, {
          status: C.TASK_STATUS_CLOSED,
          completedAt: null,
          resetAt: _getNextMidnight()
        });
      } else {
        transaction.update(taskRef, { status: C.TASK_STATUS_CLOSED });
      }

      return { earnedPoints, multiplier };
    });
  }

  // ========== 定时检查 ==========

  /** 检查并重置过期的每日任务 */
  async function checkDailyReset() {
    const tasks = await Store.getTasks();
    const now = firebase.firestore.Timestamp.now();

    const batchOps = [];
    for (const task of tasks) {
      if (task.type === C.TASK_TYPE_DAILY && task.resetAt) {
        if (task.resetAt.toMillis() <= now.toMillis() && task.status !== C.TASK_STATUS_AVAILABLE) {
          batchOps.push({
            collection: C.COLL_TASKS, id: task.id, type: 'update',
            data: { status: C.TASK_STATUS_AVAILABLE, resetAt: _getNextMidnight() }
          });
        }
      }
    }

    if (batchOps.length > 0) {
      await Store.batchWrite(batchOps);
    }
  }

  /** 检查并关闭过期的限时任务 */
  async function checkTimedExpiry() {
    const tasks = await Store.getTasks();
    const now = firebase.firestore.Timestamp.now();
    const graceExpiresAt = new firebase.firestore.Timestamp(now.seconds + 86400, 0);

    const batchOps = [];
    for (const task of tasks) {
      if (task.type === C.TASK_TYPE_TIMED && task.deadline) {
        if (task.deadline.toMillis() <= now.toMillis() && task.status !== C.TASK_STATUS_CLOSED) {
          batchOps.push({
            collection: C.COLL_TASKS, id: task.id, type: 'update',
            data: { status: C.TASK_STATUS_CLOSED, graceExpiresAt }
          });
        }
      }
    }

    if (batchOps.length > 0) {
      await Store.batchWrite(batchOps);
    }
  }

  /** 页面加载时执行所有检查 */
  async function runScheduledChecks() {
    await checkDailyReset();
    await checkTimedExpiry();
  }

  return {
    createTask, markCompleted, removeTask,
    acceptTask, claimTaskPoints,
    checkDailyReset, checkTimedExpiry, runScheduledChecks
  };
})();
