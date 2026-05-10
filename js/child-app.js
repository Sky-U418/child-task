// child-app.js — 孩子模式主逻辑

document.addEventListener('firebase:ready', async () => {
  const C = APP_CONFIG;
  const uid = window._uid;

  // ========== DOM 引用 ==========
  const $navTabs = document.querySelectorAll('.nav-tab');
  const $panels = document.querySelectorAll('.child-panel');

  // Points
  const $totalPoints = document.getElementById('totalPoints');
  const $basePoints = document.getElementById('basePoints');
  const $basePointsCap = document.getElementById('basePointsCap');
  const $achievePoints = document.getElementById('achievePoints');

  // Streak
  const $streakDays = document.getElementById('streakDays');
  const $streakMultiplier = document.getElementById('streakMultiplier');
  const $streakImg = document.getElementById('streakImg');
  const $streakProgressBar = document.getElementById('streakProgressBar');
  const $profileStreak = document.getElementById('profileStreak');
  const $profileMaxStreak = document.getElementById('profileMaxStreak');
  const $profileMultiplier = document.getElementById('profileMultiplier');

  // Task
  const $taskGrid = document.getElementById('taskGrid');

  // Reward
  const $rewardGrid = document.getElementById('rewardGrid');

  // Reports
  const $weeklyCards = document.getElementById('weeklyCards');
  const $monthlyCard = document.getElementById('monthlyCard');
  const $monthLabel = document.getElementById('monthLabel');
  const $btnMonthPrev = document.getElementById('btnMonthPrev');
  const $btnMonthNext = document.getElementById('btnMonthNext');

  let currentMonthOffset = 0;

  // Report detail
  const $reportDetailOverlay = document.getElementById('reportDetailOverlay');
  const $reportDetailTitle = document.getElementById('reportDetailTitle');
  const $reportDetailBody = document.getElementById('reportDetailBody');
  const $btnReportDetailClose = document.getElementById('btnReportDetailClose');
  let reportData = {};

  // Exchange log
  const $exchangeLogList = document.getElementById('exchangeLogList');
  const $exchangeLogHeader = document.getElementById('exchangeLogHeader');
  const $logCollapseArrow = document.getElementById('logCollapseArrow');
  const $btnClearLogs = document.getElementById('btnClearLogs');

  // Blackboard
  const $blackboardEmpty = document.getElementById('blackboardEmpty');
  const $blackboardText = document.getElementById('blackboardText');
  const $blackboardTextContent = document.getElementById('blackboardTextContent');
  const $blackboardResource = document.getElementById('blackboardResource');
  const $blackboardImg = document.getElementById('blackboardImg');
  const $blackboardVideo = document.getElementById('blackboardVideo');
  const $blackboardAudio = document.getElementById('blackboardAudio');
  const $blackboardOther = document.getElementById('blackboardOther');
  const $blackboardOtherName = document.getElementById('blackboardOtherName');
  const $blackboardYoutube = document.getElementById('blackboardYoutube');
  const $blackboardYoutubeIframe = document.getElementById('blackboardYoutubeIframe');
  const $blackboardExtLink = document.getElementById('blackboardExtLink');
  const $blackboardExtLinkName = document.getElementById('blackboardExtLinkName');
  const $blackboardExtLinkBtn = document.getElementById('blackboardExtLinkBtn');

  function _getLogHiddenBefore() {
    return parseInt(localStorage.getItem('exchangeLogHiddenBefore') || '0', 10);
  }

  // State
  let tasks = [];
  let rewards = [];
  let pointsConfig = null;
  let streak = null;

  // ========== 初始化 ==========

  await PointsManager.grantDailyBasePoints();
  await TaskManager.runScheduledChecks();
  await RewardManager.checkPeriodicReset();
  await StreakManager.checkStreakReset(uid);
  loadWeeklyReports();
  loadMonthlyReport(0);

  // 实时监听
  Store.onTasksChange(t => {
    tasks = t;
    renderTasks();
  });

  Store.onRewardsChange(r => {
    rewards = r;
    renderRewards();
  });

  Store.onPointsConfigChange(c => {
    pointsConfig = c;
    updatePointsDisplay();
    renderRewards(); // 积分变化可能影响兑换按钮状态
  });

  Store.onStreakChange(uid, s => {
    streak = s;
    updateStreakDisplay();
    renderTasks();
  });

  // 加载兑换记录（一次性）
  loadExchangeLogs();

  // 小黑板实时监听
  Store.onBlackboardChange(renderBlackboard);

  // 窗口 resize 时重新计算黑板文字字号

  // 定时重新渲染（处理不刷新页面的过期清理）
  setInterval(() => {
    renderTasks();
    renderRewards();
  }, 3600000);

  // 折叠切换
  $exchangeLogHeader.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    $exchangeLogList.classList.toggle('is-collapsed');
    $logCollapseArrow.classList.toggle('is-collapsed');
  });

  // 清空显示（记录时间戳，不删后台数据）
  $btnClearLogs.addEventListener('click', () => {
    localStorage.setItem('exchangeLogHiddenBefore', Date.now().toString());
    loadExchangeLogs();
    UI.toast('显示已清空', 'info');
  });

  // ========== Tab 导航 ==========

  $navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      $navTabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      const panelId = tab.dataset.panel;
      $panels.forEach(p => p.classList.remove('is-active'));
      document.getElementById('panel-' + panelId).classList.add('is-active');
    });
  });

  // ========== 积分显示 ==========

  function updatePointsDisplay() {
    if (!pointsConfig) return;
    const total = (pointsConfig.currentBasePoints || 0) + (pointsConfig.achievementPoints || 0);

    $totalPoints.textContent = total;
    $basePoints.textContent = pointsConfig.currentBasePoints || 0;
    $basePointsCap.textContent = pointsConfig.basePointsCap || 100;
    $achievePoints.textContent = pointsConfig.achievementPoints || 0;
  }

  // ========== 打卡显示 ==========

  function updateStreakDisplay() {
    if (!streak) return;
    const current = streak.currentStreak || 0;
    const mult = StreakManager.getTodayMultiplier(streak);

    $streakDays.textContent = current;
    $streakMultiplier.textContent = mult.toFixed(1) + 'x';
    $profileStreak.textContent = current;
    $profileMaxStreak.textContent = streak.maxStreak || 0;
    $profileMultiplier.textContent = mult.toFixed(1) + 'x';

    // 徽章图片与进度条
    let imgSrc, barColor, barPct;
    if (current === 0) {
      imgSrc = 'images/0.png';
      barColor = '#444';
      barPct = 0;
    } else {
      const posInCycle = ((current - 1) % 5) + 1;
      const cycle = Math.floor((current - 1) / 5);

      if (current >= 15) {
        imgSrc = 'images/1c.png';
      } else if (current >= 10) {
        imgSrc = 'images/1b.png';
      } else if (current >= 5) {
        imgSrc = 'images/1a.png';
      } else {
        imgSrc = 'images/0.png';
      }

      if (cycle >= 2) {
        barColor = '#42a5f5';
        barPct = current >= 15 ? 100 : posInCycle * 20;
      } else if (cycle === 1) {
        barColor = '#ff9800';
        barPct = posInCycle * 20;
      } else {
        barColor = '#ffe082';
        barPct = posInCycle * 20;
      }
    }

    $streakImg.src = imgSrc;
    $streakProgressBar.style.width = barPct + '%';
    $streakProgressBar.style.backgroundColor = barColor;
  }

  // ========== 小黑板工具函数 ==========

  function isYouTubeUrl(url) {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
  }

  function getYouTubeEmbedUrl(url) {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&rel=0' : url;
  }

  function isNonEmbeddableUrl(url) {
    return /drive\.google\.com|1drv\.ms|onedrive\.live\.com/.test(url);
  }

  function isBilibiliUrl(url) {
    return /bilibili\.com\/video\/|b23\.tv/.test(url);
  }

  function getBilibiliEmbedUrl(url) {
    // BV 号: bilibili.com/video/BVxxxxxxxxx
    const bv = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
    if (bv) return 'https://player.bilibili.com/player.html?bvid=' + bv[1] + '&autoplay=1';
    // AV 号 (旧格式): bilibili.com/video/av123456
    const av = url.match(/bilibili\.com\/video\/(av\d+)/i);
    if (av) return 'https://player.bilibili.com/player.html?aid=' + av[1].replace('av', '') + '&autoplay=1';
    return url;
  }

  // ========== 小黑板渲染 ==========

  // ---- Quiz Engine（测验引擎）----
  var _quizEngine = {
    quiz: null,
    session: null,
    sessionUnsub: null,
    timerHandle: null,
    timerRemaining: 0,
    timerTotal: 0,
    advanceTimer: null,
    container: null
  };

  function cleanupQuizEngine() {
    if (_quizEngine.sessionUnsub) { _quizEngine.sessionUnsub(); _quizEngine.sessionUnsub = null; }
    clearQuizTimer();
    if (_quizEngine.advanceTimer) { clearTimeout(_quizEngine.advanceTimer); _quizEngine.advanceTimer = null; }
    _quizEngine.quiz = null;
    _quizEngine.container = null;
  }

  function clearQuizTimer() {
    if (_quizEngine.timerHandle) { clearInterval(_quizEngine.timerHandle); _quizEngine.timerHandle = null; }
  }

  function renderBlackboard(data) {
    var ct = data && data.contentType ? data.contentType : null;

    // 隐藏所有
    $blackboardEmpty.style.display = 'none';
    $blackboardText.style.display = 'none';
    $blackboardResource.style.display = 'none';
    removeQuizContainer();
    cleanupQuizEngine();

    if (!ct) {
      $blackboardEmpty.style.display = '';
      return;
    }

    if (ct === 'text' && data.textContent) {
      $blackboardTextContent.textContent = data.textContent;
      $blackboardText.style.display = '';
      fitBlackboardText();
    } else if (ct === 'resource') {
      $blackboardResource.style.display = '';
      $blackboardImg.style.display = 'none';
      $blackboardVideo.style.display = 'none';
      $blackboardAudio.style.display = 'none';
      $blackboardOther.style.display = 'none';
      $blackboardYoutube.style.display = 'none';
      $blackboardExtLink.style.display = 'none';
      $blackboardYoutubeIframe.src = '';

      var rct = data.resourceContentType || '';
      var url = data.resourceUrl || '';

      if (rct.startsWith('image/')) {
        $blackboardImg.src = url;
        $blackboardImg.style.display = '';
      } else if (rct.startsWith('video/')) {
        if (isYouTubeUrl(url)) {
          $blackboardYoutubeIframe.src = getYouTubeEmbedUrl(url);
          $blackboardYoutube.style.display = '';
        } else if (isBilibiliUrl(url)) {
          $blackboardYoutubeIframe.src = getBilibiliEmbedUrl(url);
          $blackboardYoutube.style.display = '';
        } else if (isNonEmbeddableUrl(url)) {
          $blackboardExtLinkName.textContent = data.resourceName || '视频资源';
          $blackboardExtLinkBtn.href = url;
          $blackboardExtLink.style.display = '';
        } else {
          $blackboardVideo.src = url;
          $blackboardVideo.onerror = function() {
            $blackboardVideo.style.display = 'none';
            $blackboardExtLinkName.textContent = data.resourceName || '视频资源';
            $blackboardExtLinkBtn.href = url;
            $blackboardExtLink.style.display = '';
          };
          $blackboardVideo.style.display = '';
        }
      } else if (rct.startsWith('audio/')) {
        if (isNonEmbeddableUrl(url)) {
          $blackboardExtLinkName.textContent = data.resourceName || '音频资源';
          $blackboardExtLinkBtn.href = url;
          $blackboardExtLink.style.display = '';
        } else {
          $blackboardAudio.src = url;
          $blackboardAudio.style.display = '';
        }
      } else {
        $blackboardOtherName.textContent = data.resourceName || '未知资源';
        $blackboardOther.style.display = '';
      }
    } else if (ct === 'quiz' && data.quizId) {
      initQuizEngine(data.quizId);
    }
  }

  function removeQuizContainer() {
    var existing = document.getElementById('blackboardQuizContainer');
    if (existing) existing.remove();
  }

  // ========== Quiz Engine 核心 ==========

  function initQuizEngine(quizId) {
    var frame = document.querySelector('.blackboard-frame');
    if (!frame) return;

    removeQuizContainer();
    cleanupQuizEngine();

    var container = document.createElement('div');
    container.className = 'blackboard-quiz';
    container.id = 'blackboardQuizContainer';
    container.innerHTML = '<div class="blackboard-quiz__title">📝 测验</div><p style="text-align:center;color:var(--color-text-muted);padding:var(--space-lg)">加载中...</p>';
    frame.appendChild(container);
    _quizEngine.container = container;

    Store.getQuiz(quizId).then(function(quiz) {
      if (!quiz) {
        container.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:var(--space-lg)">测验已失效</p>';
        return;
      }
      _quizEngine.quiz = quiz;

      // 监听 session 变化 → 驱动渲染
      _quizEngine.sessionUnsub = Store.onQuizSessionChange(function(session) {
        onQuizSessionChange(container, quiz, session);
      });

      // 检查已有 session 或创建新 session
      Store.getQuizSession().then(function(session) {
        if (session && session.quizId === quizId && session.phase !== 'done') {
          // 已有活跃 session，onSessionChange 会处理渲染
        } else {
          createNewSession(quiz);
        }
      });
    }).catch(function(err) {
      console.error('加载测验失败:', err);
      container.innerHTML = '<p style="text-align:center;color:var(--color-danger);padding:var(--space-lg)">加载失败</p>';
    });
  }

  function createNewSession(quiz) {
    var questions = quiz.questions || [];
    var results = questions.map(function(q) {
      return {
        type: q.type || 'choice',
        status: 'pending',
        childAnswer: null,
        isCorrect: null,
        earned: 0
      };
    });
    Store.setQuizSession({
      quizId: _quizEngine.quiz.id,
      phase: 'answering',
      currentIndex: 0,
      totalEarned: 0,
      childConfirmed: false,
      questionResults: results
    });
  }

  function renderTimerBarHTML(pct) {
    return '<div class="quiz-timer-bar"><div class="quiz-timer-bar__fill" id="quizTimerFill" style="width:' + pct + '%"></div></div>';
  }

  function startTimer(seconds, container, qIdx) {
    _quizEngine.timerRemaining = seconds;
    _quizEngine.timerTotal = seconds;
    clearQuizTimer();
    _quizEngine.timerHandle = setInterval(function() {
      _quizEngine.timerRemaining--;
      if (_quizEngine.timerRemaining <= 0) {
        clearQuizTimer();
        handleTimeout(qIdx);
        return;
      }
      var pct = (_quizEngine.timerRemaining / _quizEngine.timerTotal) * 100;
      var fill = document.getElementById('quizTimerFill');
      if (fill) {
        fill.style.width = pct + '%';
        if (pct < 20) fill.classList.add('is-critical');
      }
    }, 1000);
  }

  function renderCurrentQuestion(container, quiz, session) {
    var questions = quiz.questions || [];
    var isRetry = (session.phase === 'retry');
    var idx = session.currentIndex;
    var q = questions[idx];
    var result = session.questionResults[idx];
    if (!q || !result) return;

    // 判断是否已回答（区分首次答题和回访）
    var isAnswered = isRetry
      ? (result.retryStatus === 'retry-graded' || result.retryStatus === 'retry-submitted' || result.retryIsCorrect !== undefined)
      : (result.status !== 'pending');

    var html = '';
    // 进度条（仅在答题阶段且非回访模式下有时间限制时显示）
    if (!isRetry && q.timeLimit > 0 && !isAnswered) {
      html += renderTimerBarHTML(100);
    }
    // 阶段标签
    html += '<div class="blackboard-quiz__title">📝 ' + SharedUI.esc(quiz.title) + (isRetry ? ' — 错题回访' : '') + '</div>';

    // 累计积分显示
    var currentTotal = 0;
    session.questionResults.forEach(function(r) { currentTotal += (r.earned || 0) + (r.retryEarned || 0); });
    var quizTotal = quiz.totalPoints || 0;
    html += '<div class="blackboard-quiz__score-hint">当前得分：' + currentTotal + ' / ' + quizTotal + ' 分</div>';

    // 题目内容
    html += '<div class="blackboard-quiz__question">';

    // 题型题号头（三种题型统一格式）
    var qHeaders = { choice: '选择正确的答案', fill: '填入正确的答案', read: '朗读下面的文字' };
    html += '<div class="blackboard-quiz__qtext">第' + (idx + 1) + '题：' + (qHeaders[q.type] || '') + '</div>';

    // 题目文字（所有题型统一：居中大字体，自动适应）
    html += '<div class="blackboard-quiz__qcontent" id="qContent">' + SharedUI.esc(q.question) + '</div>';

    if (isAnswered) {
      html += renderResultContent(q, result, isRetry);
    } else {
      html += renderAnswerInput(q, result, isRetry);
    }
    html += '</div>';
    container.innerHTML = html;

    // 启动计时器
    if (!isRetry && q.timeLimit > 0 && !isAnswered) {
      startTimer(q.timeLimit, container, idx);
    }

    // 绑定答题事件
    if (!isAnswered) {
      bindAnswerEvents(container, q, idx, session);
    }

    // 渲染后自动调整题目文字字体大小（所有题型）
    setTimeout(autoSizeQContent, 0);

    // 如果当前题已有最终结果（已批改/超时），自动前进
    if (isAnswered) {
      var isFinal = false;
      if (result.status === 'timedout') {
        isFinal = true;
      } else if (isRetry) {
        isFinal = (result.retryIsCorrect === true || result.retryIsCorrect === false);
      } else {
        // 选择题自动判分后已设置 isCorrect
        // 填空/朗读被家长批改后设置 isCorrect
        isFinal = (result.isCorrect === true || result.isCorrect === false);
      }
      if (isFinal) {
        _quizEngine.advanceTimer = setTimeout(function() {
          var latestResults = session.questionResults.slice();
          var lt = 0;
          latestResults.forEach(function(r) { lt += (r.earned || 0) + (r.retryEarned || 0); });
          doAdvance(session, latestResults, lt);
        }, 2500);
      }
    }
  }

  function renderAnswerInput(q, result, isRetry) {
    var type = q.type || 'choice';
    var html = '';
    if (type === 'choice') {
      var options = q.options || [];
      html += '<div class="blackboard-quiz__options">';
      for (var j = 0; j < options.length; j++) {
        html += '<label class="blackboard-quiz__option" data-optidx="' + j + '">' +
          '<input type="radio" name="quiz_answer" value="' + j + '">' +
          '<span>' + SharedUI.esc(options[j]) + '</span>' +
        '</label>';
      }
      html += '</div>';
      html += '<div style="text-align:right;margin-top:var(--space-sm)"><button class="btn btn--primary btn--sm" id="btnChoiceSubmit">确认</button></div>';
    } else if (type === 'fill') {
      html += '<div class="blackboard-quiz__fill">' +
        '<input type="text" class="blackboard-quiz__fill-input" id="quizFillInput" placeholder="输入答案..." maxlength="200">' +
      '</div>';
    } else if (type === 'read') {
      html += '<div style="text-align:right;margin-top:var(--space-md)"><button class="btn btn--primary btn--sm" id="btnReadDone">朗读完成</button></div>';
    }
    return html;
  }

  function bindAnswerEvents(container, q, qIdx, session) {
    var type = q.type || 'choice';

    if (type === 'choice') {
      container.querySelectorAll('.blackboard-quiz__option').forEach(function(el) {
        el.addEventListener('click', function() {
          container.querySelectorAll('.blackboard-quiz__option').forEach(function(opt) {
            opt.classList.remove('is-selected');
          });
          this.classList.add('is-selected');
          var radio = this.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
        });
      });
      var choiceSubmitBtn = container.querySelector('#btnChoiceSubmit');
      if (choiceSubmitBtn) {
        choiceSubmitBtn.addEventListener('click', function() {
          var selected = container.querySelector('.blackboard-quiz__option.is-selected');
          if (!selected) { UI.toast('请先选择一个答案', 'error'); return; }
          var answer = parseInt(selected.dataset.optidx, 10);
          submitChoiceAnswer(qIdx, answer, session);
        });
      }
    } else if (type === 'fill') {
      var input = document.getElementById('quizFillInput');
      if (input) {
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            submitFillAnswer(qIdx, input.value.trim(), session);
          }
        });
        // 提交按钮
        var submitBtn = container.querySelector('.blackboard-quiz__fill-submit');
        // 没有按钮，用回车提交，或者加一个
      }
      // 加一个提交按钮
      var fillArea = container.querySelector('.blackboard-quiz__fill');
      if (fillArea) {
        var btn = document.createElement('button');
        btn.className = 'btn btn--primary btn--sm';
        btn.textContent = '提交';
        btn.style.marginTop = 'var(--space-sm)';
        btn.addEventListener('click', function() {
          submitFillAnswer(qIdx, input.value.trim(), session);
        });
        fillArea.appendChild(btn);
      }
    } else if (type === 'read') {
      var readBtn = container.querySelector('#btnReadDone');
      if (readBtn) {
        readBtn.addEventListener('click', function() {
          submitReadAnswer(qIdx, session);
        });
      }
    }
  }

  // ========== 朗读完成 ==========

  function submitReadAnswer(qIdx, session) {
    var results = session.questionResults.slice();
    var isRetry = (session.phase === 'retry');
    var update;
    if (isRetry) {
      update = {
        retryStatus: 'retry-submitted',
        retryChildAnswer: 'read'
      };
    } else {
      update = {
        status: 'submitted',
        childAnswer: 'read'
      };
    }
    results[qIdx] = Object.assign({}, results[qIdx], update);
    var newTotal = 0;
    results.forEach(function(r) { newTotal += (r.earned || 0) + (r.retryEarned || 0); });
    Store.updateQuizSession({ questionResults: results, totalEarned: newTotal });
  }

  // ========== 提交处理 ==========

  function submitChoiceAnswer(qIdx, answer, session) {
    var q = _quizEngine.quiz.questions[qIdx];
    var isRetry = (session.phase === 'retry');
    var isCorrect;
    var pts;

    if (isRetry) {
      isCorrect = (answer === q.correctIndex);
      pts = isCorrect ? Math.floor((q.points !== undefined ? q.points : 5) / 2) : 0;
    } else {
      isCorrect = (answer === q.correctIndex);
      pts = isCorrect ? (q.points !== undefined ? q.points : 5) : 0;
    }

    var results = session.questionResults.slice();
    if (isRetry) {
      results[qIdx] = Object.assign({}, results[qIdx], {
        retryStatus: 'retry-graded',
        retryChildAnswer: answer,
        retryIsCorrect: isCorrect,
        retryEarned: pts
      });
    } else {
      results[qIdx] = Object.assign({}, results[qIdx], {
        status: 'submitted',
        childAnswer: answer,
        isCorrect: isCorrect,
        earned: pts
      });
    }

    var newTotal = 0;
    results.forEach(function(r) { newTotal += (r.earned || 0) + (r.retryEarned || 0); });

    Store.updateQuizSession({ questionResults: results, totalEarned: newTotal });
    doAdvance(session, results, newTotal);
  }

  function submitFillAnswer(qIdx, answer, session) {
    if (!answer) { UI.toast('请输入答案', 'error'); return; }
    var isRetry = (session.phase === 'retry');

    var results = session.questionResults.slice();
    if (isRetry) {
      results[qIdx] = Object.assign({}, results[qIdx], {
        retryStatus: 'retry-submitted',
        retryChildAnswer: answer,
        retryIsCorrect: null,
        retryEarned: 0
      });
    } else {
      results[qIdx] = Object.assign({}, results[qIdx], {
        status: 'submitted',
        childAnswer: answer,
        isCorrect: null,
        earned: 0
      });
    }

    Store.updateQuizSession({ questionResults: results });
    UI.toast('答案已提交，等待批改', 'info');
  }

  function handleTimeout(qIdx) {
    var session = _quizEngine.session;
    if (!session) return;
    var results = session.questionResults.slice();
    results[qIdx] = Object.assign({}, results[qIdx], {
      status: 'timedout',
      childAnswer: null,
      isCorrect: false,
      earned: 0
    });
    var newTotal = 0;
    results.forEach(function(r) { newTotal += (r.earned || 0) + (r.retryEarned || 0); });
    Store.updateQuizSession({ questionResults: results, totalEarned: newTotal });
    // 超时后短暂等待，再自动前进
    _quizEngine.advanceTimer = setTimeout(function() {
      doAdvance(session, results, newTotal);
    }, 800);
  }

  function doAdvance(session, results, newTotal) {
    if (!newTotal) {
      newTotal = 0;
      results.forEach(function(r) { newTotal += (r.earned || 0) + (r.retryEarned || 0); });
    }
    var isRetry = (session.phase === 'retry');
    var nextIdx;

    if (isRetry) {
      // 回访模式：按 retryQueue 顺序跳到下一道错题
      var rq = session.retryQueue || [];
      var curPos = rq.indexOf(session.currentIndex);
      if (curPos >= 0 && curPos + 1 < rq.length) {
        nextIdx = rq[curPos + 1];
      } else {
        nextIdx = results.length; // 所有回访题完成
      }
    } else {
      nextIdx = session.currentIndex + 1;
    }

    // 检查当前题是否需要等家长批改（回访模式下）
    if (isRetry && nextIdx < results.length) {
      var curResult = results[session.currentIndex];
      if (curResult && (curResult.type === 'fill' || curResult.type === 'read') && curResult.retryStatus === 'retry-submitted' && curResult.retryIsCorrect === null) {
        return; // 等家长批完再跳
      }
    }

    if (nextIdx < results.length) {
      Store.updateQuizSession({
        currentIndex: nextIdx,
        totalEarned: newTotal,
        questionResults: results
      });
    } else {
      // 所有题目走完 → 检查是否还有题在等批改
      var hasPendingGrade = false;
      results.forEach(function(r) {
        if ((r.type === 'fill' || r.type === 'read') && r.isCorrect === null) {
          hasPendingGrade = true;
        }
        if (r.retryStatus === 'retry-submitted' && r.retryIsCorrect === null) {
          hasPendingGrade = true;
        }
      });
      if (hasPendingGrade) return; // 还有题目在等家长批改，等待

      if (isRetry) {
        // 回访结束 → 进入总结页
        Store.updateQuizSession({
          phase: 'summary',
          totalEarned: newTotal,
          questionResults: results
        });
        return;
      }
      var wrongIndices = [];
      results.forEach(function(r, i) {
        if (r.type !== 'read' && r.type !== 'fill') {
          if (r.status === 'timedout' || r.isCorrect === false) wrongIndices.push(i);
        } else {
          // 填空/朗读：批改错误才算错
          if (r.isCorrect === false) wrongIndices.push(i);
        }
      });
      if (wrongIndices.length > 0) {
        startRetryPhase(results, wrongIndices);
      } else {
        Store.updateQuizSession({
          phase: 'summary',
          totalEarned: newTotal,
          questionResults: results
        });
      }
    }
  }

  // ========== 错题回访 ==========

  function startRetryPhase(results, wrongIndices) {
    var retryQueue = wrongIndices.slice();
    var firstRetryIdx = retryQueue[0];
    var currentTotal = 0;
    results.forEach(function(r) { currentTotal += (r.earned || 0); });
    Store.updateQuizSession({
      phase: 'retry',
      currentIndex: firstRetryIdx,
      retryQueue: retryQueue,
      totalEarned: currentTotal,
      questionResults: results
    });
  }

  function isRetryQuestion(idx, session) {
    var queue = session.retryQueue || [];
    return queue.indexOf(idx) !== -1;
  }

  function getRetryResultIndex(session, originalIdx) {
    return (session.retryQueue || []).indexOf(originalIdx);
  }

  // ========== 题目文字自动字体大小 ==========

  function autoSizeQContent() {
    var el = document.getElementById('qContent');
    if (!el) return;
    var origWS = el.style.whiteSpace;
    el.style.whiteSpace = 'nowrap';
    var maxW = el.offsetWidth;
    var size = 60;
    el.style.fontSize = size + 'px';
    while (size > 14 && el.scrollWidth > maxW * 1.05) {
      size -= 2;
      el.style.fontSize = size + 'px';
    }
    el.style.whiteSpace = origWS;
  }

  // ========== 结果渲染 ==========

  function renderResultContent(q, result, isRetry) {
    var type = q.type || 'choice';
    var html = '';
    var esc = SharedUI.esc;

    if (isRetry) {
      // 回访模式：检查 retry 状态
      if (type === 'fill' && result.retryStatus === 'retry-submitted' && result.retryIsCorrect === null) {
        html += '<div class="blackboard-quiz__result is-pending">';
        html += '<p>⏳ 你的答案：' + esc(result.retryChildAnswer) + '</p>';
        html += '<p style="color:var(--color-text-muted)">等待家长批改中...</p>';
        html += '</div>';
        return html;
      }
      if (type === 'read' && result.retryIsCorrect === null) {
        html += '<div class="blackboard-quiz__result is-pending">';
        html += '<p>🎤 请家长评判（回访）</p>';
        html += '</div>';
        return html;
      }
    } else {
      // 首次答题
      if (type === 'fill' && result.status === 'submitted' && result.isCorrect === null) {
        html += '<div class="blackboard-quiz__result is-pending">';
        html += '<p>⏳ 你的答案：' + esc(result.childAnswer) + '</p>';
        html += '<p style="color:var(--color-text-muted)">等待家长批改中...</p>';
        html += '</div>';
        return html;
      }
      if (type === 'read' && result.status === 'pending') {
        html += '<div class="blackboard-quiz__result is-pending">';
        html += '<p>🎤 请家长评判</p>';
        html += '</div>';
        return html;
      }
      if (type === 'read' && result.status === 'submitted' && result.isCorrect === null) {
        html += '<div class="blackboard-quiz__result is-pending">';
        html += '<p style="color:var(--color-text-muted)">已读完，等待家长评判...</p>';
        html += '</div>';
        return html;
      }
      if (result.status === 'timedout') {
        html += '<div class="blackboard-quiz__result is-wrong"><p>⏰ 超时，该题不计分</p></div>';
        return html;
      }
    }

    var earned = 0;
    var isCorrect = result.isCorrect;
    if (isRetry) {
      earned = result.retryEarned || 0;
      isCorrect = result.retryIsCorrect;
    } else {
      earned = result.earned || 0;
    }

    if (isCorrect) {
      html += '<div class="blackboard-quiz__result is-correct"><p>✅ 正确！+' + earned + '分</p></div>';
      if (isRetry) {
        html += '<div class="blackboard-quiz__score-sub">(回访 +' + earned + '分)</div>';
      }
    } else if (isCorrect === false) {
      html += '<div class="blackboard-quiz__result is-wrong"><p>❌ 不正确</p></div>';
      // 非回访时显示正确答案参考
      if (!isRetry && type === 'choice' && q.options && q.correctIndex !== undefined) {
        html += '<div class="blackboard-quiz__score-sub">正确答案：' + esc(q.options[q.correctIndex]) + '</div>';
      }
      if (!isRetry && type === 'fill' && q.acceptableAnswers) {
        html += '<div class="blackboard-quiz__score-sub">参考答案：' + esc(q.acceptableAnswers.join('、')) + '</div>';
      }
    }

    return html;
  }

  // ========== 汇总页 ==========

  function renderSummary(container, quiz, session) {
    var questions = quiz.questions || [];
    var results = session.questionResults || [];
    var totalQuestions = questions.length;
    var correctCount = 0;
    var totalEarned = 0;

    results.forEach(function(r, i) {
      var isCorrect = r.isCorrect === true;
      var retryCorrect = r.retryIsCorrect === true;
      if (isCorrect || retryCorrect) correctCount++;
      totalEarned += (r.earned || 0);
      if (r.retryEarned) totalEarned += r.retryEarned;
    });

    var allRetryDone = true;
    results.forEach(function(r) {
      if (r.isCorrect === false || r.status === 'timedout') {
        // 需要回访的题
        if (r.retryStatus !== 'graded' && r.retryStatus !== 'submitted') {
          // 回访未完成
          if (r.retryStatus !== 'retry-graded' && r.retryStatus !== 'retry-submitted') {
            if (r.retryIsCorrect === undefined && r.retryEarned === undefined) {
              allRetryDone = false;
            }
          }
        }
      }
    });
    // 更简单的判断：如果 phase 是 summary 且 retryQueue 还存在但所有题都已回访
    // 直接用 session.phase === 'summary' 表示回访已完成

    var html = '';
    html += '<div class="blackboard-quiz__title">📝 ' + SharedUI.esc(quiz.title) + ' — 完成！</div>';

    html += '<div class="blackboard-quiz__summary">';
    html += '<div class="blackboard-quiz__score">答对 ' + correctCount + ' / ' + totalQuestions + ' 题</div>';
    html += '<div class="blackboard-quiz__score-sub">共获得 ' + totalEarned + ' 分</div>';
    html += '</div>';

    // 逐题明细
    html += '<div class="blackboard-quiz__summary-detail">';
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var r = results[i];
      var icon = '';
      var detail = '';
      if (r.isCorrect === true) {
        icon = '✅';
        detail = '+' + (r.earned || 0) + '分';
      } else if (r.retryIsCorrect === true) {
        icon = '🔁✅';
        detail = '+' + (r.retryEarned || 0) + '分(回访)';
      } else if (r.status === 'timedout') {
        icon = '⏰';
        detail = '超时';
      } else if (r.isCorrect === false) {
        icon = '❌';
        detail = '未答对';
      } else if (r.retryIsCorrect === false) {
        icon = '❌';
        detail = '回访未过';
      } else {
        icon = '❓';
        detail = '未完成';
      }
      html += '<div class="blackboard-quiz__summary-row">' +
        '<span>' + icon + ' ' + SharedUI.esc(q.question) + '</span>' +
        '<span class="blackboard-quiz__summary-pts">' + detail + '</span>' +
      '</div>';
    }
    html += '</div>';

    // 确认按钮
    if (session.childConfirmed) {
      html += '<div class="blackboard-quiz__confirm" style="text-align:center;padding:var(--space-md)">';
      html += '<p style="color:var(--color-primary);font-weight:bold">✅ 已领取 ' + totalEarned + ' 分</p>';
      html += '</div>';
    } else {
      html += '<div class="blackboard-quiz__confirm" style="text-align:center;padding:var(--space-md)">';
      html += '<button class="btn btn--primary" id="btnConfirmClaim">确认领取 ' + totalEarned + ' 分</button>';
      html += '</div>';
    }

    container.innerHTML = html;

    // 绑确认事件
    var btn = document.getElementById('btnConfirmClaim');
    if (btn) {
      btn.addEventListener('click', function() {
        handleConfirmClaim(container, session);
      });
    }
  }

  function handleConfirmClaim(container, session) {
    var totalEarned = 0;
    (session.questionResults || []).forEach(function(r) {
      totalEarned += (r.earned || 0);
      if (r.retryEarned) totalEarned += r.retryEarned;
    });

    PointsManager.addAchievementPoints(totalEarned).then(function() {
      UI.toast('获得 ' + totalEarned + ' 成果积分！', 'success');
      // 写入兑换记录
      Store.addExchangeLog({
        type: 'quiz_reward',
        points: totalEarned,
        userId: window._uid,
        description: _quizEngine.quiz ? _quizEngine.quiz.title : ''
      });
      // 更新显示已领取，然后关闭
      Store.updateQuizSession({ childConfirmed: true });
      setTimeout(function() {
        cleanupQuizEngine();
        Store.deleteQuizSession();
        Store.setBlackboard({
          contentType: null,
          textContent: '',
          resourceId: '',
          resourceName: '',
          resourceUrl: '',
          resourceContentType: ''
        });
        var frame = document.querySelector('.blackboard-frame');
        if (frame) {
          var existing = document.getElementById('blackboardQuizContainer');
          if (existing) existing.remove();
        }
        $blackboardEmpty.style.display = '';
      }, 1500);
    }).catch(function(err) {
      console.error('领取积分失败:', err);
      UI.toast('领取失败，请重试', 'error');
    });
  }

  // ========== Session 变化驱动渲染（增强版）==========

  function onQuizSessionChange(container, quiz, session) {
    if (!session || session.phase === 'done' || session.phase === null) {
      container.innerHTML = '<div class="blackboard-quiz__title">📝 测验</div><p style="text-align:center;color:var(--color-text-muted);padding:var(--space-lg)">等待中...</p>';
      return;
    }

    _quizEngine.session = session;

    clearQuizTimer();
    if (_quizEngine.advanceTimer) { clearTimeout(_quizEngine.advanceTimer); _quizEngine.advanceTimer = null; }

    if (session.phase === 'summary') {
      renderSummary(container, quiz, session);
    } else if (session.phase === 'answering' || session.phase === 'retry') {
      renderCurrentQuestion(container, quiz, session);
    }
  }


  function fitBlackboardText() {
    const frame = document.querySelector('.blackboard-frame');
    const span = $blackboardTextContent;
    if (!frame || !span) return;

    span.style.fontSize = '';
    const maxW = frame.clientWidth - 32;
    const maxH = frame.clientHeight - 32;

    let lo = 16, hi = 120, best = 16;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      span.style.fontSize = mid + 'px';
      if (span.scrollWidth <= maxW && span.scrollHeight <= maxH) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    span.style.fontSize = best + 'px';
  }

  window.addEventListener('resize', () => {
    if ($blackboardText.style.display !== 'none') {
      fitBlackboardText();
    }
  });

  // ========== 任务渲染 ==========

  function renderTasks() {
    const now = Date.now();
    const activeTasks = tasks.filter(t => {
      if (t.status !== C.TASK_STATUS_CLOSED) return true;
      // 过期/管理员关闭 → graceExpiresAt 之前保留
      if (t.graceExpiresAt) return t.graceExpiresAt.toDate().getTime() > now;
      // 正常领取完成 → 立即消失（含旧数据残留的 closedAt 字段）
      return false;
    });

    if (activeTasks.length === 0) {
      $taskGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🛰️</div>
          <p class="empty-state__text">暂无任务，等待指挥官发布...</p>
        </div>`;
      return;
    }

    $taskGrid.innerHTML = activeTasks.map(t => {
      const isExpired = t.status === 'closed' && t.graceExpiresAt;
      const effectiveStatus = isExpired ? 'expired' : t.status;
      const statusClass = 'task-card--' + effectiveStatus;
      const statusLabel = {
        available: '可领取',
        in_progress: '进行中',
        completed: '任务完成！',
        expired: '已过期'
      }[effectiveStatus] || '';
      const typeLabel = t.type === 'daily' ? '每日' : '限时';

      let timerHTML = '';
      if (t.type === 'timed' && t.deadline) {
        const remaining = t.deadline.toDate().getTime() - Date.now();
        if (remaining > 0) {
          const days = Math.ceil(remaining / 86400000);
          const deadline = t.deadline.toDate();
          const expireDate = `${deadline.getMonth() + 1}/${deadline.getDate()}`;
          timerHTML = `<span class="task-card__timer">⏳ ${days}天 · ${expireDate}到期</span>`;
        } else if (t.status !== C.TASK_STATUS_CLOSED) {
          timerHTML = '<span class="task-card__timer is-expired">已过期</span>';
        }
      }

      let actionBtn = '';
      if (t.status === C.TASK_STATUS_AVAILABLE) {
        if (t.type === 'timed' && t.deadline && t.deadline.toDate().getTime() <= Date.now()) {
          actionBtn = `<button class="btn btn--ghost btn--sm" disabled>已过期</button>`;
        } else {
          actionBtn = `<button class="btn btn--primary btn--sm" data-action="accept" data-id="${t.id}">接受任务</button>`;
        }
      } else if (t.status === C.TASK_STATUS_COMPLETED) {
        const mult = (t.type === 'daily' && streak) ? StreakManager.getTodayMultiplier(streak) : 1.0;
        const earned = Math.round(t.points * mult);
        actionBtn = `<button class="btn btn--success btn--sm glow-btn" data-action="claim" data-id="${t.id}">领取 +${earned}</button>`;
      }

      return `
        <div class="task-card ${statusClass}" data-task-id="${t.id}">
          <div class="task-card__header">
            <span class="task-card__title">${SharedUI.esc(t.title)}</span>
            <span class="task-card__points">+${(t.type === 'daily' && streak) ? Math.round(t.points * StreakManager.getTodayMultiplier(streak)) : t.points}</span>
          </div>
          ${t.description ? `<p class="task-card__desc">${SharedUI.esc(t.description)}</p>` : ''}
          <div class="task-card__footer">
            <span class="task-card__status">
              <span class="status-dot status-dot--${t.status}"></span>
              ${statusLabel}
              <span class="tag ${t.type === 'daily' ? 'tag--daily' : 'tag--timed'}">${typeLabel}</span>
            </span>
            ${timerHTML}
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  }

  // 任务按钮事件（事件委托）
  $taskGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const taskId = btn.dataset.id;

    if (action === 'accept') {
      try {
        await TaskManager.acceptTask(taskId);
        UI.toast('任务已接受，开始执行吧！', 'success');
      } catch (err) {
        UI.toast('操作失败: ' + err.message, 'error');
      }
    } else if (action === 'claim') {
      const taskEl = document.querySelector(`[data-task-id="${taskId}"]`);
      try {
        const result = await TaskManager.claimTaskPoints(taskId, uid);

        // 飞入动画
        if (taskEl && $totalPoints) {
          const pointsEl = taskEl.querySelector('.task-card__points');
          Animations.flyingPoints(pointsEl || taskEl, $totalPoints, result.earnedPoints);
        }

        // 粒子爆炸
        if (taskEl) setTimeout(() => Animations.particleBurst(taskEl, '#00ff88', 10), 200);

        UI.toast(`获得 ${result.earnedPoints} 积分！${result.multiplier > 1 ? ' (倍率 ' + result.multiplier.toFixed(1) + 'x)' : ''}`, 'success');
      } catch (err) {
        UI.toast('领取失败: ' + err.message, 'error');
      }
    }
  });

  // ========== 奖励渲染 ==========

  function renderRewards() {
    if (rewards.length === 0) {
      $rewardGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🎁</div>
          <p class="empty-state__text">暂无奖励，等待指挥官设置...</p>
        </div>`;
      return;
    }

    // 过滤：过期/停用项保留1天
    const oneDayAgo = Date.now() - 86400000;
    const visibleRewards = rewards.filter(r => {
      if (!r.isActive) {
        if (r.disabledAt) return r.disabledAt.toDate().getTime() > oneDayAgo;
        return false;
      }
      if (r.type === C.REWARD_TYPE_LIMITED && r.exchangedCount >= r.maxExchanges) {
        if (r.exhaustedAt) return r.exhaustedAt.toDate().getTime() > oneDayAgo;
        return false;
      }
      return true;
    });

    if (visibleRewards.length === 0) {
      $rewardGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🎁</div>
          <p class="empty-state__text">暂无奖励，等待指挥官设置...</p>
        </div>`;
      return;
    }

    const total = pointsConfig
      ? (pointsConfig.currentBasePoints || 0) + (pointsConfig.achievementPoints || 0)
      : 0;

    $rewardGrid.innerHTML = visibleRewards.map(r => {
      const check = RewardManager.isExchangeable(r);
      const canExchange = check.available && total >= r.cost;
      const cardClass = check.available ? 'is-available' : 'is-unavailable';

      let metaStr = '';
      if (r.type === C.REWARD_TYPE_PERIODIC) {
        const periodName = r.period === 'daily' ? '今日' : '本月';
        metaStr = `${periodName}剩余: ${Math.max(0, r.maxExchanges - r.exchangedCount)}/${r.maxExchanges} 次`;
      } else {
        metaStr = `总计剩余: ${Math.max(0, r.maxExchanges - r.exchangedCount)}/${r.maxExchanges} 次`;
      }

      let btnHTML = '';
      if (check.available) {
        if (total >= r.cost) {
          btnHTML = `<button class="btn btn--success btn--block reward-card__btn glow-btn" data-action="exchange" data-id="${r.id}">兑换 -${r.cost} 积分</button>`;
        } else {
          btnHTML = `<button class="btn btn--ghost btn--block reward-card__btn" disabled>积分不足 (差 ${r.cost - total})</button>`;
        }
      } else {
        btnHTML = `<button class="btn btn--ghost btn--block reward-card__btn" disabled>${check.reason}</button>`;
      }

      return `
        <div class="reward-card ${cardClass}" data-reward-id="${r.id}">
          <div class="reward-card__header">
            <span class="reward-card__title">${SharedUI.esc(r.title)}</span>
            <span class="reward-card__cost">${r.cost} 积分</span>
          </div>
          ${r.description ? `<p class="reward-card__desc">${SharedUI.esc(r.description)}</p>` : ''}
          <p class="reward-card__meta">${metaStr}</p>
          ${btnHTML}
        </div>
      `;
    }).join('');
  }

  // 奖励按钮事件
  $rewardGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const rewardId = btn.dataset.id;

    if (action === 'exchange') {
      const reward = rewards.find(r => r.id === rewardId);
      if (!reward) return;

      const ok = await UI.confirm(
        '确认兑换',
        `确定要用 ${reward.cost} 积分兑换「${reward.title}」吗？`,
        '确认兑换'
      );
      if (!ok) return;

      try {
        await RewardManager.exchangeReward(rewardId, uid);

        // 粒子动画
        const rewardEl = document.querySelector(`[data-reward-id="${rewardId}"]`);
        if (rewardEl) Animations.particleBurst(rewardEl, '#ffb800', 14);

        UI.toast('兑换成功！', 'success');
        loadExchangeLogs(); // 刷新日志
      } catch (err) {
        UI.toast('兑换失败: ' + err.message, 'error');
      }
    }
  });

  // ========== 报告 ==========

  async function loadWeeklyReports() {
    try {
      const thisWeek = ReportManager.getWeekRange(new Date());
      const lastWeek = ReportManager.getLastWeekRange();
      const [thisData, lastData] = await Promise.all([
        ReportManager.computeReport(uid, thisWeek.start, thisWeek.end),
        ReportManager.computeReport(uid, lastWeek.start, lastWeek.end)
      ]);

      reportData.lastWeek = lastData;
      reportData.thisWeek = thisData;

      $weeklyCards.innerHTML =
        SharedUI.renderReportCard(lastData, 'lastWeek') +
        SharedUI.renderReportCard(thisData, 'thisWeek');
    } catch (err) { _handleReportError(err, $weeklyCards); }
  }

  async function loadMonthlyReport(monthOffset) {
    try {
      currentMonthOffset = monthOffset;
      const range = ReportManager.getMonthRangeByOffset(monthOffset);
      const data = await ReportManager.computeReport(uid, range.start, range.end);

      reportData.monthly = data;

      const startDate = new Date(range.start + 'T00:00:00');
      $monthLabel.textContent = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`;
      $monthlyCard.innerHTML = SharedUI.renderReportCard(data, 'monthly');

      // 当前月禁用"下一月"
      $btnMonthNext.disabled = (monthOffset === 0);
      $btnMonthNext.style.opacity = monthOffset === 0 ? '0.3' : '';
    } catch (err) { _handleReportError(err, $monthlyCard); }
  }

  function _handleReportError(err, $container) {
    console.error('报告加载失败:', err);
    const msg = err.message || '';
    if (msg.includes('index') || msg.includes('FAILED_PRECONDITION')) {
      const urlMatch = msg.match(/https?:\/\/[^\s]+/);
      const link = urlMatch ? urlMatch[0] : '';
      $container.innerHTML = `<p style="color:var(--color-danger);text-align:center;padding:var(--space-md);font-size:var(--text-sm)">
        数据库索引未创建。<br>请在 Firebase Console 中创建复合索引：<br>
        ${link ? `<a href="${link}" target="_blank" rel="noopener" style="color:var(--color-accent);word-break:break-all">点击创建索引</a>` : '请检查 taskLog 和 exchangeLog 集合的复合索引'}
      </p>`;
    } else {
      $container.innerHTML = `<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-md)">报告加载失败，请刷新重试</p>`;
    }
  }

  $btnMonthPrev.addEventListener('click', () => loadMonthlyReport(currentMonthOffset - 1));
  $btnMonthNext.addEventListener('click', () => {
    if (currentMonthOffset < 0) loadMonthlyReport(currentMonthOffset + 1);
  });

  // 报告数字点击 → 弹详情
  $weeklyCards.addEventListener('click', (e) => {
    const val = e.target.closest('.report-card__stat-value');
    if (!val) return;
    showReportDetail(val.dataset.reportKey, val.dataset.stat);
  });
  $monthlyCard.addEventListener('click', (e) => {
    const val = e.target.closest('.report-card__stat-value');
    if (!val) return;
    showReportDetail(val.dataset.reportKey, val.dataset.stat);
  });

  $btnReportDetailClose.addEventListener('click', () => {
    $reportDetailOverlay.style.display = 'none';
  });
  $reportDetailOverlay.addEventListener('click', (e) => {
    if (e.target === $reportDetailOverlay) {
      $reportDetailOverlay.style.display = 'none';
    }
  });

  function showReportDetail(reportKey, stat) {
    const r = reportData[reportKey];
    if (!r) return;

    const startDate = new Date(r.periodStart + 'T00:00:00');
    const endDate = new Date(r.periodEnd + 'T00:00:00');
    const rangeStr = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;

    const statLabels = {
      checkInDays: '打卡天数',
      maxStreakInPeriod: '最长连续',
      tasksCompleted: '完成任务',
      pointsEarned: '获得积分',
      rewardsExchanged: '兑换奖励',
      pointsSpent: '消耗积分'
    };

    $reportDetailTitle.textContent = `${statLabels[stat]} · ${rangeStr}`;
    $reportDetailBody.innerHTML = SharedUI.renderReportDetailBody(r, stat);
    $reportDetailOverlay.style.display = 'flex';
  }

  // ========== 兑换记录 ==========

  async function loadExchangeLogs() {
    try {
      const [exchangeLogs, deductionLogs] = await Promise.all([
        Store.getExchangeLogs(),
        Store.getDeductionLogs()
      ]);

      const hiddenBefore = _getLogHiddenBefore();

      const visibleExchanges = hiddenBefore
        ? exchangeLogs.filter(l => l.exchangedAt.toDate().getTime() > hiddenBefore)
        : exchangeLogs;

      const visibleDeductions = hiddenBefore
        ? deductionLogs.filter(l => l.deductedAt.toDate().getTime() > hiddenBefore)
        : deductionLogs;

      const allLogs = [
        ...visibleExchanges.map(l => ({ ...l, _type: 'exchange', _time: l.exchangedAt.toDate().getTime() })),
        ...visibleDeductions.map(l => ({ ...l, _type: 'deduction', _time: l.deductedAt.toDate().getTime() }))
      ].sort((a, b) => b._time - a._time);

      if (allLogs.length === 0) {
        $exchangeLogList.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-lg)">暂无记录</p>';
        $btnClearLogs.style.display = 'none';
        return;
      }

      $btnClearLogs.style.display = '';
      $exchangeLogList.innerHTML = allLogs.map(l => {
        if (l._type === 'deduction') {
          return SharedUI.renderDeductionLogItem(l);
        }
        return SharedUI.renderExchangeLogItem(l);
      }).join('');
    } catch (err) {
      // 静默失败
    }
  }

});
