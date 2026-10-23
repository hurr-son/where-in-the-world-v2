import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/, not from the domain root.
  base: '/where-in-the-world-v2/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
