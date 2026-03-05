(function () {
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  class Fraction {
    constructor(num, den) {
      if (den === 0) {
        throw new Error("Division by zero");
      }
      if (den < 0) {
        num = -num;
        den = -den;
      }
      const d = gcd(num, den);
      this.num = num / d;
      this.den = den / d;
    }

    add(other) {
      return new Fraction(this.num * other.den + other.num * this.den, this.den * other.den);
    }

    sub(other) {
      return new Fraction(this.num * other.den - other.num * this.den, this.den * other.den);
    }

    mul(other) {
      return new Fraction(this.num * other.num, this.den * other.den);
    }

    div(other) {
      if (other.num === 0) {
        throw new Error("Division by zero");
      }
      return new Fraction(this.num * other.den, this.den * other.num);
    }

    equalsInt(value) {
      return this.den === 1 && this.num === value;
    }

    toString() {
      if (this.den === 1) {
        return String(this.num);
      }
      return `${this.num}/${this.den}`;
    }
  }

  function opSymbol(op) {
    if (op === "+") return "+";
    if (op === "-") return "-";
    if (op === "*") return "×";
    return "÷";
  }

  function applyOp(a, b, op) {
    if (op === "+") return a.add(b);
    if (op === "-") return a.sub(b);
    if (op === "*") return a.mul(b);
    return a.div(b);
  }

  function combineNodes(left, right, op) {
    let frac;
    try {
      frac = applyOp(left.frac, right.frac, op);
    } catch (err) {
      return null;
    }
    const symbol = opSymbol(op);
    const expr = `(${left.expr} ${symbol} ${right.expr})`;
    const stepLine = `(${left.frac.toString()} ${symbol} ${right.frac.toString()}) = ${frac.toString()}`;
    return {
      frac,
      expr,
      steps: left.steps.concat(right.steps, [stepLine]),
    };
  }

  function findSolution(numbers, target = 24) {
    const start = numbers.map((n) => ({
      frac: new Fraction(n, 1),
      expr: String(n),
      steps: [],
    }));

    function dfs(nodes) {
      if (nodes.length === 1) {
        return nodes[0].frac.equalsInt(target) ? nodes[0] : null;
      }

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const rest = [];
          for (let k = 0; k < nodes.length; k += 1) {
            if (k !== i && k !== j) rest.push(nodes[k]);
          }

          const a = nodes[i];
          const b = nodes[j];
          const candidates = [
            combineNodes(a, b, "+"),
            combineNodes(a, b, "*"),
            combineNodes(a, b, "-"),
            combineNodes(b, a, "-"),
            combineNodes(a, b, "/"),
            combineNodes(b, a, "/"),
          ];

          for (const next of candidates) {
            if (!next) continue;
            const result = dfs(rest.concat(next));
            if (result) return result;
          }
        }
      }

      return null;
    }

    return dfs(start);
  }

  function isSolvable(numbers, target = 24) {
    return !!findSolution(numbers, target);
  }

  function evalBinary(fracA, fracB, opSymbolText) {
    if (opSymbolText === "+") return fracA.add(fracB);
    if (opSymbolText === "-") return fracA.sub(fracB);
    if (opSymbolText === "×") return fracA.mul(fracB);
    if (opSymbolText === "÷") return fracA.div(fracB);
    throw new Error("Unknown operator");
  }

  window.Math24Solver = {
    Fraction,
    findSolution,
    isSolvable,
    evalBinary,
  };
})();
