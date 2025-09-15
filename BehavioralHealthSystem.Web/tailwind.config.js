/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode pastel colors with good contrast
        background: {
          light: '#F8FAFC',
          dark: '#0B1220'
        },
        surface: {
          light: '#FFFFFF',
          dark: '#111827'
        },
        primary: {
          light: '#93C5FD',
          dark: '#60A5FA',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A'
        },
        secondary: {
          light: '#C7D2FE',
          dark: '#818CF8',
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81'
        },
        accent: {
          light: '#A7F3D0',
          dark: '#34D399',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B'
        },
        // Text colors ensuring contrast
        text: {
          primary: {
            light: '#1F2937',
            dark: '#F9FAFB'
          },
          secondary: {
            light: '#4B5563',
            dark: '#D1D5DB'
          },
          muted: {
            light: '#6B7280',
            dark: '#9CA3AF'
          }
        },
        // Status colors with accessibility in mind
        success: {
          light: '#065F46',
          dark: '#34D399',
          50: '#ECFDF5',
          500: '#10B981',
          700: '#047857'
        },
        warning: {
          light: '#92400E',
          dark: '#FBBF24',
          50: '#FFFBEB',
          500: '#F59E0B',
          700: '#B45309'
        },
        error: {
          light: '#991B1B',
          dark: '#F87171',
          50: '#FEF2F2',
          500: '#EF4444',
          700: '#B91C1C'
        }
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ]
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem'
      },
      minHeight: {
        '12': '3rem'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite'
      },
      animationDelay: {
        '100': '0.1s',
        '200': '0.2s',
        '300': '0.3s',
        '500': '0.5s',
        '700': '0.7s',
        '1000': '1s',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' }
        }
      }
    },
  },
  plugins: [],
}
