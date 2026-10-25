export function normalizeSearch(value){
  return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}\p{M}]+/gu,' ').trim().replace(/\s+/g,' ');
}

// Every search word may match a different field; word order is irrelevant.
export function matchesSearch(query,fields){
  const terms=normalizeSearch(query).split(' ').filter(Boolean);
  if(!terms.length)return true;
  const text=normalizeSearch(fields.filter(v=>typeof v==='string').join(' '));
  return terms.every(term=>text.includes(term));
}

export function filterCustomerCatalogue(categories,ingredients,query){
  const details=new Map(ingredients.map(p=>[`${p.category}::${p.group}::${p.name}`,p]));
  return categories.map(category=>{
    const categoryFields=[category.title,category.shortTitle,category.description];
    const groups=category.groups.map(group=>({...group,items:group.items.filter(name=>{
      const ingredient=details.get(`${category.id}::${group.name}::${name}`);
      return matchesSearch(query,[name,group.name,...categoryFields,ingredient?.description,ingredient?.specifications,ingredient?.partner]);
    })})).filter(group=>group.items.length);
    return {...category,groups};
  }).filter(category=>category.groups.length||matchesSearch(query,[category.title,category.shortTitle,category.description]));
}
