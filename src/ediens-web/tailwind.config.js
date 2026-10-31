/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b', // zinc-950
        surface: {
          DEFAULT: '#18181b', // zinc-900
          subtle: '#27272a', // zinc-800
          hover: '#3f3f46', // zinc-700
        },
        border: {
          DEFAULT: '#27272a', // zinc-800
          subtle: '#3f3f46', // zinc-700
          bright: '#52525b', // zinc-600
        },
        macro: {
          calories: {
            DEFAULT: '#f59e0b', // amber-500
            subtle: '#78350f',
            bg: '#451a03',
          },
          protein: {
            DEFAULT: '#38bdf8', // sky-400
            subtle: '#0369a1',
            bg: '#082f49',
          },
          fat: {
            DEFAULT: '#fb7185', // rose-400
            subtle: '#be123c',
            bg: '#4c0519',
          },
          carbs: {
            DEFAULT: '#34d399', // emerald-400
            subtle: '#047857',
            bg: '#022c22',
          },
        },
        fefo: {
          fresh: '#10b981',
          warning: '#f59e0b',
          critical: '#f43f5e',
          expired: '#71717a',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out forwards',
        'slide-down': 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
