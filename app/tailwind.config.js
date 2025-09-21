/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cores principais da paleta oficial - NOVA COR VERDE
        primary: '#E1FFD9',
        'primary-dark': '#C8E6C0',
        'primary-light': '#F0FFF0',
        
        // Cores de texto e fundo - Dark theme
        text: '#FFFFFF',
        background: '#505050',
        border: 'rgba(255, 255, 255, 0.2)',
        
        // Cores específicas para o dark theme
        'dark-background': '#505050',
        'dark-border': 'rgba(255, 255, 255, 0.1)',
        'dark-text': '#FFFFFF',
        'dark-card': 'rgba(255, 255, 255, 0.1)',
        
        // Cores adicionais
        success: '#E1FFD9',
        warning: '#FFA500',
        error: '#FF4444',
        info: '#007ACC',
        
        // Cores específicas para trades
        win: '#E1FFD9',
        loss: '#FF4444',
        neutral: '#B3B3B3',
      },
      fontFamily: {
        'etna': ['Etna', 'serif'],
        'poly': ['Poly', 'serif'],
        'montaga': ['Montaga', 'serif'],
        'comfortaa': ['var(--font-comfortaa)', 'Comfortaa', 'sans-serif'],
        'comfortaa-light': ['var(--font-comfortaa)', 'Comfortaa', 'sans-serif'],
        sans: ['var(--font-comfortaa)', 'Comfortaa', 'sans-serif'],
        heading: ['Poly', 'serif'],
        body: ['var(--font-comfortaa)', 'Comfortaa', 'sans-serif'],
      },
      fontSize: {
        'xs': ['12px', '1.5'],
        'sm': ['14px', '1.5'],
        'base': ['16px', '1.5'],
        'lg': ['20px', '1.5'],
        'xl': ['24px', '1.5'],
        '2xl': ['30px', '1.2'],
        '3xl': ['36px', '1.2'],
        '4xl': ['48px', '1.1'],
        '5xl': ['64px', '1.1'],
        '6xl': ['80px', '1.1'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '15px': '15px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(225, 255, 217, 0.3)',
        'glow-lg': '0 0 40px rgba(225, 255, 217, 0.4)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-in-out',
        'slide-out-right': 'slideOutRight 0.4s ease-in-out',
        'scale-in': 'scaleIn 0.3s ease-in-out',
        'scale-out': 'scaleOut 0.3s ease-in-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      transitionProperty: {
        'width': 'width',
        'spacing': 'margin, padding',
        'transform-opacity': 'transform, opacity',
      },
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
} 