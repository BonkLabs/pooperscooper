/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bonk-orange": "#ff5a01",
        "bonk-yellow": "#ffd502",
        "bonk-white": "#FDFFF7",
        "bonk-blue": "#0f345b",
        "bonk-light-blue": "#29609b",
        "bonk-gray": "#50514f",
        "bonk-green": "#2dc48d",
        "bonk-red": {
          50: "#FFF5F5",
          100: "#FED7D7",
          200: "#FEB2B2",
          300: "#FC8181",
          400: "#F56565",
          500: "#E53E3E",
          600: "#C53030",
          700: "#9B2C2C",
          800: "#822727",
          900: "#63171B",
        },
      },
    },
  },
  plugins: [],
};
