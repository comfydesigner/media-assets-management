/**
 * Shared "ghost" action-button styling — the header Select-all look: transparent
 * by default, fills with `secondary-background` on hover. Used by Select all, the
 * tag match-all/any toggle, and Clear filters so they read as one button family.
 * (Disabled styles only bite when a `disabled` attr is present, e.g. Select all.)
 */
export const ghostButtonClass =
  'flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm leading-normal text-base-foreground transition-colors enabled:hover:bg-secondary-background disabled:cursor-not-allowed disabled:opacity-40'
