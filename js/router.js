// router.js — 路由守卫 & 模式控制

const Router = (() => {

  const ADMIN_SESSION_KEY = 'admin_authenticated';

  /** 孩子模式：直接放行 */
  function guardChild() {
    // 无需验证
  }

  /** 管理员模式：检查 PIN 验证状态 */
  function guardAdmin() {
    const auth = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (auth !== 'true') {
      // 未授权，跳回入口页
      window.location.href = 'index.html';
    }
  }

  /** PIN 验证 */
  async function verifyPIN(inputPIN) {
    const config = await Store.getAppConfig();
    if (!config || !config.adminPIN) {
      // 首次使用：没有设置 PIN，允许进入并提示设置
      return { success: true, firstTime: true };
    }

    // SHA-256 哈希比对
    const hash = await _sha256(inputPIN);
    if (hash === config.adminPIN) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      return { success: true, firstTime: false };
    }
    return { success: false, firstTime: false };
  }

  /** 设置或修改管理员 PIN */
  async function setAdminPIN(newPIN) {
    if (newPIN.length < APP_CONFIG.PIN_MIN_LENGTH) {
      throw new Error(`PIN 至少 ${APP_CONFIG.PIN_MIN_LENGTH} 位`);
    }
    if (newPIN.length > APP_CONFIG.PIN_MAX_LENGTH) {
      throw new Error(`PIN 最多 ${APP_CONFIG.PIN_MAX_LENGTH} 位`);
    }
    const hash = await _sha256(newPIN);
    await Store.setAppConfig({ adminPIN: hash });
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
  }

  /** 登出管理员 */
  function logoutAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = 'index.html';
  }

  /** 检查当前是否管理员模式 */
  function isAdminAuthenticated() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  }

  // SHA-256 哈希 (异步)
  async function _sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    guardChild, guardAdmin,
    verifyPIN, setAdminPIN, logoutAdmin, isAdminAuthenticated
  };
})();
