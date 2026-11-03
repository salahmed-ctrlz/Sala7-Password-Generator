import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import {
  generate,
  generatePassphrase,
  parseCustom,
  passwordEntropy,
  poolSize,
  rateEntropy,
  type Level,
  type Options,
  type PassphraseOptions,
} from './lib/password';

type Theme = 'light' | 'dark' | 'terminal';
type Mode = 'password' | 'passphrase';
type Settings = Options & PassphraseOptions & { mode: Mode };

interface Generated {
  value: string;
  entropy: number;
  settings: Settings;
}

interface HistoryEntry {
  id: number;
  value: string;
  label: string;
}

const THEMES: Theme[] = ['light', 'dark', 'terminal'];
const HISTORY_LIMIT = 8;
const SEPARATORS: { label: string; value: string }[] = [
  { label: 'Hyphen  -', value: '-' },
  { label: 'Dot  .', value: '.' },
  { label: 'Underscore  _', value: '_' },
  { label: 'Space', value: ' ' },
  { label: 'None', value: '' },
];

const DEFAULTS: Settings = {
  mode: 'password',
  length: 16,
  lower: true,
  upper: true,
  numbers: true,
  symbols: true,
  ambiguous: false,
  custom: '',
  words: 5,
  separator: '-',
  capitalize: false,
  digits: false,
};

const levelColor: Record<Level, string> = {
  weak: 'bg-bad',
  fair: 'bg-warn',
  strong: 'bg-good',
  excellent: 'bg-good',
};

/* ---------- persistence (everything except custom characters) ---------- */

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem('pwgen-theme');
    if (saved && THEMES.includes(saved as Theme)) return saved as Theme;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem('pwgen-settings') ?? 'null');
    if (!raw || typeof raw !== 'object') return DEFAULTS;
    const num = (v: unknown, min: number, max: number, d: number) =>
      typeof v === 'number' && v >= min && v <= max ? Math.round(v) : d;
    const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
    const s: Settings = {
      mode: raw.mode === 'passphrase' ? 'passphrase' : 'password',
      length: num(raw.length, 8, 64, DEFAULTS.length),
      lower: bool(raw.lower, true),
      upper: bool(raw.upper, true),
      numbers: bool(raw.numbers, true),
      symbols: bool(raw.symbols, true),
      ambiguous: bool(raw.ambiguous, false),
      custom: '',
      words: num(raw.words, 3, 10, DEFAULTS.words),
      separator: SEPARATORS.some((x) => x.value === raw.separator) ? raw.separator : DEFAULTS.separator,
      capitalize: bool(raw.capitalize, false),
      digits: bool(raw.digits, false),
    };
    if (!s.lower && !s.upper && !s.numbers && !s.symbols) s.lower = true;
    return s;
  } catch {
    return DEFAULTS;
  }
}

/* ---------- helpers ---------- */

let wordsPromise: Promise<string[]> | null = null;
const loadWords = () => (wordsPromise ??= import('./lib/wordlist.json').then((m) => m.default as string[]));

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts / older browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(el);
    return ok;
  }
}

/** The settings that actually affect the current mode, for change detection. */
function relevant(s: Settings): string {
  return s.mode === 'password'
    ? JSON.stringify([s.mode, s.length, s.lower, s.upper, s.numbers, s.symbols, s.ambiguous, s.custom])
    : JSON.stringify([s.mode, s.words, s.separator, s.capitalize, s.digits]);
}

async function make(s: Settings): Promise<{ value: string; entropy: number } | null> {
  if (s.mode === 'passphrase') return generatePassphrase(await loadWords(), s);
  const value = generate(s);
  return value ? { value, entropy: passwordEntropy(s.length, poolSize(s)) } : null;
}

/* ---------- small components ---------- */

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-3 min-h-[2.75rem] ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="check"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">
        {label}
        {hint && <span className="text-muted"> {hint}</span>}
      </span>
    </label>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="font-mono text-sm tabular-nums">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range mt-2"
      />
    </div>
  );
}

/** Digits and symbols get a tint so look-alikes (0/O, 1/l) are easy to tell apart when typing it out. */
function Tinted({ value }: { value: string }) {
  return (
    <>
      {Array.from(value).map((c, i) => (
        <span key={i} className={/[0-9]/.test(c) ? 'text-accent' : /[^a-zA-Z0-9]/.test(c) ? 'text-warn' : undefined}>
          {c}
        </span>
      ))}
    </>
  );
}

/* ---------- app ---------- */

