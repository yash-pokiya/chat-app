/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '375px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0effe',
          100: '#e3e1fd',
          200: '#cbc7fb',
          300: '#a89df7',
          400: '#8b7ef2',
          500: '#6C63FF',
          600: '#5a4fe0',
          700: '#4a3fc0',
          800: '#3d349c',
          900: '#332d7d',
        },
        cyan: {
          400: '#48CAE4',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft:    '#F7F7F8',
          muted:   '#F3F4F6',
        },
        ink: {
          DEFAULT: '#1A1A2E',
          muted:   '#6B7280',
          faint:   '#9CA3AF',
        },
        border: '#E5E7EB',
        success: '#10B981',
        danger:  '#EF4444',
        warning: '#F59E0B',
      },
      boxShadow: {
        card:   '0 4px 24px rgba(108, 99, 255, 0.08)',
        'card-hover': '0 8px 40px rgba(108, 99, 255, 0.14)',
        brand:  '0 4px 20px rgba(108, 99, 255, 0.30)',
        'brand-lg': '0 8px 32px rgba(108, 99, 255, 0.35)',
        input:  '0 0 0 3px rgba(108, 99, 255, 0.15)',
        'glass': '0 8px 32px rgba(108, 99, 255, 0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6C63FF 0%, #48CAE4 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(108,99,255,0.12) 0%, rgba(72,202,228,0.12) 100%)',
        'card-gradient': 'linear-gradient(145deg, #ffffff 0%, #f7f7f8 100%)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'blob': 'blob 12s ease-in-out infinite',
        'blob-delay': 'blob 12s ease-in-out 4s infinite',
        'blob-delay2': 'blob 12s ease-in-out 8s infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce-dot': 'bounceDot 1.4s ease-in-out infinite',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px,20px) scale(0.9)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '50%': { transform: 'scale(1.2)', opacity: '0.3' },
          '100%': { transform: 'scale(0.8)', opacity: '0.8' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceDot: {
          '0%, 60%, 100%': { transform: 'translateY(0)',  opacity: '0.5' },
          '30%':            { transform: 'translateY(-5px)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
