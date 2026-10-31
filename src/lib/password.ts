export const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+{}[]:;<>,.?/~-=',
} as const;

export interface Options {
  length: number;
  lower: boolean;
  upper: boolean;
  numbers: boolean;
  symbols: boolean;
  custom: string;
}

/** Uniform random integer in [0, max) using rejection sampling (no modulo bias). */
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/** Unique characters of the custom set, split by code point so emoji aren't torn apart. */
export function parseCustom(custom: string): string[] {
  return Array.from(new Set(Array.from(custom.replace(/\s/g, ''))));
}

/** The character groups that will be used for the given options. */
export function activeGroups(o: Options): string[][] {
  const custom = parseCustom(o.custom);
  if (custom.length > 0) return [custom];
  const groups: string[] = [];
  if (o.lower) groups.push(SETS.lower);
  if (o.upper) groups.push(SETS.upper);
  if (o.numbers) groups.push(SETS.numbers);
  if (o.symbols) groups.push(SETS.symbols);
  return groups.map((g) => Array.from(g));
}

export function poolSize(o: Options): number {
  return new Set(activeGroups(o).flat()).size;
}

/** Returns null when the options can't produce a password. */
export function generate(o: Options): string | null {
  const groups = activeGroups(o);
  const pool = groups.flat();
  if (pool.length < 2) return null;

  const out: string[] = [];
  // Guarantee one character from each selected group (when there is room).
  if (groups.length > 1) {
    for (const g of groups) out.push(g[randomInt(g.length)]);
  }
  while (out.length < o.length) out.push(pool[randomInt(pool.length)]);

  // Fisher–Yates shuffle so the guaranteed characters aren't at the front.
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, o.length).join('');
}

export type Level = 'weak' | 'fair' | 'strong' | 'excellent';

export interface Strength {
  entropy: number;
  level: Level;
  label: string;
  crackTime: string;
  /** 0–1 for the meter */
  fill: number;
}

const GUESSES_PER_SECOND = 1e10; // offline attack on a fast hash

function formatDuration(seconds: number): string {
  if (seconds < 1) return 'instantly';
  const units: [string, number][] = [
    ['second', 1],
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['year', 31557600],
  ];
  let value = seconds;
  let unit = units[0];
  for (const u of units) if (seconds >= u[1]) unit = u;
  value = seconds / unit[1];
  if (unit[0] === 'year' && value >= 1e9) return 'billions of years';
  if (unit[0] === 'year' && value >= 1e6) return 'millions of years';
  if (unit[0] === 'year' && value >= 1e3) return 'thousands of years';
  const n = Math.floor(value);
  return `${n} ${unit[0]}${n === 1 ? '' : 's'}`;
}

/** Entropy-based strength for a password drawn uniformly from `pool` symbols. */
export function rate(length: number, pool: number): Strength {
  const entropy = pool > 1 ? length * Math.log2(pool) : 0;
  const level: Level =
    entropy < 40 ? 'weak' : entropy < 64 ? 'fair' : entropy < 100 ? 'strong' : 'excellent';
  const label = { weak: 'Weak', fair: 'Fair', strong: 'Strong', excellent: 'Excellent' }[level];
  const seconds = Math.pow(2, Math.max(0, entropy - 1)) / GUESSES_PER_SECOND;
  return {
    entropy,
    level,
    label,
    crackTime: formatDuration(seconds),
    fill: Math.min(1, entropy / 128),
  };
}
