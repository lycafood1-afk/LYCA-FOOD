import { landingImages } from "./landingData"
import { IngredientPhoto } from "./ingredientPhoto"
import { IngredientAtelier } from "./ingredientAtelier"
import { useMemo, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router"
import {
  ArrowRight, ArrowUpRight, Check, ChevronRight, CircleCheck,
  Globe2, HeartHandshake, Leaf, Mail, PackageCheck,
  Search, ShieldCheck, Sparkles, X,
} from "lucide-react"
import { ButtonLink, FinalCta, OfficeCard, PageHero, SectionHeading, Stat } from "./components"
import { Kinetic, Marquee, CountUp } from "../premium"
import { InwardHero } from "./cinematic"
import { categories, images, offices } from "./data"
import { partners, PartnersSection } from "./partners"
import {filterCustomerCatalogue} from '../../../../shared/catalogue-search.mjs'
import {catalogueImage,ingredientKey,useLiveCatalogue} from "./liveCatalogue"

const enquiryUrl = (category: string, product?: string) =>
  `/enquiry?category=${encodeURIComponent(category)}${product ? `&product=${encodeURIComponent(product)}` : ""}`

const ticker = ["Fruit concentrates", "Cocoa powder", "Coconut products", "Milk powders", "Coffee extracts", "Fruit preparations", "Tomato paste", "Food colours", "Chilli purees", "Specialty powders"]

const process = [
  { n: "01", title: "Share your brief", copy: "Tell us the product, application, specification and target market." },
  { n: "02", title: "Match ingredients", copy: "We align your needs with options across seven ingredient families." },
  { n: "03", title: "Connect regionally", copy: "Your enquiry reaches the team closest to where you do business." },
  { n: "04", title: "Move forward", copy: "Discuss suitability, quantities and commercial terms directly." },
]

export function HomePage() {
  const {categories:liveCategories}=useLiveCatalogue()
  return <>
    <InwardHero />

    <section className="ticker-band" aria-label="Ingredient highlights">
      <Marquee items={ticker} />
      <Marquee items={[...ticker].reverse()} reverse />
    </section>

    <section id="discover" className="discovery section">
      <div className="discovery-top reveal"><p className="eyebrow">01 / A WORLD OF INGREDIENTS</p><span className="micro-label">SOURCED WITH PURPOSE. CONNECTED BY LYCA.</span></div>
      <div className="discovery-heading">
        <Kinetic text="Rich in character." accent="Made for your craft." />
        <p className="reveal">From the brightness of fruit to the depth of cocoa, discover ingredients that give your next food or beverage its own character.</p>
      </div>
      <div className="cinema-collections">{liveCategories.slice(0,3).map((category, index) =>
        <Link className={`collection-panel collection-panel--${index} reveal reveal--iris`} style={{ ["--d" as string]: index }} to={`/products#${category.id}`} key={category.id}>
          <div className="collection-image"><IngredientPhoto src={category.image} alt={category.imageAlt} loading="lazy" /></div>
          <div className="collection-caption"><span className="collection-number">0{index + 1}</span><div><p>THE LYCA PORTFOLIO</p><h3>{category.shortTitle}</h3></div><span className="circle-arrow"><ArrowUpRight size={25} /></span></div>
        </Link>)}
      </div>
      <div className="portfolio-bottom reveal"><span>Your ingredient families. Your next signature creation.</span><ButtonLink to="/products" variant="secondary">Discover the full portfolio</ButtonLink></div>
    </section>

    <section className="manifesto wrap">
      <p className="eyebrow reveal"><Sparkles size={14} /> OUR BELIEF</p>
      <Kinetic className="manifesto__line" text="Behind every memorable flavour," accent="an ingredient worth choosing." />
    </section>

    <IngredientAtelier />

    <section className="brand-statement"><div className="wrap statement-grid">
      <div className="statement-photo reveal reveal--iris"><IngredientPhoto src={landingImages.coconut} alt="Fresh coconut ingredients" loading="lazy" /></div>
      <div className="statement-copy"><p className="eyebrow reveal">02 / THE LYCA CONNECTION</p>
        <Kinetic text="Across borders." accent="Closer to your craft." />
        <p className="reveal">We connect manufacturers and food businesses through a considered ingredient portfolio and regional relationships across the Middle East, Africa, India and Sri Lanka.</p>
        <ButtonLink to="/about" variant="text">Get to know LYCA</ButtonLink></div>
    </div></section>

    <section className="section application-cinema">
      <div className="application-cinema__image reveal reveal--iris"><IngredientPhoto src={landingImages.dessert} alt="Purple pancakes with blueberries and syrup, a dessert application illustration" loading="lazy" /></div>
      <div className="application-cinema__copy"><p className="eyebrow reveal">03 / MADE FOR WHAT YOU CREATE</p>
        <Kinetic text="Flavour. Texture. Colour." accent="Your next signature." />
        <p className="reveal">A vibrant sip. A rich filling. A beautifully balanced dessert. Explore the ingredients behind the experiences you want to create.</p>
        <ButtonLink to="/applications" variant="secondary">Explore applications</ButtonLink></div>
    </section>

    <section className="section process">
      <div className="section-heading section-heading--center"><p className="eyebrow reveal">HOW IT WORKS</p><Kinetic text="From brief to supply," accent="in four clear steps." /></div>
      <div className="process-grid">{process.map((s, i) =>
        <article className="process-card reveal" style={{ ["--d" as string]: i }} key={s.n}>
          <span className="process-card__n">{s.n}</span><h3>{s.title}</h3><p>{s.copy}</p><i className="process-card__line" aria-hidden="true" />
        </article>)}
      </div>
    </section>

    <section className="global-cinema section">
      <div><p className="eyebrow reveal">04 / CLOSE TO YOUR WORLD</p><Kinetic text="A world of ingredients." accent="A local conversation." /></div>
      <div className="global-cinema__details reveal">
        <div className="global-stats"><CountUp to={7} label="Ingredient families" /><CountUp to={6} label="Country locations" /><CountUp to={3} label="Sourcing regions" /></div>
        <div className="market-line"><Globe2 size={22} /><span>Middle East · Africa · India · Sri Lanka</span></div>
        <ButtonLink to="/network" variant="text">Find your LYCA connection</ButtonLink>
      </div>
    </section>

    <PartnersSection compact />
    <FinalCta title="Great flavour begins with a conversation." copy="Bring us your vision. Let’s explore the ingredients that can give it life." />
  </>
}

export function ProductsPage() {
  const {categories,ingredients,details,error:catalogueError,checkedAt,loading}=useLiveCatalogue()
  const [search, setSearch] = useState("")
  const normalizedSearch = search.trim().toLowerCase()
  const filtered=useMemo(()=>filterCustomerCatalogue(categories,ingredients,search),[search,categories,ingredients])
  const matched=filtered.reduce((n,c)=>n+c.groups.reduce((sum,g)=>sum+g.items.length,0),0)
  const total = categories.reduce((n, cat) => n + cat.groups.reduce((sum, g) => sum + g.items.length, 0), 0)
  return <>
    <PageHero eyebrow={`INGREDIENT PORTFOLIO / ${categories.length} COLLECTIONS`} title="A palette for your next creation." copy="Browse our food and beverage ingredient range. Search by product, explore categories and enquire about the options that match your needs." image={images.fruit} imageAlt="A dark still life of fruit representing the ingredient portfolio" />
    <div className="product-toolbar"><div className="wrap product-toolbar__inner"><div className="category-links" aria-label="Jump to ingredient category">{filtered.map(cat => <a href={`#${cat.id}`} key={cat.id}>{cat.shortTitle}</a>)}</div><label className="search-field"><Search size={19}/><span className="sr-only">Search ingredients</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${total} ingredients, categories or partners`} />{search && <button aria-label="Clear search" type="button" onClick={() => setSearch("")}><X size={17}/></button>}</label></div></div>
    <section className="products-layout wrap"><aside className="products-aside"><p className="eyebrow">BROWSE BY FAMILY</p>{filtered.map((cat, index) => <a key={cat.id} href={`#${cat.id}`}><span>0{index+1}</span>{cat.shortTitle}<ChevronRight size={16}/></a>)}<div className="products-help"><p>Need a specific ingredient?</p><Link to="/enquiry">Ask our team <ArrowUpRight size={16}/></Link></div></aside>
      <div className="product-sections">{catalogueError&&<p className="catalogue-sync-note" role="status">{catalogueError}</p>}{checkedAt&&!catalogueError&&<p className="catalogue-checked">Catalogue updated · {new Date(checkedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</p>}<p className="search-summary" role="status">{loading?"Loading catalogue…":normalizedSearch ? `${matched} ingredients in ${filtered.length} categories matching “${search.trim()}”` : `Explore all ${categories.length} ingredient collections`}</p>{filtered.length ? filtered.map((category) => <article id={category.id} key={category.id} className="product-category"><div className="product-category__hero"><IngredientPhoto src={category.image} alt={category.imageAlt} loading="lazy"/><span className="ingredient-provenance">{category.imageCaption}</span><div><p className="eyebrow">COLLECTION {String(categories.indexOf(categories.find(c => c.id === category.id)!) + 1).padStart(2, "0")}</p><h2>{category.title}</h2><p>{category.description}</p><ButtonLink to={enquiryUrl(category.title)} variant="light">Enquire about this range</ButtonLink></div></div><div className="product-groups">{!category.groups.length&&<p className="category-empty-note">No products in this category yet. New published ingredients will appear here.</p>}{category.groups.map(group => <div key={group.name} className="product-group"><h3>{group.name}</h3><div>{group.items.map(item => {const detail=details.get(ingredientKey(category.id,group.name,item));const rich=detail&&(detail.description||detail.specifications||detail.partner||detail.image.startsWith("/api/media/"));return <Link className="product-line" to={rich?`/ingredients/${detail.id}`:enquiryUrl(category.title,item)} key={item}>{detail?.image.startsWith("/api/media/")?<img className="product-line__photo" src={catalogueImage(detail.image)} alt="" width="48" height="48" loading="lazy"/>:<span className="product-line__check"><Check size={14}/></span>}<span className="product-line__text"><span>{item}</span>{detail?.description&&<small>{detail.description}</small>}</span><ArrowUpRight size={17}/></Link>})}</div></div>)}</div>{category.note && <p className="product-note"><ShieldCheck size={21}/>{category.note}</p>}</article>) : <div className="no-results"><Search size={32}/><h2>No ingredients match “{search}”</h2><p>Try another keyword or clear your search to view the full portfolio.</p><button className="button button--primary" onClick={() => setSearch("")}>Clear search <ArrowRight size={16}/></button></div>}</div>
    </section><FinalCta title="Have a specific ingredient in mind?" copy="Share the specifications, application and quantities you're looking for. Our team can help with the next conversation."/>
  </>
}

const industries = [
  { icon: "01", title: "Beverages & juices", copy: "Create vibrant drinks with fruit concentrates, purees, coffee extracts and naturally derived colour options.", image: images.citrus, tags: ["Fruit concentrates", "Coffee extracts", "Food colours"], category: categories[0] },
  { icon: "02", title: "Dairy & alternatives", copy: "Discover ingredients for dairy products, flavoured milk, cultured formats and plant-based innovations.", image: images.dairy, tags: ["Milk powders", "Fruit preparations", "Coconut products"], category: categories[3] },
  { icon: "03", title: "Bakery & patisserie", copy: "Ingredient formats that help bring flavour, texture and a memorable finish to baked products.", image: images.patisserie, tags: ["Fruit preparations", "Cocoa powder", "Coconut"], category: categories[4] },
  { icon: "04", title: "Confectionery", copy: "Explore cocoa, fruit and coconut ingredients suited to sweets, fillings and indulgent creations.", image: images.cocoa, tags: ["Cocoa", "Fruit", "Coconut"], category: categories[2] },
  { icon: "05", title: "Culinary & sauces", copy: "Fruit, vegetable and savoury ingredients for sauces, dressings and prepared food manufacturing.", image: images.tomato, tags: ["Tomato paste", "Chilli purees", "Fruit bases"], category: categories[0] },
  { icon: "06", title: "Desserts & ice cream", copy: "Discover fruit preparations, milk-based ingredients and flavour options for dessert applications.", image: images.dessert, tags: ["Fruit preparations", "Dairy", "Specialty powders"], category: categories[4] },
]
export function ApplicationsPage() {
  return <><PageHero eyebrow="WHERE OUR INGREDIENTS GO" title="Made for memorable tastes." copy="Behind every memorable bite or sip is the right combination of ingredients. Explore the industries and applications our portfolio supports." image={images.berries} imageAlt="Fresh berries for culinary applications" />
    <section className="section applications-section"><SectionHeading eyebrow="FROM IDEA TO FINISHED PRODUCT" title="One portfolio. Many possibilities." copy="Ingredient suggestions below are application examples rather than confirmed formulations. Our team can discuss suitability for your specific product."/><div className="industry-grid">{industries.map(ind => <article key={ind.title} className="industry-card reveal"><div className="industry-card__image"><IngredientPhoto src={ind.image} alt={ind.title} loading="lazy"/><span>{ind.icon} / 06</span></div><div className="industry-card__content"><h3>{ind.title}</h3><p>{ind.copy}</p><div className="industry-tags">{ind.tags.map(tag => <span key={tag}>{tag}</span>)}</div><Link to={`/products#${ind.category.id}`}>Explore suitable categories <ArrowUpRight size={16}/></Link></div></article>)}</div></section>
    <section className="application-outro wrap reveal"><div><p className="eyebrow">HAVE A NEW CONCEPT?</p><h2>From a new formulation to your next great idea.</h2></div><p>Let us know the product you're developing, along with any technical and commercial requirements. Our team can start a conversation with you.</p></section><FinalCta title="Your next product starts here." copy="Connect with LYCA to discuss ingredient options for your specific application."/>
  </>
}
export function AboutPage() {
  const {categories}=useLiveCatalogue()
  return <><PageHero eyebrow="WHO WE ARE / OUR COMPANY" title="Connecting ingredients. Inspiring creation." copy="LYCA Food Ingredients Supplies connects manufacturers and businesses through a focused portfolio of ingredients and an international network." image={images.citrus} imageAlt="Fresh citrus fruit reflecting LYCA's ingredient sourcing" />
    <section className="section about-story"><div className="about-story__copy"><SectionHeading eyebrow="THE LYCA STORY" title="From global origins to local ambition." copy="LYCA Food Ingredients Supplies works with manufacturers from Europe, China and South America, serving food and beverage businesses across the Middle East, East and West Africa, North Africa, India and Sri Lanka."/><p>We believe sourcing conversations should begin with clarity: the right product, the right application and a team that understands the markets you work in.</p><ButtonLink to="/network" variant="text">See our global network</ButtonLink></div><div className="about-story__image reveal"><IngredientPhoto src={images.fruit} loading="lazy" alt="Variety of fresh fruit ingredients" /><div><span>INGREDIENT-LED</span><strong>Ingredients connect us.</strong></div></div></section>
    <section className="values-section"><div className="wrap"><SectionHeading eyebrow="WHAT GUIDES OUR WORK" title="A practical approach. A global outlook."/><div className="values-grid"><article className="reveal"><span><PackageCheck size={27}/></span><h3>Portfolio focus</h3><p>A carefully organised selection across seven ingredient categories for a wide variety of manufacturing needs.</p></article><article className="reveal"><span><Globe2 size={27}/></span><h3>International perspective</h3><p>Sourcing relationships spanning Europe, China and South America, paired with a presence across key regional markets.</p></article><article className="reveal"><span><HeartHandshake size={27}/></span><h3>Business connection</h3><p>A direct route to discuss ingredients, specifications and commercial enquiries with regional contacts.</p></article></div></div></section>
    <PartnersSection />
    <section className="section about-categories"><SectionHeading eyebrow="OUR PRODUCT FAMILIES" title="Broad capabilities, focused conversations."/><div className="expertise-grid">{categories.map((cat, i) => <Link key={cat.id} to={`/products#${cat.id}`}><span>0{i+1}</span><h3>{cat.shortTitle}</h3><ArrowUpRight size={21}/></Link>)}</div></section><FinalCta title="Let's build a strong partnership." copy="Explore our ingredient portfolio or get in touch to discuss what your business needs." />
  </>
}
export function NetworkPage() {
  return <><PageHero eyebrow="CONNECTED ACROSS MARKETS" title="Global reach. A local conversation." copy="With business contacts across six countries, LYCA connects ingredient enquiries to the teams closest to your market." image={images.coconut} imageAlt="Coconut ingredient representing an international food supply network"/>
    <section className="section network-intro"><SectionHeading eyebrow="OUR GLOBAL FOOTPRINT" title="Closer to where you do business." copy="Reach out directly to your regional contact below. Please confirm office visits in advance using the provided contact details."/><div className="network-summary"><Stat number="06" label="Country locations"/><Stat number="03" label="Sourcing regions"/><p>Serving customers across the Middle East, Africa, India and Sri Lanka.</p></div></section>
    <section className="section locations-section" id="locations"><div className="section-top"><SectionHeading eyebrow="LOCATIONS & CONTACTS" title="Find your LYCA connection."/><ButtonLink to="/enquiry" variant="secondary">General enquiry</ButtonLink></div><div className="office-grid">{offices.map(office => <OfficeCard key={office.country} office={office}/>)}</div></section><section className="network-bottom wrap"><Globe2 size={34}/><div><h2>Not sure who to contact?</h2><p>Our central enquiry team can direct you to an appropriate regional contact.</p></div><a href="mailto:customerservice@lycafoods.com">customerservice@lycafoods.com <ArrowUpRight size={19}/></a></section><FinalCta title="Across markets. Around your ambition." copy="Tell us about your ingredient requirements and your target market. We'll help get the conversation started."/>
  </>
}

type ErrorKey = "name" | "company" | "email" | "phone" | "country" | "category" | "message" | "consent"
type Errors = Partial<Record<ErrorKey, string>>
export function EnquiryPage() {
  const {categories}=useLiveCatalogue()
  const [params] = useSearchParams()
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"email"|"error">("idle")
  const [errors, setErrors] = useState<Errors>({})
  const endpoint = import.meta.env.VITE_ENQUIRY_API_URL?.trim()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const next: Errors = {}
    if (!String(data.name || "").trim()) next.name = "Please enter your name."
    if (!String(data.company || "").trim()) next.company = "Please enter your company."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email || ""))) next.email = "Enter a valid email address."
    if (!/^\+?[\d\s()-]{7,20}$/.test(String(data.phone || ""))) next.phone = "Enter a valid contact number."
    if (!String(data.country || "").trim()) next.country = "Please enter your country."
    if (!data.category) next.category = "Please choose a category."
    if (!String(data.message || "").trim()) next.message = "Tell us about your requirements."
    if (!data.consent) next.consent = "Please consent to sharing your enquiry."
    setErrors(next)
    if (Object.keys(next).length) {
      setStatus("idle")
      const field = form.elements.namedItem(Object.keys(next)[0])
      if (field instanceof HTMLElement) field.focus()
      return
    }
    if (!endpoint) {
      const subject = `LYCA ingredient enquiry — ${data.company}`
      const body = ["LYCA FOOD INGREDIENT ENQUIRY", "", ...Object.entries(data).filter(([key]) => key !== "website" && key !== "consent").map(([key, val]) => `${key}: ${val}`)].join("\n")
      setStatus("email")
      window.location.href = `mailto:sales@lycafoods.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      return
    }
    setStatus("sending")
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      setStatus("sent"); form.reset()
    } catch { setStatus("error") }
  }
  const fieldError = (key: ErrorKey) => errors[key] ? <span id={`error-${key}`} className="field-error" role="alert">{errors[key]}</span> : null
  return <><PageHero eyebrow="START A CONVERSATION" title="Let's talk ingredients." copy="Have a specific product, application or market in mind? Share your requirements and we'll help you find the right point of contact." image={images.blueberries} imageAlt="Blueberries on dark stone" />
    <section className="section enquiry-layout"><div className="enquiry-aside"><p className="eyebrow">LET'S COLLABORATE</p><h2>Tell us what you have in mind.</h2><p>The more you share about your application, estimated quantity and delivery market, the more useful the first conversation can be.</p><div className="direct-contacts"><h3>Prefer to reach us directly?</h3>{["sales@lycafoods.com", "sales2@lycafoods.com", "customerservice@lycafoods.com"].map(email => <a href={`mailto:${email}`} key={email}><Mail size={16}/>{email}<ArrowUpRight size={16}/></a>)}</div><div className="enquiry-promise"><ShieldCheck size={21}/><span>Your enquiry details are used to respond to your business request. Please avoid sending sensitive personal information.</span></div></div>
      <form className="enquiry-form" onSubmit={submit} noValidate><div className="form-heading"><span>BUSINESS ENQUIRY</span><h3>How can we help?</h3><p>Fields marked * are required.</p></div><div className="form-grid"><label>Full name *<input name="name" autoComplete="name" placeholder="Your full name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "error-name" : undefined}/>{fieldError("name")}</label><label>Company name *<input name="company" autoComplete="organization" placeholder="Company or organisation" aria-invalid={!!errors.company} aria-describedby={errors.company ? "error-company" : undefined}/>{fieldError("company")}</label><label>Business email *<input name="email" type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? "error-email" : undefined}/>{fieldError("email")}</label><label>Phone with country code *<input name="phone" type="tel" autoComplete="tel" placeholder="+971 ..." aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "error-phone" : undefined}/>{fieldError("phone")}</label><label>Country / market *<input name="country" autoComplete="country-name" placeholder="Your country" aria-invalid={!!errors.country} aria-describedby={errors.country ? "error-country" : undefined}/>{fieldError("country")}</label><label>Ingredient category *<select key={params.toString()} name="category" defaultValue={params.get("category") || ""} aria-invalid={!!errors.category} aria-describedby={errors.category ? "error-category" : undefined}><option value="">Select a category</option>{categories.map(cat => <option key={cat.id} value={cat.title}>{cat.title}</option>)}</select>{fieldError("category")}</label><label>Product of interest <span>(optional)</span><input name="product" defaultValue={params.get("product") || ""} placeholder="Product or specification"/></label><label>Preferred partner <span>(optional)</span><select key={params.get("partner") || ""} name="partner" defaultValue={params.get("partner") || ""}><option value="">Help me choose</option>{partners.map(partner => <option key={partner.id} value={partner.name}>{partner.name}</option>)}</select></label><label>Estimated quantity <span>(optional)</span><input name="quantity" placeholder="e.g. 500 kg / month"/></label><label>Application <span>(optional)</span><input name="application" placeholder="e.g. beverage manufacturing"/></label><label className="full">Your requirements *<textarea name="message" rows={5} placeholder="Tell us about your ingredient needs, specifications, shipping market or questions..." aria-invalid={!!errors.message} aria-describedby={errors.message ? "error-message" : undefined}/>{fieldError("message")}</label><label className="honeypot" aria-hidden="true">Website<input tabIndex={-1} name="website" autoComplete="off"/></label><label className="consent full"><input name="consent" type="checkbox" value="yes" aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "error-consent" : undefined}/><span>I agree to LYCA using these details to respond to my enquiry. See our <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>. *</span>{fieldError("consent")}</label></div><button className="button button--primary submit-button" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending your enquiry..." : "Let’s Create Your Next Flavour"}<ArrowUpRight size={19}/></button>
      {status === "sent" && <p className="form-status form-status--success" role="status">Your enquiry was submitted successfully. Thank you for contacting LYCA.</p>}
      {status === "email" && <p className="form-status" role="status">Your email application should open with your enquiry prepared. Review it and press Send in your mail app. If it didn't open, email <a href="mailto:sales@lycafoods.com">sales@lycafoods.com</a> directly. Nothing has been sent automatically.</p>}
      {status === "error" && <p className="form-status form-status--error" role="alert">The form could not be delivered. Please try again or email <a href="mailto:sales@lycafoods.com">sales@lycafoods.com</a>.</p>}
      {!endpoint && <p className="endpoint-note">An email application is required to send your enquiry. You can also contact our sales team directly using the email links on this page.</p>}
      </form>
    </section>
  </>
}
export function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const privacy = type === "privacy"
  return <><section className="legal-hero"><div className="wrap"><p className="eyebrow">INFORMATION & POLICIES</p><h1>{privacy ? "Privacy policy" : "Terms of use"}</h1><p>Information about this website and how it is intended to be used.</p></div></section><div className="legal-content wrap"><p className="legal-disclaimer">These website notices are provided as a starting point and should be reviewed by LYCA's legal or compliance team before public launch.</p>{privacy ? <><h2>Information you provide</h2><p>If you submit a business enquiry, you may provide your name, company, contact details and product requirements. Information is used to respond to your request and communicate about relevant business matters.</p><h2>Enquiry delivery</h2><p>By default the enquiry form prepares an email in your own email application. If LYCA configures a form service, your data will be transmitted to that service to process your enquiry. The website does not claim that an unconfigured enquiry endpoint is active.</p><h2>Website technologies</h2><p>The site uses decorative WebGL graphics and standard browser functionality. No analytics or advertising trackers are included in this delivered source. Third-party images and fonts may result in requests to their respective providers.</p><h2>Questions about personal data</h2><p>For enquiries relating to information submitted through this website, contact <a href="mailto:customerservice@lycafoods.com">customerservice@lycafoods.com</a>.</p></> : <><h2>Website information</h2><p>Product information on this website is general and does not constitute an offer, technical specification, or guarantee of availability. Please confirm suitability, pricing, packaging, regulatory requirements and quantities directly with LYCA.</p><h2>Images and third-party content</h2><p>Illustrative ingredient photography may show representative products rather than the exact ingredient format supplied. Third-party imagery remains subject to its respective licensing terms.</p><h2>Business enquiries</h2><p>Sending an enquiry does not create a supply agreement. Any orders or commercial terms must be agreed upon separately with the relevant company representative.</p><h2>Contact</h2><p>Questions about the website may be directed to <a href="mailto:customerservice@lycafoods.com">customerservice@lycafoods.com</a>.</p></>}</div></>
}
export function NotFound() { return <section className="not-found wrap"><span className="eyebrow">404 / PAGE NOT FOUND</span><h1>This ingredient isn't on the menu.</h1><p>That page might have moved. Try our home page or explore the portfolio.</p><div className="button-row"><ButtonLink to="/">Back to home</ButtonLink><ButtonLink to="/products" variant="secondary">View ingredients</ButtonLink></div></section> }
