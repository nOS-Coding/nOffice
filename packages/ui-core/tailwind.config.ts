import type { Config } from "tailwindcss";
import config from "@noffice/configs/tailwind";

const localConfig: Config = {
  ...config,
  content: ["./src/**/*.{ts,tsx}"],
};

export default localConfig;
