(function () {
  const STORAGE_KEY = "math24_state_v1";
  const STAGES = window.Math24Levels.getStages();
  const appEl = document.getElementById("app");
  const modalEl = document.getElementById("modal");
  const modalCardEl = document.getElementById("modal-card");

  const state = {
    view: "home",
    selectedStage: 0,
    progress: loadProgress(),
    game: null,
    speed: null,
    timerId: null,
    nextCardId: 1,
  };

  function makeDefaultProgress() {
    return {
      stages: Array.from({ length: STAGES.length }, () => ({
        hintsLeft: 3,
        completed: Array(20).fill(false),
      })),
      stats: {
        totalSolved: 0,
        bestSpeedMs: null,
        streak: 0,
      },
    };
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return makeDefaultProgress();
      const parsed = JSON.parse(raw);
      const base = makeDefaultProgress();
      if (!parsed || !parsed.stages || !parsed.stats) return base;
      for (let i = 0; i < base.stages.length; i += 1) {
        if (!parsed.stages[i]) continue;
        base.stages[i].hintsLeft = Number.isFinite(parsed.stages[i].hintsLeft)
          ? Math.max(0, Math.min(3, parsed.stages[i].hintsLeft))
          : 3;
        if (Array.isArray(parsed.stages[i].completed)) {
          for (let j = 0; j < 20; j += 1) {
            base.stages[i].completed[j] = !!parsed.stages[i].completed[j];
          }
        }
      }
      base.stats.totalSolved = parsed.stats.totalSolved || 0;
      base.stats.bestSpeedMs = parsed.stats.bestSpeedMs ?? null;
      base.stats.streak = parsed.stats.streak || 0;
      return base;
    } catch (err) {
      return makeDefaultProgress();
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function isStageCompleted(stageIdx) {
    return state.progress.stages[stageIdx].completed.every(Boolean);
  }

  function isStageUnlocked(stageIdx) {
    if (stageIdx === 0) return true;
    return isStageCompleted(stageIdx - 1);
  }

  function isLevelUnlocked(stageIdx, levelIdx) {
    if (!isStageUnlocked(stageIdx)) return false;
    if (levelIdx === 0) return true;
    return state.progress.stages[stageIdx].completed[levelIdx - 1];
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatMs(ms) {
    const totalCentis = Math.floor(ms / 10);
    const centis = totalCentis % 100;
    const totalSec = Math.floor(totalCentis / 100);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60);
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
  }

  function newCardsFromNumbers(nums) {
    return nums.map((n) => ({
      id: state.nextCardId++,
      frac: new window.Math24Solver.Fraction(n, 1),
    }));
  }

  function cloneCards(cards) {
    return cards.map((c) => ({
      id: c.id,
      frac: new window.Math24Solver.Fraction(c.frac.num, c.frac.den),
    }));
  }

  function startStageLevel(stageIdx, levelIdx) {
    const nums = STAGES[stageIdx].levels[levelIdx].nums;
    const solution = window.Math24Solver.findStrictIntegerSolution(nums);
    state.game = {
      mode: "stage",
      stageIdx,
      levelIdx,
      original: nums.slice(),
      cards: newCardsFromNumbers(nums),
      selectedCardIds: [],
      operator: null,
      history: [],
      undoStack: [],
      solution,
    };
    state.view = "stageGame";
    render();
  }

  function startSpeedMode() {
    clearTimer();
    state.speed = {
      index: 0,
      total: 10,
      skipsLeft: 3,
      correct: 0,
      wrong: 0,
      startMs: Date.now(),
      finishedMs: null,
    };
    loadNextSpeedPuzzle();
    state.view = "speedGame";
    state.timerId = setInterval(() => {
      if (state.view === "speedGame") render();
    }, 250);
    render();
  }

  function clearTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function loadNextSpeedPuzzle() {
    const nums = window.Math24Levels.getRandomSpeedSet();
    const solution = window.Math24Solver.findStrictIntegerSolution(nums);
    state.game = {
      mode: "speed",
      original: nums.slice(),
      cards: newCardsFromNumbers(nums),
      selectedCardIds: [],
      operator: null,
      history: [],
      undoStack: [],
      solution,
    };
  }

  function shuffleCards() {
    const arr = state.game.cards;
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    render();
  }

  function toggleCardSelection(cardId) {
    const selected = state.game.selectedCardIds;
    if (selected.length === 0) {
      selected.push(cardId);
      render();
      return;
    }

    const firstId = selected[0];
    if (firstId === cardId) {
      selected.length = 0;
      render();
      return;
    }

    if (!state.game.operator) {
      selected[0] = cardId;
      render();
      return;
    }

    combineSelected(firstId, cardId);
  }

  function setOperator(op) {
    state.game.operator = op;
    if (state.game.selectedCardIds.length === 1) {
      render();
      return;
    }
    render();
  }

  function pushUndoSnapshot() {
    state.game.undoStack.push({
      cards: cloneCards(state.game.cards),
      history: state.game.history.slice(),
      selectedCardIds: state.game.selectedCardIds.slice(),
      operator: state.game.operator,
    });
  }

  function undoStep() {
    const prev = state.game.undoStack.pop();
    if (!prev) return;
    state.game.cards = prev.cards;
    state.game.history = prev.history;
    state.game.selectedCardIds = prev.selectedCardIds;
    state.game.operator = prev.operator;
    render();
  }

  function combineSelected(firstId, secondId) {
    if (!state.game.operator) return;
    if (firstId === secondId) return;

    const indexA = state.game.cards.findIndex((c) => c.id === firstId);
    const indexB = state.game.cards.findIndex((c) => c.id === secondId);
    if (indexA < 0 || indexB < 0) return;

    const a = state.game.cards[indexA];
    const b = state.game.cards[indexB];
    if (!a || !b) return;

    let out;
    try {
      out = window.Math24Solver.evalBinary(a.frac, b.frac, state.game.operator);
    } catch (err) {
      showModal({
        title: "Ugyldig trekk",
        body: "Du kan ikkje dele på null.",
        actions: [{ label: "OK", action: "close-modal", type: "primary" }],
      });
      return;
    }
    if (out.den !== 1) {
      showModal({
        title: "Ugyldig trekk",
        body: "Berre heiltal er tillate. Vel ein annan kombinasjon.",
        actions: [{ label: "OK", action: "close-modal", type: "primary" }],
      });
      return;
    }
    pushUndoSnapshot();
    const newCard = {
      id: state.nextCardId++,
      frac: out,
    };
    const cards = state.game.cards.slice();
    if (indexA < indexB) {
      cards.splice(indexA, 1);
      cards[indexB - 1] = newCard;
    } else {
      cards.splice(indexA, 1);
      cards[indexB] = newCard;
    }
    state.game.cards = cards;
    state.game.history.push(`(${a.frac.toString()} ${state.game.operator} ${b.frac.toString()}) = ${out.toString()}`);
    state.game.selectedCardIds = [];

    checkEndOfPuzzle();
    render();
  }

  function markSolvedStats() {
    state.progress.stats.totalSolved += 1;
    state.progress.stats.streak += 1;
    saveProgress();
  }

  function markFailedStats() {
    state.progress.stats.streak = 0;
    saveProgress();
  }

  function checkEndOfPuzzle() {
    if (state.game.cards.length !== 1) return;
    const done = state.game.cards[0].frac.equalsInt(24);

    if (done && state.game.mode === "stage") {
      const { stageIdx, levelIdx } = state.game;
      state.progress.stages[stageIdx].completed[levelIdx] = true;
      markSolvedStats();
      saveProgress();
      showModal({
        title: "Success",
        body: "Perfekt! Du laga 24.",
        actions: [
          { label: "Neste nivå", action: "next-stage-level", type: "primary" },
          { label: "Til Stage", action: "to-stage-select", type: "secondary" },
        ],
      });
      return;
    }

    if (done && state.game.mode === "speed") {
      markSolvedStats();
      state.speed.correct += 1;
      advanceSpeed();
      return;
    }

    if (!done && state.game.mode === "stage") {
      markFailedStats();
      showModal({
        title: "Ikkje 24",
        body: "Siste kort vart ikkje 24. Prøv undo eller restart.",
        actions: [
          { label: "Undo", action: "undo", type: "secondary" },
          { label: "Restart", action: "restart-puzzle", type: "primary" },
        ],
      });
      return;
    }

    if (!done && state.game.mode === "speed") {
      markFailedStats();
      showModal({
        title: "Ikkje 24",
        body: "Vil du telje denne som feil og gå vidare?",
        actions: [
          { label: "Prøv vidare", action: "close-modal", type: "secondary" },
          { label: "Neste (feil)", action: "speed-next-wrong", type: "primary" },
        ],
      });
    }
  }

  function advanceSpeed() {
    if (state.speed.index >= state.speed.total - 1) {
      finishSpeed();
      return;
    }
    state.speed.index += 1;
    loadNextSpeedPuzzle();
    render();
  }

  function finishSpeed() {
    clearTimer();
    state.speed.finishedMs = Date.now() - state.speed.startMs;
    const best = state.progress.stats.bestSpeedMs;
    if (best === null || state.speed.finishedMs < best) {
      state.progress.stats.bestSpeedMs = state.speed.finishedMs;
    }
    saveProgress();
    state.view = "speedResult";
    render();
  }

  function useHint() {
    if (!state.game || state.game.mode !== "stage") return;
    const stageState = state.progress.stages[state.game.stageIdx];
    if (stageState.hintsLeft <= 0) return;
    showModal({
      title: `Hint (${stageState.hintsLeft} igjen)`,
      body: "Vel om du vil sjå neste steg eller full løysing.",
      actions: [
        { label: "Show step", action: "hint-step", type: "secondary" },
        { label: "Show solution", action: "hint-solution", type: "primary" },
      ],
    });
  }

  function consumeHintAndShow(kind) {
    const stageState = state.progress.stages[state.game.stageIdx];
    if (stageState.hintsLeft <= 0) return;
    stageState.hintsLeft -= 1;
    saveProgress();

    const solution = state.game.solution;
    if (!solution) {
      showModal({
        title: "Hint",
        body: "Ingen løysing funnen for dette nivået.",
        actions: [{ label: "OK", action: "close-modal", type: "primary" }],
      });
      return;
    }

    if (kind === "step") {
      const idx = Math.min(state.game.history.length, solution.steps.length - 1);
      const step = solution.steps[Math.max(0, idx)];
      showModal({
        title: "Neste steg",
        body: `<p class="mono">${escapeHtml(step || solution.expr)}</p>`,
        htmlBody: true,
        actions: [{ label: "OK", action: "close-modal", type: "primary" }],
      });
      return;
    }

    showModal({
      title: "Full løysing",
      body: `<p class="mono">${escapeHtml(solution.expr)} = 24</p><p>${solution.steps
        .map((s) => `• ${escapeHtml(s)}`)
        .join("<br />")}</p>`,
      htmlBody: true,
      actions: [{ label: "OK", action: "close-modal", type: "primary" }],
    });
  }

  function showModal({ title, body, actions, htmlBody }) {
    modalCardEl.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      <div>${htmlBody ? body : escapeHtml(body)}</div>
      <div class="row" style="margin-top: 14px;">
        ${actions
          .map(
            (a) =>
              `<button class="${a.type === "primary" ? "primary-btn" : "secondary-btn"}" data-action="${a.action}">${escapeHtml(
                a.label
              )}</button>`
          )
          .join("")}
      </div>
    `;
    modalEl.classList.remove("hidden");
    modalEl.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
    modalCardEl.innerHTML = "";
  }

  function navigate(view) {
    if (view !== "speedGame") clearTimer();
    if (view === "home") {
      state.game = null;
      state.speed = null;
    }
    state.view = view;
    render();
  }

  function renderHome() {
    appEl.innerHTML = `
      <div class="screen">
        <div class="top-row">
          <button class="icon-btn" data-action="open-settings">⚙️</button>
          <div></div>
        </div>

        <div class="white-card brand-box">
          <div style="font-size: 3rem;">🧠</div>
          <h1 class="brand-title">Math24</h1>
          <p class="brand-sub">Klassisk 24-spel i mintdrakt</p>
        </div>

        <button class="big-btn btn-stage" data-action="to-stage-select">Stage Mode</button>
        <button class="big-btn btn-speed" data-action="start-speed">Speed Mode</button>

        <div class="white-card section-card" style="margin-top: auto;">
          <h3 class="section-title">Be Better</h3>
          <div class="icon-strip">
            <button class="stub-btn" data-action="open-stats">📊 Stats</button>
            <button class="stub-btn" data-action="open-like">❤️ Like</button>
            <button class="stub-btn" data-action="open-badge">🏅 Badge</button>
            <button class="stub-btn" data-action="open-share">🔗 Share</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStageSelect() {
    const stage = STAGES[state.selectedStage];
    const lockedStage = !isStageUnlocked(state.selectedStage);

    const levelHtml = stage.levels
      .map((level, idx) => {
        const completed = state.progress.stages[state.selectedStage].completed[idx];
        const unlocked = isLevelUnlocked(state.selectedStage, idx);
        const cls = ["level-btn"];
        if (!unlocked) cls.push("locked");
        if (completed) cls.push("completed");
        return `<button class="${cls.join(" ")}" data-action="open-level" data-level="${idx}" ${
          unlocked ? "" : "disabled"
        }>${unlocked ? idx + 1 : "🔒"}</button>`;
      })
      .join("");

    appEl.innerHTML = `
      <div class="screen">
        <div class="top-row">
          <button class="icon-btn" data-action="home">←</button>
          <div class="counter-badge">Hints: ${state.progress.stages[state.selectedStage].hintsLeft}</div>
        </div>

        <div class="white-card stage-head">
          <h2>Stage Mode</h2>
          <p class="stage-sub">Collect all 15 Cute Medals</p>
          <div class="medal-row">
            <div class="medal">🐣</div>
            <div class="medal">🐼</div>
            <div class="medal">👑</div>
          </div>
        </div>

        <div class="white-card stage-card">
          <div class="stage-nav">
            <button class="icon-btn" data-action="prev-stage">◀</button>
            <div class="stage-name">${stage.name}</div>
            <button class="icon-btn" data-action="next-stage">▶</button>
          </div>
          ${lockedStage ? '<p class="muted">Lås opp ved å fullføre førre stage.</p>' : ""}
          <div class="level-grid">${levelHtml}</div>
          <button class="exam-btn" data-action="open-exam" disabled>Exam (soon)</button>
        </div>
      </div>
    `;
  }

  function renderGameTopBar() {
    if (state.game.mode === "stage") {
      const stageState = state.progress.stages[state.game.stageIdx];
      return `
        <div class="white-card hud-card top-row">
          <div class="hud-left">
            <button class="icon-btn" data-action="to-stage-select">←</button>
            <div>
              <div><strong>${STAGES[state.game.stageIdx].name}</strong></div>
              <div class="muted">Level ${state.game.levelIdx + 1}/20</div>
            </div>
          </div>
          <div class="row" style="max-width: 180px;">
            <button class="icon-btn" data-action="shuffle">🔀</button>
            <button class="icon-btn" data-action="use-hint">💡${stageState.hintsLeft}</button>
          </div>
        </div>
      `;
    }

    const elapsed = Date.now() - state.speed.startMs;
    return `
      <div class="white-card hud-card top-row">
        <div class="hud-left">
          <button class="icon-btn" data-action="home">←</button>
          <div>
            <div><strong>Speed ${state.speed.index + 1}/10</strong></div>
            <div class="muted">⏱ ${formatMs(elapsed)}</div>
          </div>
        </div>
        <div class="row" style="max-width: 180px;">
          <button class="icon-btn" data-action="shuffle">🔀</button>
          <button class="icon-btn" data-action="speed-skip">🗑️${state.speed.skipsLeft}</button>
        </div>
      </div>
    `;
  }

  function renderGame() {
    const boardHtml = state.game.cards
      .map((c) => {
        const selected = state.game.selectedCardIds.includes(c.id) ? "selected" : "";
        return `<button class="num-card ${selected}" data-card-id="${c.id}">${c.frac.toString()}</button>`;
      })
      .join("");

    const ops = ["+", "-", "×", "÷"];
    const opHtml = ops
      .map((op) => `<button class="op-btn ${state.game.operator === op ? "active" : ""}" data-op="${op}">${op}</button>`)
      .join("");

    const historyHtml = state.game.history.length
      ? state.game.history.map((line) => `<p class="step-line mono">${escapeHtml(line)}</p>`).join("")
      : '<p class="muted">Ingen steg enno.</p>';

    appEl.innerHTML = `
      <div class="screen">
        ${renderGameTopBar()}

        <div class="white-card board">${boardHtml}</div>

        <div class="operator-row">${opHtml}</div>

        <div class="tools-row">
          <button class="small-btn" data-action="undo" ${state.game.undoStack.length ? "" : "disabled"}>↩ Undo</button>
          <button class="small-btn" data-action="restart-puzzle">⟲ Restart</button>
          <button class="small-btn" data-action="clear-selection">✕ Clear</button>
        </div>

        <div class="white-card history-card">
          <h3 class="history-title">Steg</h3>
          ${historyHtml}
        </div>
      </div>
    `;
  }

  function renderSpeedResult() {
    appEl.innerHTML = `
      <div class="screen">
        <div class="white-card result-card" style="margin-top: 40px;">
          <h2>Speed Result</h2>
          <p class="result-time">${formatMs(state.speed.finishedMs)}</p>
          <p>Rett: <strong>${state.speed.correct}</strong> | Feil: <strong>${state.speed.wrong}</strong></p>
          <p class="muted">Best: ${
            state.progress.stats.bestSpeedMs === null ? "-" : formatMs(state.progress.stats.bestSpeedMs)
          }</p>
          <div class="row" style="margin-top: 14px;">
            <button class="primary-btn" data-action="start-speed">Play again</button>
            <button class="secondary-btn" data-action="home">Home</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStatsPage(kind) {
    const body = {
      stats: `
        <p>Total løyste: <strong>${state.progress.stats.totalSolved}</strong></p>
        <p>Best Speed: <strong>${
          state.progress.stats.bestSpeedMs === null ? "-" : formatMs(state.progress.stats.bestSpeedMs)
        }</strong></p>
        <p>Streak: <strong>${state.progress.stats.streak}</strong></p>
      `,
      like: "<p>Like-sida er ein enkel stubb i v1.</p>",
      badge: "<p>Badge-sida kjem i neste versjon.</p>",
      share: "<p>Share-sida kjem i neste versjon.</p>",
    };

    const title = {
      stats: "Stats",
      like: "Like",
      badge: "Badge",
      share: "Share",
    };

    appEl.innerHTML = `
      <div class="screen">
        <div class="top-row">
          <button class="icon-btn" data-action="home">←</button>
          <div></div>
        </div>
        <div class="white-card section-card">
          <h2>${title[kind]}</h2>
          ${body[kind]}
        </div>
      </div>
    `;
  }

  function render() {
    if (state.view === "home") return renderHome();
    if (state.view === "stageSelect") return renderStageSelect();
    if (state.view === "stageGame" || state.view === "speedGame") return renderGame();
    if (state.view === "speedResult") return renderSpeedResult();
    if (state.view === "stats") return renderStatsPage("stats");
    if (state.view === "like") return renderStatsPage("like");
    if (state.view === "badge") return renderStatsPage("badge");
    if (state.view === "share") return renderStatsPage("share");
  }

  function restartCurrentPuzzle() {
    const nums = state.game.original.slice();
    const solution = window.Math24Solver.findStrictIntegerSolution(nums);
    const kept = {
      mode: state.game.mode,
      stageIdx: state.game.stageIdx,
      levelIdx: state.game.levelIdx,
      original: nums,
      solution,
    };
    state.game = {
      ...kept,
      cards: newCardsFromNumbers(nums),
      selectedCardIds: [],
      operator: null,
      history: [],
      undoStack: [],
    };
    render();
  }

  function nextStageLevel() {
    const s = state.game.stageIdx;
    const l = state.game.levelIdx;
    closeModal();
    if (l < 19 && isLevelUnlocked(s, l + 1)) {
      startStageLevel(s, l + 1);
      return;
    }
    navigate("stageSelect");
  }

  function handleAction(action, target) {
    if (action === "home") return closeModal(), navigate("home");
    if (action === "to-stage-select") return closeModal(), navigate("stageSelect");
    if (action === "start-speed") return closeModal(), startSpeedMode();
    if (action === "open-settings") return showModal({
      title: "Settings",
      body: "Innstillingar kjem snart.",
      actions: [{ label: "OK", action: "close-modal", type: "primary" }],
    });
    if (action === "open-stats") return navigate("stats");
    if (action === "open-like") return navigate("like");
    if (action === "open-badge") return navigate("badge");
    if (action === "open-share") return navigate("share");
    if (action === "prev-stage") {
      state.selectedStage = (state.selectedStage + STAGES.length - 1) % STAGES.length;
      return render();
    }
    if (action === "next-stage") {
      state.selectedStage = (state.selectedStage + 1) % STAGES.length;
      return render();
    }
    if (action === "open-level") {
      const levelIdx = Number(target.dataset.level);
      if (!isLevelUnlocked(state.selectedStage, levelIdx)) return;
      return startStageLevel(state.selectedStage, levelIdx);
    }
    if (action === "open-exam") {
      return showModal({
        title: "Exam",
        body: "Exam kjem i neste versjon.",
        actions: [{ label: "OK", action: "close-modal", type: "primary" }],
      });
    }
    if (action === "shuffle") return shuffleCards();
    if (action === "undo") return closeModal(), undoStep();
    if (action === "restart-puzzle") return closeModal(), restartCurrentPuzzle();
    if (action === "clear-selection") {
      state.game.selectedCardIds = [];
      state.game.operator = null;
      return render();
    }
    if (action === "use-hint") return useHint();
    if (action === "hint-step") return closeModal(), consumeHintAndShow("step");
    if (action === "hint-solution") return closeModal(), consumeHintAndShow("solution");
    if (action === "close-modal") return closeModal();
    if (action === "next-stage-level") return nextStageLevel();
    if (action === "speed-skip") {
      if (state.speed.skipsLeft <= 0) return;
      state.speed.skipsLeft -= 1;
      state.speed.wrong += 1;
      markFailedStats();
      return advanceSpeed();
    }
    if (action === "speed-next-wrong") {
      closeModal();
      state.speed.wrong += 1;
      return advanceSpeed();
    }
  }

  appEl.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) {
      handleAction(actionTarget.dataset.action, actionTarget);
      return;
    }

    const opTarget = event.target.closest("[data-op]");
    if (opTarget && state.game) {
      setOperator(opTarget.dataset.op);
      return;
    }

    const cardTarget = event.target.closest("[data-card-id]");
    if (cardTarget && state.game) {
      toggleCardSelection(Number(cardTarget.dataset.cardId));
    }
  });

  modalEl.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) {
      handleAction(actionTarget.dataset.action, actionTarget);
      return;
    }

    if (event.target === modalEl) {
      closeModal();
    }
  });

  window.addEventListener("beforeunload", clearTimer);

  render();
})();
