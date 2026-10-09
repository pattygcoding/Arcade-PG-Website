/** @type {import('tailwindcss').Config} */
// Design tokens mirrored from patrickgoodwin.dev / Neo-Connect-Four-Language-Tree:
// a navy canvas, a mint accent, Inter for text and JetBrains Mono for technical
// labels.  Every colour reads a CSS variable (defined in src/styles.css) so a
// single `data-theme` attribute flips the whole palette.
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          850: 'rgb(var(--ink-850) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
        },
        // Filled accents keep the pale mint; text/borders use `accent`, which
        // darkens in light mode so it stays legible on white.
        mint: {
          300: '#b9f4da',
          400: '#8debc4',
          500: '#6fd9af',
          600: '#4fb894',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        // Filled-accent foreground: near-black in both themes, because both
        // accent values are light enough that white text would wash out.
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-strong': 'rgb(var(--fg-strong) / <alpha-value>)',
        'fg-soft': 'rgb(var(--fg-soft) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        'fg-dim': 'rgb(var(--fg-dim) / <alpha-value>)',
        gutter: 'rgb(var(--gutter) / <alpha-value>)',
        hint: 'rgb(var(--hint) / <alpha-value>)',
        console: 'rgb(var(--console) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
