// ui.js — UI 工具: Toast通知、模态框、加载覆盖层

const UI = (() => {

  // ========== Toast ==========

  let toastContainer = null;

  function _ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function toast(message, type = 'info', duration = 3000) {
    const container = _ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    container.appendChild(el);

    // 强制回流后触发入场
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add('is-visible');
      });
    });

    // 到时后移除
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ========== Modal ==========

  let activeModal = null;

  /**
   * 显示模态框
   * @param {Object} opts - { title, body (string|Element), footer (string|Element), onClose }
   * @returns {Element} modal 根节点
   */
  function modal(opts) {
    _closeModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modalEl = document.createElement('div');
    modalEl.className = 'modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');

    // Header
    const header = document.createElement('div');
    header.className = 'modal__header';

    const title = document.createElement('h3');
    title.className = 'modal__title';
    title.textContent = opts.title || '';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal__close';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => _closeModal(opts.onClose));
    header.appendChild(closeBtn);

    modalEl.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'modal__body';
    if (typeof opts.body === 'string') {
      body.innerHTML = opts.body;
    } else if (opts.body instanceof HTMLElement) {
      body.appendChild(opts.body);
    }
    modalEl.appendChild(body);

    // Footer
    if (opts.footer) {
      const footer = document.createElement('div');
      footer.className = 'modal__footer';
      if (typeof opts.footer === 'string') {
        footer.innerHTML = opts.footer;
      } else if (opts.footer instanceof HTMLElement) {
        footer.appendChild(opts.footer);
      }
      modalEl.appendChild(footer);
    }

    overlay.appendChild(modalEl);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _closeModal(opts.onClose);
    });

    document.body.appendChild(overlay);
    activeModal = { overlay, onClose: opts.onClose };
    return modalEl;
  }

  function _closeModal(onClose) {
    if (activeModal) {
      if (activeModal.onClose) activeModal.onClose();
      activeModal.overlay.remove();
      activeModal = null;
    } else if (onClose) {
      onClose();
    }
  }

  function closeModal() {
    _closeModal();
  }

  /**
   * 快捷确认弹窗
   * @returns {Promise<boolean>}
   */
  function confirm(title, message, confirmText = '确认', cancelText = '取消') {
    return new Promise(resolve => {
      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.gap = 'var(--space-sm)';
      footer.style.justifyContent = 'flex-end';
      footer.style.width = '100%';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn--ghost';
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener('click', () => { closeModal(); resolve(false); });

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn--primary';
      confirmBtn.textContent = confirmText;
      confirmBtn.addEventListener('click', () => { closeModal(); resolve(true); });

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);

      modal({ title, body: `<p>${message}</p>`, footer });
    });
  }

  // ========== Loading ==========

  let loadingOverlay = null;

  function showLoading(text = '加载中...') {
    if (loadingOverlay) return;
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="spinner"></div>
      <p class="loading-overlay__text">${text}</p>
    `;
    document.body.appendChild(loadingOverlay);
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.remove();
      loadingOverlay = null;
    }
  }

  // ========== DOM 工具 ==========

  /** 创建带属性的元素 */
  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') el.className = v;
      else if (k === 'innerHTML') el.innerHTML = v;
      else if (k === 'textContent') el.textContent = v;
      else if (k.startsWith('data')) el.setAttribute(k.replace(/([A-Z])/g, '-$1').toLowerCase(), v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    });
    children.forEach(c => {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else if (c instanceof HTMLElement) el.appendChild(c);
    });
    return el;
  }

  /** 安全获取模板内容 */
  function template(id) {
    const tpl = document.getElementById(id);
    return tpl ? tpl.content.cloneNode(true) : null;
  }

  return {
    toast, modal, closeModal, confirm,
    showLoading, hideLoading,
    createEl, template
  };
})();
