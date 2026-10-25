import type {Metadata} from 'next';
import '@fontsource-variable/manrope';
import './globals.css';
import {SiteShell} from '@/components/lyca/shell';
export const metadata:Metadata={title:{default:'LYCA | Ingredients for what comes next',template:'%s | LYCA Food Ingredients'},description:'Explore fruit concentrates, cocoa, coffee, dairy, coconut, fruit preparations, specialty powders and natural colours. Food ingredients supplied across the Middle East, Africa and South Asia.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><SiteShell>{children}</SiteShell></body></html>}
