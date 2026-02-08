import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        nba: {
          blue: "#1d428a",
          red: "#c8102e",
          gold: "#fdb927",
        },
      },
    },
  },
  plugins: [],
};
export default config;
