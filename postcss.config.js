// Пустой PostCSS-конфиг: Tailwind подключён через @tailwindcss/vite.
// Нужен, чтобы Vite не искал конфиг выше по дереву (там лежит чужой package.json с BOM).
export default { plugins: {} }
