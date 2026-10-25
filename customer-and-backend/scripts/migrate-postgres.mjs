import {neon} from '@neondatabase/serverless';
import {privateJsonInput} from './private-json-input.mjs';
import {preparePostgresMigration,migratePostgres,MigrationValidationError} from './postgres-migration.mjs';
try{
  const input=await privateJsonInput('Ready for PostgreSQL migration JSON on stdin (input is hidden).');
  const databaseUrl=input.databaseUrl||process.env.DATABASE_URL;
  if(typeof databaseUrl!=='string'||!/^postgres(?:ql)?:\/\//.test(databaseUrl))throw new MigrationValidationError('A PostgreSQL database connection is required.');
  const result=await migratePostgres(neon(databaseUrl),preparePostgresMigration(input.snapshot));
  console.log(JSON.stringify({database:'postgresql',verified:true,...result}));
}catch(error){console.error('PostgreSQL migration did not complete.',error instanceof MigrationValidationError?error.message:'The database connection or transaction failed.');process.exitCode=1;}
