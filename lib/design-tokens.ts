/**
 * TypeScript mirror of the design tokens in `styles/tokens.css`.
 * Use these for JS-driven responsive behaviour (e.g. matchMedia) so values
 * stay in sync with CSS. Prefer CSS for everything else.
 */

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof breakpoints;

export const containers = {
  sm: 680,
  md: 960,
  lg: 1200,
  xl: 1360,
} as const;

export type ContainerSize = keyof typeof containers;

/** Build a min-width media query string, e.g. `mediaMin("md")`. */
export function mediaMin(breakpoint: Breakpoint): string {
  return `(min-width: ${breakpoints[breakpoint]}px)`;
}
