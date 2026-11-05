import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e8f4f1",
          100: "#c9e6df",
          500: "#0f7a6b",
          600: "#0b6b5d",
          700: "#085a4e",
          800: "#064a41",
          900: "#04332d",
        },
        gold: { 400: "#f3c04c", 500: "#e8a91f", 600: "#d4930f" },
        surface: "#f6f8f9",
      },
      boxShadow: { card: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)" },
    },
  },
  plugins: [],
};
export default config;
