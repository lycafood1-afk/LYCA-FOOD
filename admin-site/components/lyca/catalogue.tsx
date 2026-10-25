'use client';
import {Select,SelectTrigger,SelectContent,SelectValue,SelectItem} from '@/components/ui/select';
export function Choice({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:{id:string;name:string}[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger className="filter-select" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>}
