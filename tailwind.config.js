/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#E6F3F8',
          100: '#C5E4F0',
          200: '#8EC9E0',
          300: '#57AECF',
          400: '#3BA3D1',
          500: '#0B6E99',
          600: '#0A5F85',
          700: '#084E6C',
          800: '#063D54',
          900: '#042C3C',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
        },
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        ok: {
          DEFAULT: 'rgb(var(--ok) / <alpha-value>)',
          soft: 'rgb(var(--ok-soft) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'rgb(var(--warn) / <alpha-value>)',
          soft: 'rgb(var(--warn-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          soft: 'rgb(var(--info-soft) / <alpha-value>)',
        },
        primary: {
          50: '#E6F3F8',
          100: '#C5E4F0',
          200: '#8EC9E0',
          300: '#57AECF',
          400: '#3BA3D1',
          500: '#0B6E99',
          600: '#0A5F85',
          700: '#084E6C',
          800: '#063D54',
          900: '#042C3C',
        },
      },
      borderRadius: {
        card: '12px',
        control: '8px',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(15 18 22 / 0.04), 0 1px 3px rgb(15 18 22 / 0.06)',
        lift: '0 2px 8px rgb(15 18 22 / 0.08)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        shimmer: 'shimmer 1.2s infinite',
      },
    },
  },
  plugins: [],
}
