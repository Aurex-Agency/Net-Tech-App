import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_APP_NAME || "Net-Tech Connect",
    short_name: "Net-Tech",
    description: "Your Net-Tech team, connected.",
    start_url: "/workspace",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#0067d8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
