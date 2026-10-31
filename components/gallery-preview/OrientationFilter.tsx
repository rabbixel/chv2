"use client";

import { useEffect, useState } from "react";
import type { ImageOrientation } from "@/lib/types";

const options: Array<{ value: ImageOrientation; label: string }> = [
  { value: "all", label: "All orientations" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
  { value: "square", label: "Square" },
];

function orientationFromUrl(): ImageOrientation {
  const value = new URLSearchParams(window.location.search).get("orientation");
  return options.some((option) => option.value === value) ? value as ImageOrientation : "all";
}

export function OrientationFilter({ value, className }: { value: ImageOrientation; className: string }) {
  const [selected, setSelected] = useState(value);

  useEffect(() => {
    const syncWithUrl = () => setSelected(orientationFromUrl());
    window.addEventListener("popstate", syncWithUrl);
    window.addEventListener("pageshow", syncWithUrl);
    syncWithUrl();
    return () => {
      window.removeEventListener("popstate", syncWithUrl);
      window.removeEventListener("pageshow", syncWithUrl);
    };
  }, []);

  return (
    <label className={className}>
      <span>Orientation</span>
      <select name="orientation" value={selected} onChange={(event) => setSelected(event.target.value as ImageOrientation)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
