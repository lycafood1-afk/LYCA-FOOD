export async function privateJsonInput(prompt){
  const stdin=process.stdin;stdin.setEncoding('utf8');const raw=stdin.isTTY;
  if(raw)stdin.setRawMode(true);
  process.stdout.write(prompt+'\n');
  try{return await new Promise((resolve,reject)=>{let input='';const finish=()=>{stdin.off('data',read);stdin.off('error',reject);stdin.pause()};const read=chunk=>{input+=chunk.toString('utf8');if(input.includes('\u0003')){finish();reject(new Error('Operation cancelled.'));return}if(input.includes('\n')){finish();try{resolve(JSON.parse(input.slice(0,input.indexOf('\n')).replace(/\r$/,'')))}catch{reject(new Error('Expected one JSON input.'))}}};stdin.on('data',read);stdin.on('error',reject);stdin.resume()})}
  finally{if(raw)stdin.setRawMode(false)}
}
