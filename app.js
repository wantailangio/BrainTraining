(() => {
  "use strict";

  const SESSION_SECONDS = 180;
  const ROUND_SECONDS = 60;
  const colors = [
    { name: "あか", value: "#ff715b" },
    { name: "あお", value: "#46d7e9" },
    { name: "みどり", value: "#c7f45b" },
    { name: "むらさき", value: "#bd8cff" },
  ];
  const symbols = ["●", "▲", "■", "◆", "✦"];

  const els = {
    timer: document.querySelector("#timer"),
    score: document.querySelector("#score"),
    progress: document.querySelector("#progressFill"),
    idle: document.querySelector("#idleState"),
    play: document.querySelector("#playState"),
    result: document.querySelector("#resultState"),
    start: document.querySelector("#startButton"),
    retry: document.querySelector("#retryButton"),
    round: document.querySelector("#roundLabel"),
    instruction: document.querySelector("#instruction"),
    challenge: document.querySelector("#challenge"),
    answers: document.querySelector("#answerGrid"),
    feedback: document.querySelector("#feedback"),
    streak: document.querySelector("#streakCount"),
    finalScore: document.querySelector("#finalScore"),
    accuracy: document.querySelector("#accuracy"),
    resultStreak: document.querySelector("#resultStreak"),
    resultTitle: document.querySelector("#resultTitle"),
    resultMessage: document.querySelector("#resultMessage"),
    maps: [...document.querySelectorAll("[data-map-step]")],
  };

  let state = "idle";
  let score = 0;
  let attempts = 0;
  let startedAt = 0;
  let timerId = null;
  let currentRound = -1;
  let correctAnswer = "";
  let previousSymbol = "";
  let acceptingAnswer = false;

  const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
  const localDate = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem("threeMinFocusHistory")) || [];
    } catch {
      return [];
    }
  }

  function calculateStreak(history = loadHistory()) {
    const completed = new Set(history.map((item) => item.date));
    const cursor = new Date();
    if (!completed.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (completed.has(localDate(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function updateStreak() {
    els.streak.textContent = String(calculateStreak());
  }

  function setRound(round) {
    currentRound = round;
    els.maps.forEach((item, index) => item.classList.toggle("is-active", index === round));
    els.round.textContent = `ROUND ${round + 1} / 3`;
    previousSymbol = "";
    nextChallenge();
  }

  function createAnswerButton(label, value, key) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.dataset.value = value;
    button.innerHTML = `${label}<kbd>${key}</kbd>`;
    button.addEventListener("click", () => submitAnswer(value));
    return button;
  }

  function showStroop() {
    const word = randomItem(colors);
    let ink = randomItem(colors);
    while (ink.name === word.name) ink = randomItem(colors);
    correctAnswer = ink.name;
    els.instruction.textContent = "文字の意味ではなく「色」を選ぶ";
    els.challenge.innerHTML = `<span class="stroop-word" style="color:${ink.value}">${word.name}</span>`;
    els.answers.replaceChildren(...colors.map((color, index) => createAnswerButton(color.name, color.name, index + 1)));
    acceptingAnswer = true;
  }

  function showMemory() {
    const same = previousSymbol && Math.random() < 0.48;
    let symbol = same ? previousSymbol : randomItem(symbols);
    if (!same && previousSymbol) {
      while (symbol === previousSymbol) symbol = randomItem(symbols);
    }
    els.instruction.textContent = "ひとつ前と同じ記号？";
    els.challenge.innerHTML = `<span class="memory-symbol">${symbol}</span>`;
    els.answers.replaceChildren(
      createAnswerButton("同じ", "same", 1),
      createAnswerButton("ちがう", "different", 2),
    );
    if (!previousSymbol) {
      acceptingAnswer = false;
      els.answers.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      els.feedback.textContent = "この記号を覚えてください";
      previousSymbol = symbol;
      window.setTimeout(() => {
        if (state === "running" && currentRound === 1) nextChallenge();
      }, 1100);
      return;
    }
    correctAnswer = same ? "same" : "different";
    previousSymbol = symbol;
    acceptingAnswer = true;
  }

  function showSwitch() {
    const rule = Math.random() < 0.5 ? "偶数" : "奇数";
    const candidates = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9) + 1);
    const valid = candidates.filter((n) => (rule === "偶数" ? n % 2 === 0 : n % 2 === 1));
    if (!valid.length) candidates[Math.floor(Math.random() * 4)] = rule === "偶数" ? 4 : 5;
    correctAnswer = rule;
    els.instruction.textContent = "ルールに合う数字をひとつ選ぶ";
    els.challenge.innerHTML = `<div class="switch-prompt"><small>今回のルール</small><strong>${rule}を選ぶ</strong></div>`;
    els.answers.replaceChildren(...candidates.map((number, index) => {
      const kind = number % 2 === 0 ? "偶数" : "奇数";
      return createAnswerButton(String(number), kind, index + 1);
    }));
    acceptingAnswer = true;
  }

  function nextChallenge() {
    if (state !== "running") return;
    els.feedback.innerHTML = "&nbsp;";
    els.feedback.classList.remove("is-wrong");
    if (currentRound === 0) showStroop();
    if (currentRound === 1) showMemory();
    if (currentRound === 2) showSwitch();
  }

  function submitAnswer(value) {
    if (!acceptingAnswer || state !== "running") return;
    acceptingAnswer = false;
    attempts += 1;
    const isCorrect = value === correctAnswer;
    if (isCorrect) {
      score += 1;
      els.score.textContent = String(score);
      els.feedback.textContent = "GOOD";
    } else {
      els.feedback.textContent = "焦らず、次へ";
      els.feedback.classList.add("is-wrong");
    }
    window.setTimeout(nextChallenge, 260);
  }

  function tick() {
    const elapsed = Math.min(SESSION_SECONDS, (Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, Math.ceil(SESSION_SECONDS - elapsed));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    els.timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    els.progress.style.width = `${(elapsed / SESSION_SECONDS) * 100}%`;

    const round = Math.min(2, Math.floor(elapsed / ROUND_SECONDS));
    if (round !== currentRound) setRound(round);
    if (elapsed >= SESSION_SECONDS) finishTraining();
  }

  function startTraining() {
    window.clearInterval(timerId);
    state = "running";
    score = 0;
    attempts = 0;
    currentRound = -1;
    previousSymbol = "";
    startedAt = Date.now();
    els.score.textContent = "0";
    els.timer.textContent = "03:00";
    els.progress.style.width = "0%";
    els.idle.hidden = true;
    els.result.hidden = true;
    els.play.hidden = false;
    tick();
    timerId = window.setInterval(tick, 250);
  }

  function saveResult(accuracy) {
    const history = loadHistory();
    const today = localDate();
    const existing = history.find((item) => item.date === today);
    if (existing) {
      if (score > existing.score) Object.assign(existing, { score, accuracy });
    } else {
      history.push({ date: today, score, accuracy });
    }
    localStorage.setItem("threeMinFocusHistory", JSON.stringify(history.slice(-90)));
  }

  function finishTraining() {
    if (state !== "running") return;
    state = "complete";
    window.clearInterval(timerId);
    acceptingAnswer = false;
    const accuracy = attempts ? Math.round((score / attempts) * 100) : 0;
    saveResult(accuracy);
    updateStreak();
    els.timer.textContent = "00:00";
    els.progress.style.width = "100%";
    els.play.hidden = true;
    els.result.hidden = false;
    els.finalScore.textContent = String(score);
    els.accuracy.textContent = `${accuracy}%`;
    els.resultStreak.textContent = `${calculateStreak()}日`;
    els.resultTitle.textContent = accuracy >= 85 ? "冴えています。" : accuracy >= 65 ? "今日の調整、完了。" : "集中の土台ができました。";
    els.resultMessage.textContent = accuracy >= 85 ? "速さと正確さのバランスが取れています。" : "続けるほど、切り替えが自然になっていきます。";
  }

  els.start.addEventListener("click", startTraining);
  els.retry.addEventListener("click", startTraining);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && state === "idle") startTraining();
    if (state !== "running" || !/^[1-4]$/.test(event.key)) return;
    const buttons = [...els.answers.querySelectorAll("button:not(:disabled)")];
    buttons[Number(event.key) - 1]?.click();
  });

  function registerWebMcp() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const signal = new AbortController().signal;
    const report = () => ({ state, remainingSeconds: state === "running" ? Math.max(0, Math.ceil(SESSION_SECONDS - (Date.now() - startedAt) / 1000)) : state === "complete" ? 0 : SESSION_SECONDS, score, attempts, streak: calculateStreak() });
    try {
      void Promise.resolve(context.registerTool({
        name: "start_daily_training",
        title: "今日の3分トレーニングを開始",
        description: "集中・記憶・判断の3分間セッションを画面上で開始します。",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() { startTraining(); return report(); },
      }, { signal })).catch(() => {});
      void Promise.resolve(context.registerTool({
        name: "get_training_status",
        title: "トレーニング状況を確認",
        description: "現在のセッション状態、残り時間、正解数、継続日数を返します。",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: report,
      }, { signal })).catch(() => {});
    } catch { /* 未対応ブラウザでは画面操作のみを提供 */ }
  }

  updateStreak();
  registerWebMcp();
})();
