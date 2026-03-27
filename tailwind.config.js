/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        senaiBlue: '#004587',
        senaiOrange: '#F05023',
      },
    },
  },
  plugins: [],
}