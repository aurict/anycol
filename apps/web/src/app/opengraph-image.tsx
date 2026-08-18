import { ImageResponse } from "next/og";

export const alt = "Anycol — Dağınık sinyaller, net kararlar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "54px 62px",
        color: "#17202b",
        background: "#f2efe7",
        fontFamily: "serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 62,
            height: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 30,
            color: "#17202b",
            background: "#c9f04a",
            fontFamily: "monospace",
            fontSize: 15,
          }}
        >
          a/c
        </div>
        <div
          style={{ fontFamily: "sans-serif", fontSize: 32, fontWeight: 700 }}
        >
          anycol
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 86, lineHeight: 0.88, letterSpacing: -4 }}>
          Dağınık sinyaller.
        </div>
        <div
          style={{
            color: "#314ffe",
            fontSize: 86,
            lineHeight: 0.95,
            letterSpacing: -4,
            fontStyle: "italic",
          }}
        >
          Net kararlar.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "monospace",
          fontSize: 16,
        }}
      >
        <span>PAZARLAMA KARAR SİSTEMİ</span>
        <span>ANYCOL.AURICT.COM ↗</span>
      </div>
    </div>,
    size,
  );
}
