import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Github, Linkedin, RefreshCw } from 'lucide-react';
import { generate, parseCustom, poolSize, rate, type Level, type Options } from './lib/password';

type Theme = 'light' | 'dark' | 'terminal';
const THEMES: Theme[] = ['light', 'dark', 'terminal'];
const HISTORY_LIMIT = 8;

interface HistoryEntry {
  id: number;
  value: string;
  label: string;
}

const levelColor: Record<Level, string> = {
  weak: 'bg-bad',
  fair: 'bg-warn',
  strong: 'bg-good',
  excellent: 'bg-good',
};

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem('sala7-theme');
    if (saved && THEMES.includes(saved as Theme)) return saved as Theme;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

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

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-3 py-1.5 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="check"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [options, setOptions] = useState<Options>({
    length: 16,
    lower: true,
    upper: true,
    numbers: true,
    symbols: true,
    custom: '',
  });
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimer = useRef<number>();
  const nextId = useRef(1);

  const customActive = parseCustom(options.custom).length > 0;
  const pool = poolSize(options);
  const canGenerate = pool >= 2;
  const strength = useMemo(() => rate(options.length, pool), [options.length, pool]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('sala7-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  // Regenerate whenever the options change.
  useEffect(() => {
    setPassword(generate(options) ?? '');
  }, [options]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const update = <K extends keyof Options>(key: K, value: Options[K]) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: value };
      // Never allow every character class to be switched off.
      if (!next.lower && !next.upper && !next.numbers && !next.symbols) next.lower = true;
      return next;
    });
  };

  const regenerate = useCallback(() => {
    const next = generate(options);
    if (!next) return;
    setHistory((prev) =>
      password
        ? [{ id: nextId.current++, value: password, label: strength.label }, ...prev].slice(0, HISTORY_LIMIT)
        : prev,
    );
    setPassword(next);
  }, [options, password, strength.label]);

  const copy = async (text: string, key: string) => {
    const ok = await writeClipboard(text);
    window.clearTimeout(copyTimer.current);
    setCopyFailed(!ok);
    setCopiedId(ok ? key : null);
    copyTimer.current = window.setTimeout(() => {
      setCopiedId(null);
      setCopyFailed(false);
    }, 2000);
  };

  const mask = (v: string) => '•'.repeat(v.length);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" aria-hidden />
          <span className="font-semibold tracking-tight truncate">Sala7</span>
        </div>
        <div role="radiogroup" aria-label="Theme" className="flex rounded-md border border-line bg-surface p-0.5 text-xs">
          {THEMES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              onClick={() => setTheme(t)}
              className={`px-2.5 py-1.5 rounded capitalize transition-colors ${
                theme === t ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Password generator</h1>
        <p className="mt-2 text-sm text-muted">
          Generated in your browser with the Web Crypto API. Nothing is stored or sent anywhere.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px] items-start">
          <section className="rounded-lg border border-line bg-surface p-4 sm:p-6" aria-label="Generator">
            {/* Output */}
            <div className="flex items-stretch gap-2">
              <output
                aria-live="polite"
                className="flex-1 min-w-0 rounded-md border border-line bg-bg px-3 py-3 font-mono text-base sm:text-lg break-all select-all min-h-[3.25rem] flex items-center"
              >
                {canGenerate ? (reveal ? password : mask(password)) : (
                  <span className="text-sm text-muted font-sans">Enter at least 2 different characters</span>
                )}
              </output>
              <button
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                aria-pressed={reveal}
                className="px-3 rounded-md border border-line text-muted hover:text-fg transition-colors"
              >
                {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button
                onClick={() => copy(password, 'current')}
                disabled={!canGenerate}
                aria-label="Copy password"
                className="px-3 rounded-md border border-line text-muted hover:text-fg transition-colors disabled:opacity-40"
              >
                {copiedId === 'current' ? <Check size={18} className="text-good" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="mt-2 h-4 text-xs" role="status">
              {copiedId === 'current' && <span className="text-good">Copied to clipboard</span>}
              {copyFailed && <span className="text-bad">Couldn't copy — select the text and copy manually</span>}
            </p>

            {/* Strength */}
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{canGenerate ? strength.label : '—'}</span>
                <span className="text-muted">
                  {canGenerate ? `${Math.round(strength.entropy)} bits · cracked in ${strength.crackTime}` : ''}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${levelColor[strength.level]}`}
                  style={{ width: `${canGenerate ? strength.fill * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                Estimate assumes 10 billion guesses per second against a fast hash.
              </p>
            </div>

            <hr className="my-6 border-line" />

            {/* Options */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor="length" className="text-sm font-medium">
                    Length
                  </label>
                  <span className="font-mono text-sm tabular-nums">{options.length}</span>
                </div>
                <input
                  id="length"
                  type="range"
                  min={8}
                  max={64}
                  value={options.length}
                  onChange={(e) => update('length', Number(e.target.value))}
                  className="range"
                />
              </div>

              <fieldset className="grid grid-cols-2 gap-x-4">
                <legend className="sr-only">Character types</legend>
                <Toggle label="Lowercase (a–z)" checked={options.lower} disabled={customActive} onChange={(v) => update('lower', v)} />
                <Toggle label="Uppercase (A–Z)" checked={options.upper} disabled={customActive} onChange={(v) => update('upper', v)} />
                <Toggle label="Numbers (0–9)" checked={options.numbers} disabled={customActive} onChange={(v) => update('numbers', v)} />
                <Toggle label="Symbols (!@#…)" checked={options.symbols} disabled={customActive} onChange={(v) => update('symbols', v)} />
              </fieldset>

              <div>
                <label htmlFor="custom" className="text-sm font-medium">
                  Custom characters <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="custom"
                  type="text"
                  value={options.custom}
                  onChange={(e) => update('custom', e.target.value)}
                  placeholder="e.g. abc123!"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/70 focus:outline-none focus:border-accent"
                />
                {customActive && (
                  <p className="mt-1.5 text-xs text-muted">
                    Only these characters are used. Clear the field to use the options above.
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={regenerate}
              disabled={!canGenerate}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent text-accent-fg px-4 py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <RefreshCw size={16} />
              Generate new password
            </button>
          </section>

          {/* History */}
          <aside className="rounded-lg border border-line bg-surface p-4 sm:p-5" aria-label="Recent passwords">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Recent</h2>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} className="text-xs text-muted hover:text-fg transition-colors">
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Passwords you've replaced show up here until you leave the page.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm truncate">{reveal ? entry.value : mask(entry.value)}</div>
                      <div className="text-xs text-muted">{entry.label}</div>
                    </div>
                    <button
                      onClick={() => copy(entry.value, `h${entry.id}`)}
                      aria-label="Copy this password"
                      className="p-2 rounded-md text-muted hover:text-fg transition-colors"
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

      <footer className="w-full max-w-4xl mx-auto px-4 sm:px-6 pb-8 flex items-center justify-between text-sm text-muted">
        <span>Built by Salah Eddine</span>
        <nav className="flex gap-1" aria-label="Links">
          <a
            href="https://github.com/salahmed-ctrlz"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="p-2 rounded-md hover:text-fg transition-colors"
          >
            <Github size={18} />
          </a>
          <a
            href="https://www.linkedin.com/in/salah-eddine-medkour/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="p-2 rounded-md hover:text-fg transition-colors"
          >
            <Linkedin size={18} />
          </a>
        </nav>
      </footer>
    </div>
  );
}

export default App;
