"use client";

import { useEffect, useRef, useState } from "react";

type Size = { width: number; height: number };

export default function StepConnector() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [path, setPath] = useState("");

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const grid = svg.parentElement;
    if (!grid) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const gridRect = grid.getBoundingClientRect();
      const badges = Array.from(grid.querySelectorAll<HTMLElement>("[data-step-badge]"));
      const cards = Array.from(grid.querySelectorAll<HTMLElement>(".lp-step-card"));
      const points = badges.map((badge) => {
        const rect = badge.getBoundingClientRect();
        return {
          x: rect.left - gridRect.left + rect.width / 2,
          y: rect.top - gridRect.top + rect.height / 2,
        };
      });

      if (points.length < 2) return;

      const width = gridRect.width;
      const railLeft = 8;
      const railRight = Math.max(railLeft, width - 6);

      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i += 1) {
        const from = points[i - 1];
        const to = points[i];
        const fromCard = cards[i - 1]?.getBoundingClientRect();
        const toCard = cards[i]?.getBoundingClientRect();

        let gapY: number | null = null;
        if (fromCard && toCard) {
          if (toCard.top >= fromCard.bottom) {
            gapY = (fromCard.bottom + toCard.top) / 2 - gridRect.top;
          } else if (fromCard.top >= toCard.bottom) {
            gapY = (fromCard.top + toCard.bottom) / 2 - gridRect.top;
          }
        }

        if (gapY === null) {
          d += ` H ${to.x}`;
        } else if (from.x <= to.x) {
          d += ` H ${railLeft} V ${gapY} H ${to.x} V ${to.y}`;
        } else {
          d += ` H ${railRight} V ${gapY} H ${to.x} V ${to.y}`;
        }
      }

      setSize({
        width: Math.round(width),
        height: Math.round(gridRect.height),
      });
      setPath(d);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    window.addEventListener("resize", schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const viewBox =
    size.width && size.height ? `0 0 ${size.width} ${size.height}` : undefined;

  return (
    <svg
      ref={svgRef}
      className="hiw-step-connector"
      width={size.width || undefined}
      height={size.height || undefined}
      viewBox={viewBox}
      aria-hidden="true"
      focusable="false"
    >
      {path ? <path d={path} /> : null}
    </svg>
  );
}
