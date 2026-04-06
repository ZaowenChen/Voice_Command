/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cobotiq: {
          blue: '#2563EB',
          dark: '#1a1d2b',
        },
      },
    },
  },
  plugins: [],
};
