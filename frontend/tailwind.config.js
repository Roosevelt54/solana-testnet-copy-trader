/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#050812',
        card: '#0d1117',
        border: '#21262d',
        muted: '#8b949e',
      }
    }
  },
  plugins: []
};
