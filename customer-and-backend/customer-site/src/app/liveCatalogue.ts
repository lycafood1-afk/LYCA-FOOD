import {createContext,createElement,useContext,useEffect,useMemo,useState,type ReactNode} from 'react'
import {categories as baseline,type Category} from './data'
export type LiveIngredient={id:string;name:string;category:string;group:string;description:string;image:string;imageAlt:string;specifications:string;partner:string;status:'published';version:number;updatedAt:string|null}
type CategoryRecord={id:string;title:string;shortTitle:string;description?:string;image:string;imageAlt:string;imageCaption?:string;groups:string[]}
const endpoint=import.meta.env.VITE_CATALOGUE_API_URL?.trim()||'/api/catalogue'
export function ingredientKey(category:string,group:string,name:string){return `${category}::${group}::${name}`}
export function catalogueImage(src:string){return src.startsWith('/api/media/')?`${endpoint}${endpoint.includes('?')?'&':'?'}image=${encodeURIComponent(src.slice('/api/media/'.length))}`:src}
function useCatalogueFeed(){
  const [ingredients,setIngredients]=useState<LiveIngredient[]>([]),[records,setRecords]=useState<CategoryRecord[]>([])
  const [error,setError]=useState(''),[checkedAt,setCheckedAt]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{
    let active=true,inFlight=false,lastRevision='';const controller=new AbortController()
    async function refresh(){
      if(inFlight||!active||document.visibilityState==='hidden')return
      inFlight=true
      try{
        const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}})
        if(!response.ok)throw new Error('Catalogue connection unavailable')
        const data=await response.json()
        if(!Array.isArray(data.categories)||!Array.isArray(data.ingredients)||typeof data.revision!=='string')throw new Error('Invalid catalogue response')
        const valid=data.categories.every((c:CategoryRecord)=>typeof c.id==='string'&&typeof c.title==='string'&&typeof c.image==='string'&&Array.isArray(c.groups))
        if(!valid||data.ingredients.some((p:LiveIngredient)=>typeof p.id!=='string'||typeof p.name!=='string'||!data.categories.some((c:CategoryRecord)=>c.id===p.category)||typeof p.group!=='string'))throw new Error('Invalid catalogue response')
        if(active){
          if(data.revision!==lastRevision){setIngredients(data.ingredients.filter((p:LiveIngredient)=>p.status==='published'));setRecords(data.categories);lastRevision=data.revision}
          setCheckedAt(data.serverTime||new Date().toISOString());setError('');setLoading(false)
        }
      }catch(e){if(active&&(e as Error).name!=='AbortError'){setError('Catalogue updates are temporarily unavailable. Please try again shortly.');setLoading(false)}}
      finally{inFlight=false}
    }
    refresh();const interval=setInterval(refresh,10000)
    window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh)
    return()=>{active=false;controller.abort();clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[])
  const categories:Category[]=useMemo(()=>records.map(record=>{
    const template=baseline.find(c=>c.id===record.id)
    const groups=new Map(record.groups.map(name=>[name,[] as string[]]))
    for(const p of ingredients.filter(p=>p.category===record.id)){if(!groups.has(p.group))groups.set(p.group,[]);groups.get(p.group)!.push(p.name)}
    return {id:record.id,title:record.title,shortTitle:record.shortTitle||record.title,description:record.description||template?.description||'',image:catalogueImage(record.image),imageAlt:record.imageAlt,imageCaption:record.imageCaption||record.shortTitle,groups:[...groups].filter(([,items])=>items.length).map(([name,items])=>({name,items}))}
  }),[records,ingredients])
  const details=useMemo(()=>new Map(ingredients.map(p=>[ingredientKey(p.category,p.group,p.name),p])),[ingredients])
  return {categories,ingredients,details,error,checkedAt,loading}
}
type Feed=ReturnType<typeof useCatalogueFeed>
const CatalogueContext=createContext<Feed|null>(null)
export function LiveCatalogueProvider({children}:{children:ReactNode}){return createElement(CatalogueContext.Provider,{value:useCatalogueFeed()},children)}
export function useLiveCatalogue(){const value=useContext(CatalogueContext);if(!value)throw new Error('Catalogue provider is missing');return value}
