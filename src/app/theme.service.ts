import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Persisted key, shared with the pre-paint script in index.html. */
const STORAGE_KEY = 'pg-arcade-theme';

/**
 * Owns the light/dark theme.  The initial value mirrors index.html's pre-paint
 * script (stored choice, else the OS preference) so the first render agrees with
 * the palette already painted on <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly current = signal<Theme>(readInitialTheme());

  /** Read-only view of the active theme for templates. */
  readonly theme = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  toggle(): void {
    this.set(this.current() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.current.set(theme);
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies.
    }
  }

  private apply(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function readInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Fall through to the system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
