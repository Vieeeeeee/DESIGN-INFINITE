/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./config/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    // Enable preflight for consistent base styles
    corePlugins: {
        preflight: true,
    },
    theme: {
        extend: {
            colors: {
                // Semantic colors mapped to CSS variables
                bg: {
                    primary: 'var(--bg-primary)',
                    secondary: 'var(--bg-secondary)',
                    tertiary: 'var(--bg-tertiary)',
                    panel: 'var(--bg-panel)',
                },
                text: {
                    primary: 'var(--text-primary)',
                    secondary: 'var(--text-secondary)',
                    tertiary: 'var(--text-tertiary)',
                    muted: 'var(--text-muted)',
                },
                border: {
                    primary: 'var(--border-primary)',
                    secondary: 'var(--border-secondary)',
                    muted: 'var(--border-muted)',
                },
                accent: {
                    DEFAULT: 'var(--accent)',
                    hover: 'var(--accent-hover)',
                }
            },
            fontFamily: {
                sans: ['var(--font-sans)', 'sans-serif'],
                serif: ['var(--font-serif)', 'serif'],
                display: ['var(--font-display)', 'serif'],
                mono: ['var(--font-mono)', 'monospace'],
            }
        },
    },
    plugins: [],
}
