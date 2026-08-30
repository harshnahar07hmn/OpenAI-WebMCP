/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f1a",
        surface: "#111827",
        panel: "#1a2233",
        accent: "#7c9cff",
        good: "#4ade80",
        warn: "#facc15",
        bad: "#f87171",
      },
    },
  },
  plugins: [],
};
