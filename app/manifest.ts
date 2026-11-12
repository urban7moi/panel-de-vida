import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Panel de Vida",
    short_name: "Panel",
    description: "Tu día y tu entreno en un solo sitio.",
    start_url: "/",
    display: "standalone",
    background_color: "#262624",
    theme_color: "#262624",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