function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimer = useRef<number>();
  const nextId = useRef(1);

  const isPassphrase = settings.mode === 'passphrase';
  const customActive = parseCustom(settings.custom).length > 0;
  const canGenerate = isPassphrase || poolSize(settings) >= 2;
  const password = generated?.value ?? '';
  const strength = useMemo(() => (generated ? rateEntropy(generated.entropy) : null), [generated]);
  const dirty = generated !== null && relevant(generated.settings) !== relevant(settings);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('pwgen-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('pwgen-settings', JSON.stringify({ ...settings, custom: '' }));
    } catch {
      /* storage unavailable */
    }
  }, [settings]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const regenerate = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await make(settings);
      if (!next) return;
      setHistory((prev) =>
        generated && strength
          ? [{ id: nextId.current++, value: generated.value, label: strength.label }, ...prev].slice(0, HISTORY_LIMIT)
          : prev,
      );
      setGenerated({ ...next, settings });
    } finally {
      setBusy(false);
    }
  }, [busy, settings, generated, strength]);

  // One password on first load. After that it only changes when the user presses Generate.
  useEffect(() => {
    let live = true;
    make(settings).then((next) => {
      if (live && next) setGenerated({ ...next, settings });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start fetching the word list as soon as passphrase mode is picked.
  useEffect(() => {
    if (isPassphrase) void loadWords();
  }, [isPassphrase]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      // Never allow every character class to be switched off.
      if (!next.lower && !next.upper && !next.numbers && !next.symbols) next.lower = true;
      return next;
    });
  };

  const copy = async (text: string, key: string) => {
    if (!text) return;
    const ok = await writeClipboard(text);
    window.clearTimeout(copyTimer.current);
    setCopyFailed(!ok);
    setCopiedId(ok ? key : null);
    copyTimer.current = window.setTimeout(() => {
      setCopiedId(null);
      setCopyFailed(false);
    }, 2000);
  };

  const mask = (v: string) => '•'.repeat(Math.min(v.length, 64));
  const modeBtn = (m: Mode, label: string) => (
    <button
      role="tab"
      aria-selected={settings.mode === m}
      onClick={() => update('mode', m)}
      className={`flex-1 h-10 rounded text-sm font-medium transition-colors ${
        settings.mode === m ? 'bg-bg text-fg shadow-[0_0_0_1px_rgb(var(--line))]' : 'text-muted hover:text-fg'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="wrap pt-5 sm:pt-8 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 min-w-0 text-base sm:text-lg font-semibold tracking-tight">
          <span className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" aria-hidden />
          <span className="truncate">Password Generator</span>
        </h1>
        <div role="radiogroup" aria-label="Theme" className="flex shrink-0 rounded-md border border-line bg-surface p-0.5 text-xs">
          {THEMES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              onClick={() => setTheme(t)}
              className={`px-2.5 py-2 sm:py-1.5 rounded capitalize transition-colors ${
                theme === t ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 wrap py-6 sm:py-10">
        <p className="text-sm text-muted max-w-xl">
          Made in your browser with the Web Crypto API. Nothing is stored or sent anywhere.
        </p>

        <div className="mt-5 sm:mt-6 grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <section className="rounded-lg border border-line bg-surface p-4 sm:p-6" aria-label="Generator">
            <div role="tablist" aria-label="Type" className="flex gap-1 rounded-md bg-line/50 p-1">
              {modeBtn('password', 'Password')}
              {modeBtn('passphrase', 'Passphrase')}
            </div>

            {/* Output: tap to copy */}
            <button
              onClick={() => copy(password, 'current')}
              disabled={!generated}
              aria-label="Copy password"
              title="Click to copy"
              className="mt-4 block w-full text-left rounded-md border border-line bg-bg px-3 py-3 font-mono text-base sm:text-lg break-all min-h-[3.5rem] hover:border-muted transition-colors"
            >
              {!generated ? (
                <span className="text-sm text-muted font-sans">{canGenerate ? 'Generating…' : 'Enter at least 2 different characters'}</span>
              ) : !reveal ? (
                mask(password)
              ) : generated.settings.mode === 'password' ? (
                <Tinted value={password} />
              ) : (
                password
              )}
            </button>

            {/* Actions */}
            <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
              <button
                onClick={regenerate}
                disabled={!canGenerate || busy}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent text-accent-fg px-4 h-12 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <RefreshCw size={16} />
                Generate
              </button>
              <button
                onClick={() => copy(password, 'current')}
                disabled={!generated}
                aria-label="Copy password"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-line h-12 px-4 text-sm font-medium hover:bg-bg transition-colors disabled:opacity-40"
              >
                {copiedId === 'current' ? <Check size={18} className="text-good" /> : <Copy size={18} />}
                <span className="hidden sm:inline">{copiedId === 'current' ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                aria-pressed={!reveal}
                className="inline-flex items-center justify-center rounded-md border border-line h-12 w-12 text-muted hover:text-fg hover:bg-bg transition-colors"
              >
                {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="mt-2 min-h-[1rem] text-xs" role="status">
              {copiedId === 'current' && <span className="text-good">Copied to clipboard</span>}
              {copyFailed && <span className="text-bad">Couldn't copy — select the text and copy it manually</span>}
              {!copiedId && !copyFailed && dirty && (
                <span className="text-muted">Settings changed. Press Generate to apply them.</span>
              )}
            </p>

            {/* Strength */}
            <div className="mt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">{strength?.label ?? '—'}</span>
                <span className="text-muted">
                  {strength ? `${Math.round(strength.entropy)} bits · cracked in ${strength.crackTime}` : ''}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${strength ? levelColor[strength.level] : ''}`}
                  style={{ width: `${strength ? strength.fill * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">Estimate assumes 10 billion guesses/second.</p>
            </div>

            <hr className="my-5 sm:my-6 border-line" />

            {/* Options */}
            {!isPassphrase ? (
              <div className="space-y-6">
                <Slider id="length" label="Length" value={settings.length} min={8} max={64} onChange={(v) => update('length', v)} />

                <fieldset>
                  <legend className="text-sm font-medium mb-1">Include</legend>
                  <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-4">
                    <Toggle label="Lowercase (a–z)" checked={settings.lower} disabled={customActive} onChange={(v) => update('lower', v)} />
                    <Toggle label="Uppercase (A–Z)" checked={settings.upper} disabled={customActive} onChange={(v) => update('upper', v)} />
                    <Toggle label="Numbers (0–9)" checked={settings.numbers} disabled={customActive} onChange={(v) => update('numbers', v)} />
                    <Toggle label="Symbols (!@#…)" checked={settings.symbols} disabled={customActive} onChange={(v) => update('symbols', v)} />
                  </div>
                  <Toggle
                    label="Avoid look-alikes"
                    hint="(I l 1 O 0)"
                    checked={settings.ambiguous}
                    disabled={customActive}
                    onChange={(v) => update('ambiguous', v)}
                  />
                </fieldset>

                <div>
                  <label htmlFor="custom" className="text-sm font-medium">
                    Custom characters <span className="text-muted font-normal">(optional)</span>
                  </label>
                  <input
                    id="custom"
                    type="text"
                    value={settings.custom}
                    onChange={(e) => update('custom', e.target.value)}
                    placeholder="e.g. abc123!"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="mt-2 w-full h-11 rounded-md border border-line bg-bg px-3 text-base font-mono placeholder:text-muted/70 focus:outline-none focus:border-accent"
                  />
                  {customActive && (
                    <p className="mt-1.5 text-xs text-muted">
                      Only these characters are used. Clear the field to use the options above.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <Slider id="words" label="Words" value={settings.words} min={3} max={10} onChange={(v) => update('words', v)} />

                <div>
                  <label htmlFor="separator" className="text-sm font-medium">
                    Separator
                  </label>
                  <select
                    id="separator"
                    value={settings.separator}
                    onChange={(e) => update('separator', e.target.value)}
                    className="mt-2 w-full h-11 rounded-md border border-line bg-bg px-3 text-base focus:outline-none focus:border-accent"
                  >
                    {SEPARATORS.map((s) => (
                      <option key={s.label} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-4">
                  <legend className="sr-only">Extras</legend>
                  <Toggle label="Capitalize words" checked={settings.capitalize} onChange={(v) => update('capitalize', v)} />
                  <Toggle label="Add 2 digits" checked={settings.digits} onChange={(v) => update('digits', v)} />
                </fieldset>

                <p className="text-xs text-muted">
                  Words are picked at random from the EFF long wordlist (7,776 words, about 12.9 bits each). Easier to
                  remember and type than random characters, and just as strong at 6 words or more.
                </p>
              </div>
            )}
          </section>

          {/* History */}
          <aside className="rounded-lg border border-line bg-surface p-4 sm:p-5 lg:sticky lg:top-6" aria-label="Recent passwords">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Recent</h2>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} className="px-2 py-1 -mr-2 text-xs text-muted hover:text-fg transition-colors">
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Passwords you replace show up here until you leave the page.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm truncate">{reveal ? entry.value : mask(entry.value)}</div>
                      <div className="text-xs text-muted">{entry.label}</div>
                    </div>
                    <button
                      onClick={() => copy(entry.value, `h${entry.id}`)}
                      aria-label="Copy this password"
                      className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted hover:text-fg transition-colors"
                    >
                      {copiedId === `h${entry.id}` ? <Check size={16} className="text-good" /> : <Copy size={16} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </main>

      <footer className="wrap pb-8">
        <div className="border-t border-line pt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-muted">
          <a
            href="https://salaheddinemedkour.me"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 hover:text-fg transition-colors"
          >
            salaheddinemedkour.me
          </a>
          <nav className="flex gap-5" aria-label="Links">
            <a href="https://github.com/salahmed-ctrlz" target="_blank" rel="noopener noreferrer" className="py-2 hover:text-fg transition-colors">
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/salah-eddine-medkour/"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 hover:text-fg transition-colors"
            >
              LinkedIn
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default App;
