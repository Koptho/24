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
      return !stepText.includes("/") && !stepText.includes("÷") && Math.max(...nums) <= 9;
    }
    if (difficulty === "medium") {
      return Math.max(...nums) <= 13;
    }
    return (expr.includes("÷") || stepText.includes("/")) && Math.max(...nums) <= 13;
  }

  function generateCandidate(rand, difficulty) {
    const max = difficulty === "easy" ? 9 : 13;
    return [
      randomInt(rand, 1, max),
      randomInt(rand, 1, max),
      randomInt(rand, 1, max),
      randomInt(rand, 1, max),
    ];
  }

  function buildStageLevels() {
    const rand = rng(240024);
    const usedGlobal = new Set();
    const stageLevels = [];

    for (let stage = 0; stage < STAGE_NAMES.length; stage += 1) {
      const difficulty = difficultyForStage(stage);
      const source = handcrafted[difficulty];
      const selected = [];

      for (let i = 0; i < source.length && selected.length < 20; i += 1) {
        const nums = source[i];
        const k = `${difficulty}:${key(nums)}`;
        if (usedGlobal.has(k)) continue;
        const solve = window.Math24Solver.findSolution(nums);
        if (!solve) continue;
        selected.push(nums.slice());
        usedGlobal.add(k);
      }

      let safety = 0;
      while (selected.length < 20 && safety < 12000) {
        safety += 1;
        const nums = generateCandidate(rand, difficulty);
        const k = `${difficulty}:${key(nums)}`;
        if (usedGlobal.has(k)) continue;
        const solve = window.Math24Solver.findSolution(nums);
        if (!solve) continue;
        if (!validForDifficulty(nums, difficulty, solve)) continue;
        selected.push(nums);
        usedGlobal.add(k);
      }

      while (selected.length < 20) {
        const nums = generateCandidate(rand, "medium");
        const solve = window.Math24Solver.findSolution(nums);
        if (!solve) continue;
        selected.push(nums);
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
