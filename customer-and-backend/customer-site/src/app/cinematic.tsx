import { useEffect, useLayoutEffect, useRef, useState, useId } from "react"
import { Link } from "react-router"
import { ArrowDown, ArrowUpRight, ArrowLeft, ArrowRight } from "lucide-react"
import logo from "../assets/lyca-logo.png"
import { landingStories } from "./landingData"
import { IngredientPhoto } from "./ingredientPhoto"
import { glideTo } from "./motion"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
gsap.registerPlugin(ScrollTrigger)

export function useReducedMotion(){
 const [reduce,setReduce]=useState(()=>typeof window!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches)
 useEffect(()=>{const query=matchMedia("(prefers-reduced-motion: reduce)");const update=()=>setReduce(query.matches);query.addEventListener("change",update);update();return()=>query.removeEventListener("change",update)},[])
 return reduce
}

/** The supplied logo is rendered intact; a colour matrix removes its paper backdrop. */
export function LogoMark({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "")
  return <svg className={`logo-mark ${className}`} viewBox="0 0 160 160" role="img" aria-label="LYCA Food Ingredients Supplies logo">
    <defs><filter id={id} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .831  0 0 0 0 1  0 0 0 0 .302  -.72 -.72 -.72 0 2.16" /><feComposite in2="SourceAlpha" operator="in" /></filter></defs>
    <image href={logo} width="160" height="160" filter={`url(#${id})`} />
  </svg>
}

/** CSS atmosphere is independent of canvas buffers, scroll and device quality changes. */
export function AuroraWorld(){
 const ref=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  const visibility=()=>{if(ref.current)ref.current.dataset.paused=String(document.hidden)}
  document.addEventListener('visibilitychange',visibility);visibility()
  return()=>document.removeEventListener('visibilitychange',visibility)
 },[])
 return <div ref={ref} className="site-atmosphere" aria-hidden="true"><i className="aurora-ribbon aurora-ribbon--one"/><i className="aurora-ribbon aurora-ribbon--two"/><i className="aurora-ribbon aurora-ribbon--three"/></div>
}

export function Letterbox(){
 const reduce=useReducedMotion()
 const [stage,setStage]=useState<'title'|'open'|'done'>(()=>{try{return sessionStorage.getItem('lyca:opened')?'done':'title'}catch{return 'title'}})
 const opening=useRef(stage!=='done')
 useEffect(()=>{
  if(!opening.current)return
  if(reduce){setStage('done');return}
  const root=document.documentElement;root.classList.add('is-cold-open')
  const a=setTimeout(()=>{setStage('open');root.classList.remove('is-cold-open')},700)
  const b=setTimeout(()=>{setStage('done');opening.current=false;try{sessionStorage.setItem('lyca:opened','1')}catch{};root.classList.remove('is-cold-open')},1700)
  return()=>{clearTimeout(a);clearTimeout(b);root.classList.remove('is-cold-open')}
 },[reduce])
 useEffect(()=>{
  let timer=0
  const bars=()=>{if(reduce)return;document.documentElement.classList.add('is-cutting');clearTimeout(timer);timer=window.setTimeout(()=>document.documentElement.classList.remove('is-cutting'),1100)}
  window.addEventListener('lyca:transition',bars)
  return()=>{clearTimeout(timer);window.removeEventListener('lyca:transition',bars);document.documentElement.classList.remove('is-cutting')}
 },[reduce])
 return <><div className="transition-lens" aria-hidden="true"/><div className="film-bars" aria-hidden="true"><i/><i/></div>{stage!=='done'&&!reduce&&<div className={`title-card ${stage==='open'?'is-opening':''}`} aria-hidden="true"><div className="title-card__mark"><LogoMark/></div><div className="title-card__name"><span>L</span><span>Y</span><span>C</span><span>A</span><b>.</b></div><p>FOOD INGREDIENTS SUPPLIES · A WORLD OF INGREDIENTS</p><i className="title-card__line"/></div>}</>
}

