/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50: '#FEFCFA',
          100: '#F5F0EB',
          200: '#EDE5DB',
          300: '#E8DFD4',
          400: '#D4C4B0',
          500: '#B8A08A',
          600: '#9C7C64',
          700: '#6B5543',
          800: '#4A3B2E',
          900: '#2D231B',
        },
        accent: {
          DEFAULT: '#D97706',
          light: '#F59E0B',
          dark: '#B45309',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.06)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.08)',
        'glass-inner': 'inset 0 1px 1px rgba(255, 255, 255, 0.4)',
        'glow': '0 0 20px rgba(217, 119, 6, 0.15)',
      },
    },
  },
  plugins: [],
};
