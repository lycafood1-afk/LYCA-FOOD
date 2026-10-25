import { Link } from "react-router"
import { ArrowUpRight } from "lucide-react"

// Names and original logos: LYCA Company Brochure & Profile, page 3.
// The brochure does not give individual company profiles or partner contacts.
export const partners = [
  { id: "ecom", name: "ECOM", logo: "/images/partners/ecom.png", width: 1152, height: 438 },
  { id: "foods-and-inns", name: "Foods & Inns", logo: "/images/partners/foods-and-inns.png", width: 200, height: 200 },
  { id: "medibel", name: "Medibel", logo: "/images/partners/medibel.png", width: 443, height: 200 },
  { id: "appco", name: "Appco", logo: "/images/partners/appco.png", width: 344, height: 96 },
  { id: "zentis", name: "Zentis", logo: "/images/partners/zentis.png", width: 1200, height: 720 },
] as const

export function PartnersSection({ compact = false }: { compact?: boolean }) {
  return <section id={compact ? "partner-network" : "partners"} className={`section partners-section${compact ? " partners-section--compact" : ""}`} aria-labelledby={compact ? "partner-network-title" : "partners-title"}>
    <div className="partners-heading">
      <div>
        <p className="eyebrow">OUR INGREDIENT PARTNERS</p>
        <h2 id={compact ? "partner-network-title" : "partners-title"}>{compact ? "Good ingredients. Great company." : "Great partnerships. More possibilities."}</h2>
        <p>Working with ECOM, Foods &amp; Inns, Medibel, Appco and Zentis to bring ingredient expertise closer to your next creation.</p>
      </div>
      {compact && <Link className="button button--text" to="/about#partners">Meet our partners <ArrowUpRight size={18} aria-hidden="true" /></Link>}
    </div>
    <ul className="partners-grid">
      {partners.map(partner => <li key={partner.id}>
        <Link className="partner-card" to={compact ? "/about#partners" : `/enquiry?partner=${encodeURIComponent(partner.name)}`} aria-label={compact ? `${partner.name} — meet our partners` : `Enquire about ${partner.name}`}>
          <div className="partner-card__logo"><img src={partner.logo} alt="" width={partner.width} height={partner.height} loading="lazy" decoding="async" /></div>
          <div className="partner-card__caption"><h3>{partner.name}</h3><ArrowUpRight size={18} aria-hidden="true" /></div>
          {!compact && <span className="partner-card__action">Explore with LYCA</span>}
        </Link>
      </li>)}
    </ul>
    {!compact && <div className="partners-invitation"><p>Have a partner or ingredient in mind? Tell us what you’re creating and let’s start the conversation.</p><Link className="button button--secondary" to="/enquiry">Find your ingredient match <ArrowUpRight size={18} aria-hidden="true" /></Link></div>}
  </section>
}
