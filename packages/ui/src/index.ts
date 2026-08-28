/**
 * Especificador importable de la hoja de tokens del design system «almanaque».
 *
 * Los tokens son CSS puro (custom properties), no JS: este paquete no aporta runtime. La constante
 * existe para que una superficie pueda referenciar la hoja sin repetir la cadena a mano; el consumo
 * habitual es un import directo en el layout (`import "@mareia/ui/tokens.css"`).
 */
export const TOKENS_CSS = "@mareia/ui/tokens.css" as const;
