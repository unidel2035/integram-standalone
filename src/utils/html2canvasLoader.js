/**
 * Safe html2canvas loader — handles CJS/ESM interop for Vite 8 (Rolldown)
 *
 * html2canvas 1.4.1 exports UMD which Vite 8 may not auto-interop as default.
 * This loader handles both `module.default` and `module` as fallback.
 */
export async function loadHtml2Canvas() {
  const mod = await import('html2canvas')
  return mod.default || mod
}
