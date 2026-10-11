import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pearl: 'rgb(var(--pearl-rgb) / <alpha-value>)',
        moonglow: 'rgb(var(--moonglow-rgb) / <alpha-value>)',
        silver: 'rgb(var(--silver-rgb) / <alpha-value>)',
        storm: 'rgb(var(--storm-rgb) / <alpha-value>)',
        'storm-deep': 'rgb(var(--storm-deep-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        card: 'rgb(var(--card-rgb) / <alpha-value>)',
        verified: 'rgb(var(--verified-rgb) / <alpha-value>)',
        rejected: 'rgb(var(--rejected-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'Arial', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(43,52,64,.06), 0 8px 24px rgba(43,52,64,.06)',
        lift: '0 18px 44px rgba(43,52,64,.12)',
      },
      borderRadius: {
        card: '16px',
      },
      keyframes: {
        'sheen-pan': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.56' },
        },
        'shake-small': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'sheen-pan': 'sheen-pan 8s ease-in-out infinite alternate',
        'soft-pulse': 'soft-pulse 2s ease-in-out infinite',
        'shake-small': 'shake-small .34s ease-in-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
