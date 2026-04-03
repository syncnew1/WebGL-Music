/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:      'var(--bg)',
        surface: 'var(--surface)',
        text:    'var(--text)',
        muted:   'var(--text-muted)',
        accent:  'var(--accent)',
        rose:    'var(--rose)',
        borderc: 'var(--border)',
      },
      fontFamily: {
        display: ['Righteous', 'sans-serif'],
        body:    ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
