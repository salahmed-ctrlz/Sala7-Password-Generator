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
    const saved = localStorage.getItem('pwgen-theme');
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
    <label className={`flex items-center gap-3 min-h-[2.75rem] ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
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
  const [generated, setGenerated] = useState<{ value: string; options: Options } | null>(null);
  const [reveal, setReveal] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimer = useRef<number>();
  const nextId = useRef(1);

  const customActive = parseCustom(options.custom).length > 0;
  const pool = poolSize(options);
  const canGenerate = pool >= 2;
  const password = generated?.value ?? '';
  // Strength always describes the password on screen, not the sliders.
  const strength = useMemo(
    () => (generated ? rate(generated.options.length, poolSize(generated.options)) : rate(0, 0)),
    [generated],
  );
  const hasPassword = generated !== null;
  const dirty = generated !== null && JSON.stringify(generated.options) !== JSON.stringify(options);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('pwgen-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  // One password on first load. After that it only changes when the user presses Generate.
  useEffect(() => {
    const value = generate(options);
    if (value) setGenerated({ value, options });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      generated
        ? [{ id: nextId.current++, value: generated.value, label: strength.label }, ...prev].slice(0, HISTORY_LIMIT)
        : prev,
    );
    setGenerated({ value: next, options });
  }, [options, generated, strength.label]);

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
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 flex items-center justify-between gap-3">
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

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <p className="text-sm text-muted max-w-xl">
          Random passwords made in your browser with the Web Crypto API. Nothing is stored or sent anywhere.
        </p>

        <div className="mt-5 sm:mt-6 grid gap-5 lg:grid-cols-[1fr_320px] items-start">
          <section className="rounded-lg border border-line bg-surface p-4 sm:p-6" aria-label="Generator">
            {/* Output */}
            <output
              aria-live="polite"
              className="block w-full rounded-md border border-line bg-bg px-3 py-3 font-mono text-base sm:text-lg break-all select-all min-h-[3.5rem]"
            >
              {hasPassword ? (
                reveal ? password : mask(password)
              ) : (
                <span className="text-sm text-muted font-sans">Enter at least 2 different characters</span>
              )}
            </output>

            {/* Actions */}
            <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
              <button
                onClick={regenerate}
                disabled={!canGenerate}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-accent text-accent-fg px-4 h-12 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <RefreshCw size={16} />
                Generate
              </button>
              <button
                onClick={() => copy(password, 'current')}
                disabled={!hasPassword}
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
                <span className="font-medium">{hasPassword ? strength.label : '—'}</span>
                <span className="text-muted">
                  {hasPassword ? `${Math.round(strength.entropy)} bits · cracked in ${strength.crackTime}` : ''}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${levelColor[strength.level]}`}
                  style={{ width: `${hasPassword ? strength.fill * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                Assumes 10 billion guesses per second against a fast hash.
              </p>
            </div>

            <hr className="my-5 sm:my-6 border-line" />

            {/* Options */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
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
                  className="range mt-2"
                />
              </div>

              <fieldset>
                <legend className="text-sm font-medium mb-1">Include</legend>
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-4">
                  <Toggle label="Lowercase (a–z)" checked={options.lower} disabled={customActive} onChange={(v) => update('lower', v)} />
                  <Toggle label="Uppercase (A–Z)" checked={options.upper} disabled={customActive} onChange={(v) => update('upper', v)} />
                  <Toggle label="Numbers (0–9)" checked={options.numbers} disabled={customActive} onChange={(v) => update('numbers', v)} />
                  <Toggle label="Symbols (!@#…)" checked={options.symbols} disabled={customActive} onChange={(v) => update('symbols', v)} />
                </div>
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
          </section>

          {/* History */}
          <aside className="rounded-lg border border-line bg-surface p-4 sm:p-5" aria-label="Recent passwords">
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

      <footer className="w-full max-w-4xl mx-auto px-4 sm:px-6 pb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted">
        <p>Built by Salah Eddine Medkour</p>
        <nav className="flex items-center -ml-2 sm:ml-0 sm:-mr-2" aria-label="Links">
          <a
            href="https://salaheddinemedkour.me"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 h-11 inline-flex items-center rounded-md hover:text-fg transition-colors"
          >
            salaheddinemedkour.me
          </a>
          <a
            href="https://github.com/salahmed-ctrlz"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="w-11 h-11 inline-flex items-center justify-center rounded-md hover:text-fg transition-colors"
          >
            <Github size={18} />
          </a>
          <a
            href="https://www.linkedin.com/in/salah-eddine-medkour/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="w-11 h-11 inline-flex items-center justify-center rounded-md hover:text-fg transition-colors"
          >
            <Linkedin size={18} />
          </a>
        </nav>
      </footer>
    </div>
  );
}

export default App;
