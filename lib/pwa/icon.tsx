import { ImageResponse } from "next/og";

const INK = "#1c1b19";
const PAPER = "#faf9f5";

/** The receipt slip from <BrandMark>, as standalone SVG with fixed colours. */
function markSvg(withBackground: boolean) {
  const bg = withBackground ? `<rect width="32" height="32" rx="8" fill="${INK}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${bg}<path d="M9 7h14v17l-2.33-1.75L18.33 24 16 22.25 13.67 24l-2.34-1.75L9 24z" fill="${PAPER}"/><path d="M12 12h8M12 15.5h8M12 19h5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

/**
 * App icon PNG. `maskable` draws the slip inside the 80% safe zone on a
 * full-bleed ink background, so Android can crop it to any shape.
 */
export function renderIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  const inner = maskable ? Math.round(size * 0.8) : size;
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(markSvg(!maskable))}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? INK : "transparent",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={inner} height={inner} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
