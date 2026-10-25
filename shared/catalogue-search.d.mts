export function normalizeSearch(value:unknown):string;
export function matchesSearch(query:string,fields:(string|null|undefined)[]):boolean;
type SearchCategory={id:string;title:string;shortTitle:string;description:string;groups:{name:string;items:string[]}[]};
type SearchIngredient={category:string;group:string;name:string;description?:string;specifications?:string;partner?:string};
export function filterCustomerCatalogue<T extends SearchCategory>(categories:T[],ingredients:SearchIngredient[],query:string):T[];
