"use client";

import { useEffect, useState } from "react";

const steps = [
  { id: "step-1", label: "Create your profile" },
  { id: "step-2", label: "Share your academics" },
  { id: "step-3", label: "Set your preferences" },
  { id: "step-4", label: "Match by clear rules" },
  { id: "step-5", label: "See your ranked shortlist" },
  { id: "step-6", label: "Take action" },
];

export default function HiwNav() {
  const [active, setActive] = useState("step-1");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-42% 0px -52% 0px" },
    );
    for (const { id } of steps) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="hiw-rail" aria-label="Steps">
      {steps.map(({ id, label }, index) => (
        <a
          key={id}
          href={`#${id}`}
          className={active === id ? "active" : ""}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}