import type { Config } from "tailwindcss";

/** Telecom-red look: white surfaces, one strong red for actions, near-black text. */
const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#E40000", dark: "#B80009", soft: "#FDECEC" },
        page: "#F6F6F7",
        ink: "#1F1F1F",
        "ink-soft": "#5F6368",
        rule: "#E4E4E7",
        // kept for existing components: khata = brand red
        khata: "#E40000",
        ok: { DEFAULT: "#0A8A5A", soft: "#E7F6EF" },
        hold: { DEFAULT: "#B26A00", soft: "#FFF4E0" },
      },
      fontFamily: { sans: ["Mukta", "system-ui", "sans-serif"] },
      borderRadius: { "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: { card: "0 1px 2px rgba(16,16,16,.06), 0 4px 16px rgba(16,16,16,.05)" },
    },
  },
  plugins: [],
};
export default config;
