const BASE = 192;
const MAX_TICKS = 4 * BASE;
const memo = [
  undefined,
  [{ mmlLength: 192, dot: 0, numChars: 3 }],
];

function ticksToMMLLength(ticks) {
  const len = [];
  const bar = memo[MAX_TICKS];
  while (ticks >= MAX_TICKS) {
    len.push(...bar);
    ticks -= MAX_TICKS;
  }
  if (ticks > 0) {
    len.push(...memo[ticks]);
  }
  return len;
};

function getMMLLen(ticks) {
  if (memo[ticks] == undefined) {
    let prevMMLLen, prevNumChars = Infinity;
    for (let n = 1; n <= (ticks >> 1); n++) {
      const currMMLLen = [
        ...getMMLLen(ticks - n), ...getMMLLen(n)
      ];
      const currNumChars = currMMLLen.reduce(
        (n, m) => n + m.numChars, currMMLLen.length - 1);
      if (currNumChars < prevNumChars) {
        prevMMLLen = currMMLLen;
        prevNumChars = currNumChars;
      }
    }
    memo[ticks] = prevMMLLen;
  }
  return memo[ticks];
}

for (let ticks = 2; ticks <= BASE; ticks++) {
  if (BASE % ticks) {
    continue;
  }
  const mmlLength = BASE / ticks;
  const numChars = mmlLength.toString(10).length;
  memo[ticks] = { mmlLength, numChars };
  for (let dot = 0; ; dot++) {
    const mask = (1 << dot) - 1;
    if (ticks & mask) {
      break;
    }
    memo[ticks * ((mask << 1) | 1) / (1 << dot)] = [{
      mmlLength, dot, numChars: (numChars + dot)
    }];
  }
}

for (let ticks = BASE + 1; ticks <= MAX_TICKS; ticks++) {
  memo[ticks] = memo[ticks] || getMMLLen(ticks);
}

module.exports = ticksToMMLLength;
