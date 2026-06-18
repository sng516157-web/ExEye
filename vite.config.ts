import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Use HTTP for real G2 sideloading: npm run dev:device
// HTTPS self-signed certs often cause infinite loading in the phone WebView.
const useDeviceHttp = process.env.EXEYE_DEVICE_HTTP === "1";

export default defineConfig({
  plugins: useDeviceHttp ? [] : [basicSsl()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/analyse-frame": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/transcribe-prompt": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
