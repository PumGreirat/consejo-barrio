/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        serif: ['Lora', 'serif'],
      },
      colors: {
        navy: { DEFAULT: '#1c2b4a', light: '#243660' },
        gold: { DEFAULT: '#b8822a', light: '#d4a044' },
        cream: { DEFAULT: '#f6f2eb', dark: '#ede8de' },
      },
    },
  },
  plugins: [],
}
