/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./popup.html",
    "./niche_commander.html",
    "./modules/**/*.html",
    "./modules/**/*.js",
    "./niche_commander_script.js",
    "./popup.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6C63FF",
        "primary-dark": "#4F46E5",
        surface: "#13112A",
        "surface-light": "#1C1A35",
      },
    },
  },
  plugins: [],
}
