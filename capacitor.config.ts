import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jawabify.app",
  appName: "Jawabify",
  webDir: "dist",
  server: {
    url: "https://5e82dede-1f8e-4b41-b058-02feaaf21c1a.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    scheme: "Jawabify",
  },
};

export default config;
