import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anycol",
    short_name: "Anycol",
    description: "Pazarlama sinyallerini tek karar yüzeyinde birleştirin.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2efe7",
    theme_color: "#17202b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
