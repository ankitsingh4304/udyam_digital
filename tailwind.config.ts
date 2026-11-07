import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#F5F7FA",
        ink: "#1B2A4A",
        "ink-soft": "#53617D",
        rule: "#D9DEE7",
        khata: "#C8102E",
        ok: "#0F7B5F",
        hold: "#A15C00",
      },
      fontFamily: { sans: ["Mukta", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
