import gsap from "gsap"
/** One clock; uncapped UI work follows the display, optional rates keep their phase. */
export function onFrame(update:(time:number)=>void,fps?:number){
 let last:number|undefined
 const interval=fps?1000/fps:0
 const tick=()=>{
  const now=performance.now()
  if(document.hidden){last=undefined;return}
  if(!interval){update(now);return}
  if(last===undefined){last=now;update(now);return}
  const elapsed=now-last
  if(elapsed<interval-.5)return
  last+=Math.max(1,Math.floor((elapsed+.5)/interval))*interval
  update(now)
 }
 gsap.ticker.add(tick)
 return()=>gsap.ticker.remove(tick)
}
