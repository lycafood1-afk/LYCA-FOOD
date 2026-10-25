import { useEffect, useLayoutEffect, type ReactNode } from "react"
import { motion, useScroll, useSpring, useReducedMotion } from "motion/react"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const positions = new Map<string, number>()
/** Browser-native wheel and touch scrolling; GSAP tracks actual scroll position. */
export function SmoothScrolling() {
  useEffect(()=>{
    const update=()=>ScrollTrigger.update()
    window.addEventListener("scroll",update,{passive:true})
    return()=>window.removeEventListener("scroll",update)
  },[])
  return null
}
export function glideTo(top:number){
  window.scrollTo({top,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"})
}
export function jumpTo(top:number){window.scrollTo({top,behavior:"instant"})}
export function PageScene({ children, routeKey, hash, path, navigation }: {children:ReactNode;routeKey:string;hash:string;path:string;navigation:string}) {
  const reduce=useReducedMotion()
  useLayoutEffect(()=>{
    const previous=history.scrollRestoration;history.scrollRestoration="manual"
    let raf=0
    const restore=()=>{
      let target=navigation==="POP" ? positions.get(routeKey)||0 : 0
      if(hash){let id=hash.slice(1);try{id=decodeURIComponent(id)}catch{};const el=document.getElementById(id);if(el)target=el.getBoundingClientRect().top+scrollY-(parseFloat(getComputedStyle(el).scrollMarginTop)||130)}
      jumpTo(Math.max(0,target))
    }
    restore();raf=requestAnimationFrame(restore)
    const save=()=>positions.set(routeKey,scrollY)
    window.addEventListener("scroll",save,{passive:true})
    return()=>{save();window.removeEventListener("scroll",save);cancelAnimationFrame(raf);history.scrollRestoration=previous}
  },[routeKey,hash,navigation])
  return <motion.main id="main-content" className="route-surface" data-route={path} tabIndex={-1}
    initial={reduce?false:{opacity:0}}
    animate={{opacity:1}}
    exit={reduce?{opacity:1}:{opacity:0,transition:{duration:.16,ease:"easeIn"}}}
    transition={{duration:reduce?0:.3,ease:[.16,1,.3,1]}}
    onAnimationComplete={()=>{const main=document.getElementById("main-content");if(main&&Number(main.style.opacity)===1){main.style.filter="none";main.style.clipPath="none";main.style.removeProperty("transform");if(routeKey!=="default"&&navigation!=="POP")main.focus({preventScroll:true})}}}
  >{children}</motion.main>
}
export function ScrollProgress(){
  const {scrollYProgress}=useScroll();const scale=useSpring(scrollYProgress,{stiffness:160,damping:30});const reduce=useReducedMotion()
  return <div className="scroll-progress" aria-hidden="true"><motion.div style={{scaleX:reduce?scrollYProgress:scale}}/></div>
}
