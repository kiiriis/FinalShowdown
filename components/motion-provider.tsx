"use client";

import { MotionConfig } from "framer-motion";

// reducedMotion="user" makes every framer-motion animation in the tree
// respect the OS-level prefers-reduced-motion setting: transform/layout
// animations are skipped while opacity changes still apply.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
