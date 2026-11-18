/**
 * Joins class names, skipping falsy values. There is no tailwind-merge here, so a
 * `className` passed to a ui component should only add layout (margin, width, flex),
 * not fight the component's own height/colour classes.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
