// animations.js — 视觉动画效果
// 积分飞入、粒子爆炸、数字滚动、脉冲等

const Animations = (() => {

  /**
   * 积分飞入动画
   * 从 sourceEl 飞到 targetEl，带粒子尾迹
   */
  function flyingPoints(sourceEl, targetEl, amount, color = '#00ff88') {
    const sRect = sourceEl.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();

    // 创建飞行数字
    const flier = document.createElement('div');
    flier.textContent = `+${amount}`;
    flier.style.cssText = `
      position: fixed;
      left: ${sRect.left + sRect.width / 2}px;
      top: ${sRect.top + sRect.height / 2}px;
      font-family: var(--font-display);
      font-size: 1.2rem;
      font-weight: 700;
      color: ${color};
      text-shadow: 0 0 10px ${color};
      pointer-events: none;
      z-index: var(--z-loader);
      transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      opacity: 1;
      transform: scale(1);
    `;
    document.body.appendChild(flier);

    // 粒子尾迹
    const particles = [];
    for (let i = 0; i < 6; i++) {
      const p = document.createElement('div');
      p.style.cssText = `
        position: fixed;
        left: ${sRect.left + sRect.width / 2}px;
        top: ${sRect.top + sRect.height / 2}px;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: ${color};
        box-shadow: 0 0 6px ${color};
        pointer-events: none;
        z-index: var(--z-loader);
        transition: all 0.5s ease-out;
      `;
      document.body.appendChild(p);
      particles.push(p);
    }

    // 触发飞行
    requestAnimationFrame(() => {
      const tX = tRect.left + tRect.width / 2;
      const tY = tRect.top + tRect.height / 2;
      flier.style.left = tX + 'px';
      flier.style.top = tY + 'px';
      flier.style.transform = 'scale(1.3)';
      flier.style.opacity = '0';

      particles.forEach((p, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const spread = 20 + Math.random() * 30;
        p.style.left = (tX + Math.cos(angle) * spread) + 'px';
        p.style.top = (tY + Math.sin(angle) * spread) + 'px';
        p.style.opacity = '0';
      });
    });

    // 清理
    setTimeout(() => {
      flier.remove();
      particles.forEach(p => p.remove());
    }, 700);
  }

  /**
   * 粒子爆炸效果（兑换成功等）
   */
  function particleBurst(el, color = '#ffb800', count = 12) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const particles = [];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      const size = 4 + Math.random() * 6;
      const angle = (i / count) * Math.PI * 2;
      const distance = 40 + Math.random() * 60;

      p.style.cssText = `
        position: fixed;
        left: ${cx}px;
        top: ${cy}px;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        box-shadow: 0 0 ${size}px ${color};
        pointer-events: none;
        z-index: var(--z-loader);
        transition: all 0.6s cubic-bezier(0, 0.7, 0.3, 1);
        opacity: 1;
      `;
      document.body.appendChild(p);
      particles.push({ el: p, x: cx + Math.cos(angle) * distance, y: cy + Math.sin(angle) * distance });
    }

    requestAnimationFrame(() => {
      particles.forEach(p => {
        p.el.style.left = p.x + 'px';
        p.el.style.top = p.y + 'px';
        p.el.style.opacity = '0';
        p.el.style.transform = 'scale(0)';
      });
    });

    setTimeout(() => particles.forEach(p => p.el.remove()), 700);
  }

  /**
   * 数字滚动动画（从 from 滚动到 to）
   */
  function countUp(el, from, to, duration = 600) {
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  /**
   * 脉冲动画 — 给元素添加短暂脉冲，结束后自动移除
   */
  function pulse(el) {
    el.style.transition = 'transform 0.15s ease';
    el.style.transform = 'scale(1.08)';
    setTimeout(() => {
      el.style.transform = 'scale(1)';
    }, 150);
  }

  /**
   * 环形进度条更新动画
   * @param {SVGCircleElement} circle — SVG circle 元素
   * @param {number} percent — 0-100
   * @param {number} duration — 动画时长 ms
   */
  function animateRing(circle, percent, duration = 800) {
    const total = 2 * Math.PI * circle.r.baseVal.value;
    const target = total * (1 - percent / 100);
    const start = parseFloat(circle.style.strokeDashoffset || total);
    const begin = performance.now();

    function tick(now) {
      const elapsed = now - begin;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      circle.style.strokeDashoffset = start + (target - start) * eased;

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  return { flyingPoints, particleBurst, countUp, pulse, animateRing };
})();