export function InwardHero() {
 const ref=useRef<HTMLElement>(null)
 const trigger=useRef<ScrollTrigger | null>(null)
 const [active,setActive]=useState(0)
 const activeRef=useRef(0)
 const reduce=useReducedMotion()
 useEffect(()=>{
  const queue=Array.from(ref.current?.querySelectorAll<HTMLImageElement>('.journey-card>img')||[])
  let cancelled=false,idle=0
  let timer:ReturnType<typeof setTimeout>|undefined
  const warm=()=>{const photo=queue.shift();if(cancelled||!photo)return;photo.loading='eager';void photo.decode().catch(()=>{}).finally(()=>{if(!cancelled)schedule()})}
  const schedule=()=>{if('requestIdleCallback' in window)idle=window.requestIdleCallback(warm,{timeout:1500});else timer=globalThis.setTimeout(warm,100)}
  schedule()
  return()=>{cancelled=true;if(idle)window.cancelIdleCallback(idle);clearTimeout(timer)}
 },[])
 useLayoutEffect(()=>{
  const root=ref.current;if(!root||reduce)return
  const cards=Array.from(root.querySelectorAll<HTMLElement>('.journey-card'))
  const copies=Array.from(root.querySelectorAll<HTMLElement>('.journey-copy'))
  const progress=root.querySelector<HTMLElement>('.journey-progress i')
  const state={frame:0}
  const draw=()=>{
   const frame=Math.max(0,Math.min(landingStories.length-1,state.frame))
   cards.forEach((card,i)=>{
    const d=i-frame,distance=Math.abs(d),visible=distance<1
    card.style.visibility=visible?'visible':'hidden'
    card.style.willChange=visible?'transform,opacity':'auto'
    card.style.opacity=String(Math.max(0,1-distance))
    card.style.transform=`translate3d(${d*66}px,${distance*12}px,0) rotate(${d*2.5}deg) scale(${1-Math.min(distance,1)*.075})`
    card.style.zIndex=String(i+1)
   })
   copies.forEach((copy,i)=>{const selected=i===Math.round(frame);copy.style.opacity=selected?'1':'0';copy.style.visibility=selected?'visible':'hidden'})
   if(progress)progress.style.transform=`scaleX(${frame/(landingStories.length-1)})`
   const index=Math.round(frame)
   if(activeRef.current!==index){activeRef.current=index;setActive(index)}
  }
  const ctx=gsap.context(()=>{
   const tween=gsap.to(state,{frame:landingStories.length-1,ease:'none',onUpdate:draw,scrollTrigger:{trigger:root,start:'top top',end:'bottom bottom',scrub:.4,invalidateOnRefresh:true,onRefresh:draw}})
   trigger.current=tween.scrollTrigger||null
  },root)
  draw()
  return()=>{trigger.current=null;ctx.revert();[...cards,...copies].forEach(el=>el.removeAttribute('style'));progress?.removeAttribute('style')}
 },[reduce])
 const go=(index:number)=>{
  const st=trigger.current;if(!st)return
  glideTo(st.start+(st.end-st.start)*Math.max(0,Math.min(landingStories.length-1,index))/(landingStories.length-1))
 }
 return <section ref={ref} className={`lyca-hero ${reduce?'lyca-hero--static':''}`} aria-label="Ingredient inspiration journey">
  <div className="journey-stage">
   <div className="journey-kicker"><span><i/>LYCA / FOOD INGREDIENTS SUPPLIES</span><span>GLOBAL INGREDIENTS. INDIVIDUAL POSSIBILITIES.</span></div>
   <div className="journey-heading"><p className="eyebrow">THE INGREDIENTS OF POSSIBILITY</p><h1>Great taste<br/>starts <em>within.</em></h1><p>From nature’s richness<br/>to your signature taste.</p></div>
   <div className="journey-gallery">{landingStories.map((story,i)=><article className="journey-card" key={story.tag} aria-hidden={!reduce&&active!==i} inert={!reduce&&active!==i}>
    <IngredientPhoto src={story.image} alt={story.alt} loading={i<2?'eager':'lazy'} fetchPriority={i===0?'high':'low'} sizes="(max-width: 700px) 86vw, 40vw" />
    <span className="journey-image-shade"/>
    {reduce&&<div className="journey-caption"><p>0{i+1} / {story.tag}</p><h2>{story.title}</h2><Link className="liquid-control" to={story.to} aria-label={`Explore ${story.name}`}><ArrowUpRight size={22}/></Link></div>}
   </article>)}{!reduce&&<div className="journey-caption journey-caption--fixed"><div key={active} className="journey-caption-copy"><p>0{active+1} / {landingStories[active].tag}</p><h2>{landingStories[active].title}</h2></div><Link className="liquid-control" to={landingStories[active].to} aria-label={`Explore ${landingStories[active].name}`}><ArrowUpRight size={22}/></Link></div>}</div>
   <div className="journey-details">{landingStories.map((story,i)=><div className="journey-copy" key={story.tag} aria-hidden={!reduce&&active!==i}><p className="eyebrow">{story.tag}</p><p>{story.detail}</p></div>)}<Link className="button button--primary journey-cta" to="/products">Explore ingredients <ArrowUpRight size={17}/></Link></div>
   {!reduce&&<div className="journey-controls"><button className="journey-scroll" onClick={()=>active<landingStories.length-1?go(active+1):document.getElementById('discover')?.scrollIntoView({behavior:'smooth'})}>SCROLL TO DISCOVER <ArrowDown size={15}/></button><div className="journey-pagination"><button className="liquid-control" disabled={active===0} onClick={()=>go(active-1)} aria-label="Previous ingredient"><ArrowLeft size={18}/></button><span>0{active+1}<small> / 06</small></span><button className="liquid-control" disabled={active===landingStories.length-1} onClick={()=>go(active+1)} aria-label="Next ingredient"><ArrowRight size={18}/></button></div><div className="journey-progress"><i/></div></div>}
  </div>
 </section>
}
