/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F5F5F8",
        surface: "#FFFFFF",
        "surface-hover": "#EEF0F5",
        "surface-active": "#E4E7EF",
        border: "#D0D3DE",
        "border-subtle": "#E4E7EF",
        text: "#1A1A2E",
        "text-secondary": "#5C5E75",
        "text-muted": "#9090A8",
        accent: "#7B7FEB",
        "accent-hover": "#9499F5",
        success: "#22C55E",
        danger: "#EF4444",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["SF Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
