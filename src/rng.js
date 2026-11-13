export function createRng(seed) {
  let state = seed >>> 0;
  return function rand() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function readSeed() {
  const value = Number(new URLSearchParams(location.search).get('seed'));
  return Number.isFinite(value) ? value >>> 0 : 42;
}
