/** Used only to (re)build static/css/tailwind.css — see README ("Editing the design"). */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        carbon: { DEFAULT: "#121212", 950: "#0A0A0B", 900: "#121212", 800: "#1A1A1C", 700: "#232326", 600: "#2E2E32" },
        crimson: { DEFAULT: "#E50914", bright: "#FF0033", dark: "#A5060F" },
        silver: { DEFAULT: "#D1D5DB", bright: "#F3F4F6", dim: "#9CA3AF" },
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
