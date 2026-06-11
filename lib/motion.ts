// Shared motion tokens so every animation in the app speaks the same
// language: fast micro-interactions, expo-out entrances, snappy springs.
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

export const SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 30,
} as const;

export const fadeInUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

export const staggerChildren = (stagger = 0.05) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});
