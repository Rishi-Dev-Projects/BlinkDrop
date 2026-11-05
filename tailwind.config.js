/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          base: '#080C14',
          void: '#0D1322',
          raised: '#141D32',
          border: '#1E2C4A',
          highlight: '#2A3F6C',
        },
        signal: {
          cyan: '#06B6D4',
          'cyan-bright': '#22D3EE',
          violet: '#8B5CF6',
          'violet-bright': '#A78BFA',
        },
        status: {
          direct: '#10B981',
          relay: '#F59E0B',
          alert: '#F43F5E',
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}

