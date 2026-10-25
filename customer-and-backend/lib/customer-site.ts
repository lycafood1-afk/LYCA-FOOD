import {env} from 'cloudflare:workers';
export async function customerPage(req:Request){
  const assets=(env as unknown as {ASSETS:{fetch:(req:Request)=>Promise<Response>}}).ASSETS;
  const response=await assets.fetch(new Request(new URL('/customer/index.html',req.url)));
  return new Response(response.body,{status:response.status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
