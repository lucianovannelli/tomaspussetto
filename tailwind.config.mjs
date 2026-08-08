/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9'
        }
      },
      boxShadow: {
        card: '0 14px 35px rgba(15, 23, 42, 0.08)'
      },
      borderRadius: {
        xl2: '1rem'
      }
    }
  },
  plugins: []
};
