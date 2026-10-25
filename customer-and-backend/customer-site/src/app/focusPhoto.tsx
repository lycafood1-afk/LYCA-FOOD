import { IngredientPhoto } from "./ingredientPhoto"
/** Rack focus blends pre-rendered image layers. No client-side blur or canvas baking. */
export function FocusPhoto({src,alt,first=false}:{src:string;alt:string;first?:boolean}){
 const soft=src.replace('/images/','/images/focus/')
 return <div className="film-photo"><IngredientPhoto sizes="(max-width: 700px) 170vw, 75vw" className="film-photo__sharp" src={src} alt={alt} decoding="async" loading={first?'eager':'lazy'} fetchPriority={first?'high':'low'}/><img className="film-photo__soft" src={soft} alt="" aria-hidden="true" decoding="async" loading={first?'eager':'lazy'}/></div>
}
