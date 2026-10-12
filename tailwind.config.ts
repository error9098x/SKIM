import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07070C', 900: '#0B0B13', 850: '#10101A', 800: '#151521', 700: '#1D1D2C', 600: '#2A2A3D', 500: '#3B3B52' },
        fog: { 100: '#F4F3FA', 200: '#DCDAEA', 300: '#B5B2CA', 400: '#8E8AA8', 500: '#6D6987' },
        peaq: { 300: '#C4B5FF', 400: '#A48BFF', 500: '#8B6CFF', 600: '#7350F5', 700: '#5B3BD6' },
        mint: { 400: '#4BE3B0', 500: '#22CC94' },
        amber: { 400: '#FFC56B' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular'],
      },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        flow: { '0%': { strokeDashoffset: '24' }, '100%': { strokeDashoffset: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        rise: 'rise .45s ease-out both',
        flow: 'flow 1s linear infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
