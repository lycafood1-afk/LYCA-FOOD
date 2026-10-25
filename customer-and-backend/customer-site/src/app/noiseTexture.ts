let pixels:Uint8Array|undefined
/** Bake seamless five-octave fog once; the GPU only samples the cached texture. */
export function noisePixels(){
 if(pixels)return pixels
 const size=128,grid=new Float32Array(64*64);let seed=58371
 for(let i=0;i<grid.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;grid[i]=(seed>>>0)/4294967295}
 const sample=(x:number,y:number,period:number)=>{const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const at=(a:number,b:number)=>grid[(b%period)*64+(a%period)];return(at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy}
 pixels=new Uint8Array(size*size*4)
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let value=0,amplitude=.5;for(let octave=0;octave<5;octave++){const period=4*(1<<octave);value+=sample(x/size*period,y/size*period,period)*amplitude;amplitude*=.5}const i=(y*size+x)*4;pixels[i]=Math.round(value/ .96875*255);pixels[i+1]=grid[(y%64)*64+x%64]*255;pixels[i+2]=pixels[i];pixels[i+3]=255}
 return pixels
}
