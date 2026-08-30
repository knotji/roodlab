import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RoodLab — วิเคราะห์สถิติหวยย้อนหลัง",
    short_name: "RoodLab",
    description: "สำรวจสัญญาณตัวเลขและชุดวินจากข้อมูลหวยย้อนหลังอย่างโปร่งใส",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f2ec",
    theme_color: "#18211f",
    lang: "th",
    categories: ["utilities", "education"],
    icons: [
      { src: "/icons/roodlab-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/roodlab-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/roodlab-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
