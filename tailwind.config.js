/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./frontend/**/*.html",
    "./frontend/public/js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        'brand-dark': '#2F2F2F',
        'brand-gray': '#3E3E3E',
      }
    },
  },
  plugins: [],
}
