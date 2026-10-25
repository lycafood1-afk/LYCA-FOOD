'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="section"><h1>A little interruption.</h1><p>We couldn’t load this page. Please try again or contact mohamed@lycafoods.com.</p><button className="button" onClick={reset}>Try again</button></section>}
