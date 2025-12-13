/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                // Semantic Application Colors
                app: {
                    surface: '#ffffff',
                    bg: '#f9fafb', // gray-50
                    border: '#e5e7eb', // gray-200
                },
                // Urgency Colors (Strict Palette)
                urgency: {
                    critical: { bg: '#fff1f2', text: '#be123c', border: '#ffe4e6' }, // rose-50/700/100
                    high: { bg: '#fff7ed', text: '#c2410c', border: '#ffedd5' }, // orange-50/700/100
                    medium: { bg: '#fefce8', text: '#a16207', border: '#fef9c3' }, // yellow-50/700/100
                    low: { bg: '#f9fafb', text: '#4b5563', border: '#f3f4f6' }, // gray-50/600/100
                }
            }
        },
    },
    plugins: [],
}
