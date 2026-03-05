(function () {
  const STAGE_NAMES = [
    "Baby",
    "Kid",
    "Pupil",
    "Learner",
    "Junior",
    "Smart",
    "Thinker",
    "Nerd",
    "Wizard",
    "Master",
    "Elite",
    "Genius",
    "Sage",
    "Legend",
    "King of Math",
  ];

  // First Baby boards are intentionally "super easy" (sum to 24 with + only).
  const BABY_SUPER_EASY = [
    [6, 6, 6, 6],
    [8, 8, 4, 4],
    [10, 10, 2, 2],
    [12, 8, 2, 2],
    [9, 9, 3, 3],
    [7, 7, 5, 5],
    [10, 8, 4, 2],
    [9, 8, 4, 3],
  ];

  const handcrafted = {
    easy: [
      [1, 1, 6, 6], [1, 2, 3, 4], [1, 2, 4, 6], [1, 3, 4, 6], [1, 3, 8, 8], [1, 4, 4, 6],
      [1, 5, 5, 5], [1, 5, 6, 8], [1, 6, 6, 8], [1, 7, 8, 8], [2, 2, 6, 6], [2, 3, 4, 4],
      [2, 3, 5, 9], [2, 3, 6, 6], [2, 4, 4, 8], [2, 4, 6, 6], [2, 5, 5, 8], [2, 6, 6, 6],
      [2, 7, 7, 8], [3, 3, 4, 8], [3, 3, 5, 8], [3, 3, 6, 6], [3, 4, 4, 6], [3, 4, 5, 6],
      [3, 5, 5, 6], [4, 4, 4, 6], [4, 4, 5, 5], [4, 5, 6, 9], [5, 5, 5, 9], [6, 6, 6, 6],
    ],
    medium: [
      [1, 3, 9, 9], [1, 4, 7, 8], [1, 5, 7, 8], [1, 6, 7, 8], [1, 7, 7, 9], [2, 2, 9, 12],
      [2, 3, 8, 12], [2, 4, 9, 12], [2, 5, 7, 10], [2, 5, 9, 13], [2, 6, 7, 9], [2, 8, 8, 9],
      [3, 3, 7, 12], [3, 4, 9, 10], [3, 5, 7, 11], [3, 6, 8, 11], [3, 7, 8, 10], [4, 4, 7, 11],
      [4, 5, 8, 11], [4, 6, 9, 11], [5, 5, 7, 12], [5, 6, 8, 13], [6, 7, 8, 13], [7, 7, 8, 12],
      [8, 8, 9, 10],
    ],
    hard: [
      [1, 8, 8, 11], [1, 9, 10, 12], [1, 10, 11, 13], [2, 7, 11, 13], [2, 8, 11, 12],
      [2, 9, 10, 13], [3, 7, 11, 12], [3, 8, 10, 13], [3, 9, 11, 12], [4, 7, 10, 13],
      [4, 8, 11, 13], [4, 9, 10, 12], [5, 7, 11, 12], [5, 8, 10, 13], [5, 9, 11, 13],
      [6, 7, 10, 13], [6, 8, 11, 12], [6, 9, 10, 11], [7, 8, 12, 13], [8, 9, 11, 13],
    ],
  };

  function key(nums) {
    return nums.slice().sort((a, b) => a - b).join("-");
  }

  function rng(seed) {
    let x = seed % 2147483647;
    if (x <= 0) x += 2147483646;
    return function () {
      x = (x * 16807) % 2147483647;
      return (x - 1) / 2147483646;
    };
  }

  function randomInt(rand, min, max) {
    return Math.floor(rand() * (max - min + 1)) + min;
  }

  function difficultyForStage(stageIndex) {
    if (stageIndex <= 4) return "easy";
    if (stageIndex <= 9) return "medium";
    return "hard";
  }

  function validForDifficulty(nums, difficulty, solverResult) {
    const expr = solverResult.expr;
    const stepText = solverResult.steps.join(" ");
    if (difficulty === "easy") {
      return !stepText.includes("/") && !stepText.includes("÷") && Math.max(...nums) <= 10;
    }
    if (difficulty === "medium") {
      return Math.max(...nums) <= 13;
    }
    return (expr.includes("÷") || stepText.includes("/")) && Math.max(...nums) <= 13;
  }

  function generateCandidate(rand, difficulty) {
    const max = difficulty === "easy" ? 10 : 13;
    return [
      randomInt(rand, 1, max),
      randomInt(rand, 1, max),
      randomInt(rand, 1, max),
      randomInt(rand, 1, max),
    ];
  }

  function difficultyScore(nums, solve) {
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    const unique = new Set(nums).size;
    const expr = solve.expr;

    const minusCount = (expr.match(/ - /g) || []).length;
    const multCount = (expr.match(/ × /g) || []).length;
    const divCount = (expr.match(/ ÷ /g) || []).length;

    return (
      max * 1.2 +
      unique * 0.7 +
      (max - min) * 0.35 +
      minusCount * 1.1 +
      multCount * 0.5 +
      divCount * 1.9
    );
  }

  function collectPool(rand, difficulty, usedGlobal, minPoolSize) {
    const pool = [];
    const poolKeys = new Set();

    for (let i = 0; i < handcrafted[difficulty].length; i += 1) {
      const nums = handcrafted[difficulty][i];
      const k = key(nums);
      if (usedGlobal.has(k) || poolKeys.has(k)) continue;
      const solve = window.Math24Solver.findStrictIntegerSolution(nums);
      if (!solve || !validForDifficulty(nums, difficulty, solve)) continue;
      pool.push({ nums: nums.slice(), score: difficultyScore(nums, solve) });
      poolKeys.add(k);
    }

    let safety = 0;
    while (pool.length < minPoolSize && safety < 30000) {
      safety += 1;
      const nums = generateCandidate(rand, difficulty);
      const k = key(nums);
      if (usedGlobal.has(k) || poolKeys.has(k)) continue;
      const solve = window.Math24Solver.findStrictIntegerSolution(nums);
      if (!solve || !validForDifficulty(nums, difficulty, solve)) continue;
      pool.push({ nums, score: difficultyScore(nums, solve) });
      poolKeys.add(k);
    }

    pool.sort((a, b) => a.score - b.score);
    return pool;
  }

  function pickProgressiveTwenty(pool, stageIndex) {
    if (pool.length <= 20) return pool.slice(0, 20).map((x) => x.nums.slice());

    const groupPos = stageIndex % 5;
    const startFracs = [0.0, 0.12, 0.24, 0.36, 0.5];
    const endFracs = [0.6, 0.72, 0.84, 0.94, 1.0];

    const start = Math.floor(pool.length * startFracs[groupPos]);
    const end = Math.max(start + 20, Math.floor(pool.length * endFracs[groupPos]));
    const slice = pool.slice(start, Math.min(end, pool.length));

    if (slice.length <= 20) return slice.map((x) => x.nums.slice());

    const picked = [];
    for (let i = 0; i < 20; i += 1) {
      const idx = Math.floor((i / 19) * (slice.length - 1));
      picked.push(slice[idx].nums.slice());
    }
    return picked;
  }

  function buildStageLevels() {
    const rand = rng(240024);
    const usedGlobal = new Set();
    const stageLevels = [];

    for (let stage = 0; stage < STAGE_NAMES.length; stage += 1) {
      const difficulty = difficultyForStage(stage);
      const selected = [];
      const selectedKeys = new Set();

      if (stage === 0) {
        for (let i = 0; i < BABY_SUPER_EASY.length && selected.length < 20; i += 1) {
          const nums = BABY_SUPER_EASY[i];
          const solve = window.Math24Solver.findStrictIntegerSolution(nums);
          if (!solve) continue;
          const k = key(nums);
          if (selectedKeys.has(k) || usedGlobal.has(k)) continue;
          selected.push(nums.slice());
          selectedKeys.add(k);
          usedGlobal.add(k);
        }
      }

      const pool = collectPool(rand, difficulty, usedGlobal, 240);
      const progressive = pickProgressiveTwenty(pool, stage);

      for (let i = 0; i < progressive.length && selected.length < 20; i += 1) {
        const nums = progressive[i];
        const k = key(nums);
        if (selectedKeys.has(k) || usedGlobal.has(k)) continue;
        selected.push(nums.slice());
        selectedKeys.add(k);
        usedGlobal.add(k);
      }

      while (selected.length < 20) {
        const nums = generateCandidate(rand, difficulty);
        const k = key(nums);
        if (selectedKeys.has(k) || usedGlobal.has(k)) continue;
        const solve = window.Math24Solver.findStrictIntegerSolution(nums);
        if (!solve || !validForDifficulty(nums, difficulty, solve)) continue;
        selected.push(nums.slice());
        selectedKeys.add(k);
        usedGlobal.add(k);
      }

      stageLevels.push(selected);
    }

    return stageLevels;
  }

  const stageLevelSets = buildStageLevels();

  function getStages() {
    return STAGE_NAMES.map((name, idx) => ({
      id: idx,
      name,
      levels: stageLevelSets[idx].map((nums, levelIdx) => ({
        id: levelIdx,
        nums: nums.slice(),
      })),
    }));
  }

  function getRandomSpeedSet() {
    const stage = Math.floor(Math.random() * stageLevelSets.length);
    const levels = stageLevelSets[stage];
    const item = levels[Math.floor(Math.random() * levels.length)];
    return item.slice();
  }

  window.Math24Levels = {
    STAGE_NAMES,
    getStages,
    getRandomSpeedSet,
  };
})();
