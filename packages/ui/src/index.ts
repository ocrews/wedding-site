/** Token names, so TS code can reference CSS variables without typos. */
export const tokens = {
  color: {
    bg: 'var(--wd-color-bg)',
    surface: 'var(--wd-color-surface)',
    text: 'var(--wd-color-text)',
    textMuted: 'var(--wd-color-text-muted)',
    accent: 'var(--wd-color-accent)',
    border: 'var(--wd-color-border)',
  },
} as const;
