import {neon} from '@neondatabase/serverless';
import {privateJsonInput} from './private-json-input.mjs';
import {initializeCatalogue} from './catalogue-schema.mjs';

try{
  // Read a private stdin object instead of putting passwords in command history.
  const input=process.env.DATABASE_URL?{}:await privateJsonInput('Paste one JSON object containing databaseUrl, then press Enter (input is hidden).');
  const url=process.env.DATABASE_URL||input.databaseUrl;
  if(typeof url!=='string'||!/^postgres(?:ql)?:\/\//.test(url))throw new Error('Missing database URL.');
  const sql=neon(url);
  await initializeCatalogue(sql);
  const rows=await sql.query('SELECT count(*)::int AS count FROM lyca.ingredients');
  console.log(JSON.stringify({ready:true,database:'postgresql',ingredients:rows[0].count,existingDataPreserved:true}));
}catch{
  console.error('PostgreSQL setup failed. Check the private connection string, database permissions and internet connection. No demo products are imported.');
  process.exitCode=1;
}
