/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Essencial para o modo claro/escuro funcionar via classe
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}