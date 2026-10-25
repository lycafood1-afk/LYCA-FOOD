import {onFrame} from "./app/frameLoop"
import { useEffect, useRef, useState, type ReactNode } from "react"


/** Grain, vignette, cursor glow, scroll reveals and card spotlights for the whole site. Mount once. */
export function Atmosphere() {
  const glow=useRef<HTMLDivElement>(null)
  const ring=useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    root.classList.add("fx-ready")

    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target) }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    )

    const effects=new IntersectionObserver(entries=>{for(const entry of entries)(entry.target as HTMLElement).dataset.effectVisible=String(entry.isIntersecting)},{rootMargin:'100px'})
    const animated='.kinetic,.collection-panel,.industry-card,.statement-photo,.application-cinema__image,.product-category__hero,.about-story__image'
    const effectsSeen=new WeakSet<Element>()
    const observeEffects=(node:ParentNode)=>node.querySelectorAll(animated).forEach(el=>{if(!effectsSeen.has(el)){effectsSeen.add(el);effects.observe(el)}})
    observeEffects(document)
    const observed = new WeakSet<Element>()
    const watch=(el:Element)=>{
      if(observed.has(el))return
      observed.add(el)
      if(reduce)el.classList.add("is-in");else io.observe(el)
    }
    const scan=(node:ParentNode)=>node.querySelectorAll(".reveal:not(.is-in), .kinetic:not(.is-in)").forEach(watch)
    scan(document)
    const mo=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes){
        if(!(node instanceof Element))continue
        if(node.matches('.reveal,.kinetic'))watch(node)
        scan(node);observeEffects(node);if(node.matches(animated)&&!effectsSeen.has(node)){effectsSeen.add(node);effects.observe(node)}
      }

    })
    mo.observe(document.body,{childList:true,subtree:true})

    let scrollRaf=0
    const bar=document.querySelector<HTMLElement>(".fx-progress__bar")
    let scrollRange=Math.max(1,root.scrollHeight-innerHeight)
    const sizeObserver=new ResizeObserver(()=>{scrollRange=Math.max(1,root.scrollHeight-innerHeight)})
    sizeObserver.observe(document.body)
    const resize=()=>{scrollRange=Math.max(1,root.scrollHeight-innerHeight)}
    const scroll=()=>{
      if(scrollRaf)return
      scrollRaf=requestAnimationFrame(()=>{scrollRaf=0;if(bar)bar.style.transform=`scaleX(${scrollY/scrollRange})`})
    }
    window.addEventListener('resize',resize,{passive:true})
    window.addEventListener('scroll',scroll,{passive:true});scroll()


    return () => {
      io.disconnect();effects.disconnect();sizeObserver.disconnect();window.removeEventListener("resize",resize); mo.disconnect();cancelAnimationFrame(scrollRaf);window.removeEventListener("scroll",scroll);root.classList.remove("has-cursor-fx");root.style.removeProperty("--scroll-velocity")
      root.classList.remove("fx-ready")
    }
  }, [])

  return <>
    <div className="fx-progress" aria-hidden="true"><div className="fx-progress__bar"/></div>
    <div className="fx-cursor-glow" ref={glow} aria-hidden="true"/>
    <div className="fx-cursor-ring" ref={ring} aria-hidden="true"/>
    <div className="fx-vignette" aria-hidden="true" />
  </>
}

/** Splits a line into words that rise in sequence when scrolled into view. */
export function Kinetic({ text, accent, as: Tag = "h2", className = "" }:
  { text: string; accent?: string; as?: "h1" | "h2" | "h3"; className?: string }) {
  let i = 0
  const words = (line: string, isAccent = false) => line.split(" ").map(w =>
    <span className="kinetic__mask" key={`${w}-${i}`}>
      <span className={`kinetic__word${isAccent ? " is-accent is-gradient" : ""}`} style={{ ["--i" as string]: i++ }}>{w}&nbsp;</span>
    </span>)
  return <Tag className={`kinetic ${className}`} aria-label={accent ? `${text} ${accent}` : text}>
    <span aria-hidden="true">{words(text)}{accent && <><br />{words(accent, true)}</>}</span>
  </Tag>
}

/** Automatic ingredient ticker; pauses offscreen to save rendering work. */
export function Marquee({ items, reverse = false, speed=40 }: { items: string[]; reverse?: boolean; speed?:number }) {
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const el=ref.current;if(!el)return
    const io=new IntersectionObserver(([entry])=>{el.dataset.offscreen=String(!entry.isIntersecting)},{rootMargin:'80px'})
    io.observe(el)
    let down=false,dragging=false,startX=0,startY=0,offset=0,base=0
    const pointerDown=(e:PointerEvent)=>{if(e.button!==0)return;down=true;dragging=false;startX=e.clientX;startY=e.clientY;base=offset}
    const pointerMove=(e:PointerEvent)=>{
      if(!down)return
      const dx=e.clientX-startX,dy=e.clientY-startY
      if(!dragging&&Math.abs(dy)>Math.abs(dx)+8){down=false;return}
      if(!dragging&&Math.abs(dx)>8){dragging=true;el.classList.add('is-dragging');el.setPointerCapture(e.pointerId)}
      if(dragging){offset=base+dx;el.style.setProperty('--drag-x',`${offset}px`)}
    }
    const pointerUp=()=>{down=false;dragging=false;el.classList.remove('is-dragging')}
    el.addEventListener('pointerdown',pointerDown);window.addEventListener('pointermove',pointerMove,{passive:true});window.addEventListener('pointerup',pointerUp);el.addEventListener('pointercancel',pointerUp)
    return()=>{io.disconnect();el.removeEventListener('pointerdown',pointerDown);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',pointerUp);el.removeEventListener('pointercancel',pointerUp)}
  },[])
  const row = items.map((t, n) => <span key={n} className="marquee__item">{t}<i aria-hidden="true">✦</i></span>)
  return <div ref={ref} style={{["--marquee-speed" as string]:`${speed}s`}} className={`marquee${reverse ? " marquee--reverse" : ""}`} aria-label={items.join(", ")}>
    <div className="marquee__track" aria-hidden="true">{row}{row}{row}</div>
    <i className="marquee__fade marquee__fade--l" aria-hidden="true"/><i className="marquee__fade marquee__fade--r" aria-hidden="true"/>
  </div>
}

/** Counts up to a number once visible. */
export function CountUp({ to, pad = 2, label }: { to: number; pad?: number; label: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [n, setN] = useState(0)
  const [done,setDone]=useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to);setDone(true); return }
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now(), dur = 1600
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur)
        setN(Math.round(to * (1 - Math.pow(1 - p, 4))))
        if (p < 1) raf = requestAnimationFrame(tick);else setDone(true)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => {io.disconnect();cancelAnimationFrame(raf)}
  }, [to])
  return <div className={`stat stat--count${done?" is-done":""}`} ref={ref}>
    <i className="stat__glow" aria-hidden="true"/>
    <strong aria-label={String(to)}>{String(n).padStart(pad, "0")}</strong><span>{label}</span>
  </div>
}
