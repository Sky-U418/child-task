// app-config.js — 应用全局常量

const APP_CONFIG = Object.freeze({
  // 积分
  MAX_STREAK_MULTIPLIER: 2.0,
  STREAK_INCREMENT: 0.1,          // 每多连续一天 +0.1x
  BASE_POINTS_MIN: 1,
  BASE_POINTS_CAP_DEFAULT: 100,

  // 每日重置
  DAILY_RESET_HOUR: 24,           // 24点重置 (0 = 午夜)

  // 管理员
  PIN_MIN_LENGTH: 4,
  PIN_MAX_LENGTH: 8,

  // Firestore 集合名
  COLL_TASKS: 'tasks',
  COLL_REWARDS: 'rewards',
  COLL_POINTS: 'pointsConfig',
  COLL_STREAK: 'streak',
  COLL_EXCHANGE_LOG: 'exchangeLog',
  COLL_TASK_LOG: 'taskLog',
  COLL_DEDUCTION_LOG: 'deductionLog',
  COLL_RESOURCES: 'resources',
  COLL_BLACKBOARD: 'blackboard',
  COLL_QUIZZES: 'quizzes',
  COLL_QUIZ_SESSIONS: 'quizSessions',
  COLL_APP_CONFIG: 'appConfig',

  // 任务类型
  TASK_TYPE_DAILY: 'daily',
  TASK_TYPE_TIMED: 'timed',

  // 任务状态
  TASK_STATUS_AVAILABLE: 'available',
  TASK_STATUS_IN_PROGRESS: 'in_progress',
  TASK_STATUS_COMPLETED: 'completed',
  TASK_STATUS_CLOSED: 'closed',

  // 奖励类型
  REWARD_TYPE_PERIODIC: 'periodic',
  REWARD_TYPE_LIMITED: 'limited',

  // 奖励周期
  REWARD_PERIOD_DAILY: 'daily',
  REWARD_PERIOD_MONTHLY: 'monthly',

  // 最大兑换次数默认值
  REWARD_MAX_EXCHANGES_DEFAULT: 1,
});
