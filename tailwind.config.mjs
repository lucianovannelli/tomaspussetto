/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        espresso: '#26160d',
        cream: '#f5f0e8',
        charcoal: '#1c1a17',
        brand: {
          50: '#faf7f2',
          100: '#f5f0e8',
          200: '#e6dfd5',
          300: '#d5c7b5',
          400: '#8c7a6b',
          500: '#5e4e43',
          600: '#3d2b20',
          700: '#26160d',
          800: '#1c1a17',
          900: '#12100e'
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
