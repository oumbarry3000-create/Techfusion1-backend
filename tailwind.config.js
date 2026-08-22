/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        techno: {
          bg: "#0B0F14",
          panel: "#121821",
          accent: "#22D3B3",
          accent2: "#7C5CFF",
          warn: "#F5A524",
          danger: "#F31260",
        },
      },
    },
  },
  plugins: [],
};
