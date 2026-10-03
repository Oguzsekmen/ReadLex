/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './{components,hooks,services}/**/*.{ts,tsx}', './App.tsx', './index.tsx'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        fun: {
          pink: '#ec4899',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          green: '#10b981',
        },
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
      },
    },
  },
  plugins: [],
};
