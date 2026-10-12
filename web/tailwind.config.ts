import type { Config } from 'tailwindcss';

// Semantic colours only. Every value is a CSS variable defined in app/globals.css
// (:root = light paper, .inst = dark instrument scope, html.theme-dark = fallback).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: v('paper'), 2: v('paper-2') },
        rule: v('rule'),
        ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3') },
        skim: { DEFAULT: v('skim'), text: v('skim-text') },
        repaid: { DEFAULT: v('repaid'), text: v('repaid-text') },
        peaq: { DEFAULT: v('peaq'), text: v('peaq-text') },
        danger: v('red'),
        hatch: v('hatch'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular'],
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', filter: 'blur(4px)' }, '100%': { opacity: '1', filter: 'blur(0)' } },
        rise: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        // transform/opacity only, never affects layout; 280ms inside the 180-320ms rule
        rise: 'rise .28s ease-out both',
        'fade-in': 'fade-in .5s ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
