/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wine: {
          50: '#fff1f3',
          100: '#ffe3e7',
          500: '#9f1239',
          600: '#881337',
          700: '#6f1230',
          900: '#3f071a'
        },
        maize: {
          100: '#fff2bd',
          300: '#ffd54d',
          400: '#f7c325',
          500: '#eab308'
        }
      },
      boxShadow: {
        soft: '0 18px 60px rgba(63, 7, 26, 0.12)'
      }
    }
  },
  plugins: []
};
