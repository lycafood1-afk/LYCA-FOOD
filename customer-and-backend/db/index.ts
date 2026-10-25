import { drizzle } from "drizzle-orm/neon-http";
import {getPostgres} from './postgres';
import * as schema from "./schema";

export function getDb() {
  return drizzle(getPostgres(), { schema });
}
