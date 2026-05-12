import type { Config } from 'tailwindcss'

export default <Config>{
  content: [],
  theme: {
    extend: {
      colors: {
        hadir: {
          teal: '#0E7C66',
          'teal-dk': '#0A5C4D',
          'teal-sft': '#E3F4EF',
          amber: '#F59E0B',
          'amber-sft': '#FEF3C7',
          red: '#E53E3E',
          'red-sft': '#FEE2E2',
          ink: '#0F1B20',
          'ink-70': '#4A5862',
          'ink-50': '#7C8893',
          line: '#E6EAEC',
          bg: '#F5F7F8'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro"',
          'system-ui',
          'sans-serif'
        ]
      },
      boxShadow: {
        'hadir-card': '0 12px 30px rgba(15,27,32,0.08)',
        'hadir-soft': '0 8px 22px rgba(15,27,32,0.05)',
        'hadir-cta': '0 8px 18px rgba(14,124,102,0.2)',
        'hadir-fab': '0 6px 16px rgba(14,124,102,0.25)'
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' }
        }
      },
      animation: {
        pulseRing: 'pulseRing 1.6s ease-out infinite'
      }
    }
  }
}
