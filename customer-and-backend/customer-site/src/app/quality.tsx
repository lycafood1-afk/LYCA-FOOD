import { useEffect } from "react"

/** Default to a modest GPU budget. Measure real display frames once after load. */
export function RuntimeQuality(){
 useEffect(()=>{
  const root=document.documentElement
  const device=navigator as Navigator & {deviceMemory?:number;connection?:{saveData?:boolean}}
  const balance=()=>{if(root.dataset.fxDetail==='balanced')return;root.dataset.fxDetail='balanced';window.dispatchEvent(new Event('lyca:quality'))}
  root.dataset.fxDetail='full'
  if(matchMedia('(pointer:coarse)').matches||device.hardwareConcurrency<=4||(device.deviceMemory!==undefined&&device.deviceMemory<=4)||device.connection?.saveData)balance()
  let raf=0,timer=0,last=0,start=0,slow=0,count=0
  const sample=(now:number)=>{
   if(document.hidden)return
   if(!start)start=now
   if(last){count++;if(now-last>25)slow++}last=now
   if(now-start<1200)raf=requestAnimationFrame(sample)
   else if(count&&slow/count>.25)balance()
  }
  timer=window.setTimeout(()=>{raf=requestAnimationFrame(sample)},2000)
  return()=>{clearTimeout(timer);cancelAnimationFrame(raf)}
 },[])
 return null
}
