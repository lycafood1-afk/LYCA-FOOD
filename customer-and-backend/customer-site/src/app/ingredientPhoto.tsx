import type { ImgHTMLAttributes } from "react"

/** Every source is bundled locally. Smaller viewports receive smaller photographs. */
export function photoSources(src: string) {
  if (!src.startsWith('/images/') || !src.endsWith('.webp')) return undefined
  if (src.includes("/landing/")) return `${src.replace(/\.webp$/, "-480.webp")} 480w, ${src} 960w`
  return `${src.replace(/\.webp$/, "-480.webp")} 480w, ${src.replace(/\.webp$/, "-800.webp")} 800w, ${src} 1440w`
}
export function IngredientPhoto({ src = "", alt = "", sizes = "(max-width: 700px) 90vw, (max-width: 1100px) 60vw, 50vw", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img src={src} srcSet={photoSources(src)} sizes={sizes} alt={alt} decoding="async" {...props} />
}
