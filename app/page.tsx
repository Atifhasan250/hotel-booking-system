"use client";

import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Hotel,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatBdtMinorUnits } from "../src/modules/catalog/presentation/public-format";

const assets = {
  logo: "/bookmyroom-dark-no-bg.png",
  hero: "/media-awaiting-approval.svg",
  about: "/media-awaiting-approval.svg",
  award: "/media-awaiting-approval.svg",
};

type StayPreview = { id: string; slug: string; name: string; place: string; propertyType: string; startingPriceMinorUnits: number | null; image: { url: string; altText: string; width: number; height: number } | null; rating: number | null; ratingCount: number };
type DestinationPreview = { id: string; slug: string; name: string; image: { url: string; altText: string; width: number; height: number } | null; propertyCount: number };

const featureItems = [
  ["Local stays, thoughtfully picked", "Hotels and resorts across Bangladesh, selected for comfort and character.", Sparkles],
  ["Straightforward BDT pricing", "Clear local pricing helps you compare stays and plan with confidence.", Check],
  ["More ways to travel are coming", "Stay search is available; tours and cars will open only after their inventory is verified.", CarFront],
  ["Reservation safety comes first", "Booking will open only after quote, hold, payment and confirmation safeguards are independently verified.", ShieldCheck],
] as const;

const districts = [
  "Dhaka", "Chattogram", "Cox's Bazar", "Sylhet", "Moulvibazar", "Khulna",
  "Bagerhat", "Bandarban", "Rangamati", "Khagrachari", "Rajshahi", "Bogura",
  "Cumilla", "Noakhali", "Feni", "Barishal", "Patuakhali", "Gazipur",
  "Narayanganj", "Munshiganj", "Mymensingh", "Tangail", "Jashore", "Kushtia",
  "Dinajpur", "Rangpur", "Panchagarh", "Sunamganj", "Habiganj", "Gopalganj",
];

type PopupKey = "location" | "pickup" | "dropoff" | "startDate" | "endDate" | "guests";

const readableDate = (value: string) => new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric",
}).format(new Date(`${value}T12:00:00`));

const localDateISO = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const todayISO = () => localDateISO(new Date());
const addDaysISO = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateISO(date);
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("Hotel");
  const [filter, setFilter] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [liked, setLiked] = useState<number[]>([]);
  const [stays, setStays] = useState<StayPreview[]>([]);
  const [destinations, setDestinations] = useState<DestinationPreview[]>([]);
  const [discoveryError, setDiscoveryError] = useState(false);
  const [activePopup, setActivePopup] = useState<PopupKey | null>(null);
  const [location, setLocation] = useState("Dhaka");
  const [pickup, setPickup] = useState("Dhaka");
  const [dropoff, setDropoff] = useState("Cox's Bazar");
  const [startDate, setStartDate] = useState(() => todayISO());
  const [endDate, setEndDate] = useState(() => addDaysISO(todayISO(), 1));
  const [pickupTime, setPickupTime] = useState("10:00");
  const [dropoffTime, setDropoffTime] = useState("10:00");
  const [calendarCursor, setCalendarCursor] = useState(() => `${todayISO().slice(0, 7)}-01`);
  const [guests, setGuests] = useState({ adults: 2, children: 0, rooms: 1 });
  const bookingRef = useRef<HTMLDivElement>(null);
  const destinationScrollRef = useRef<HTMLDivElement>(null);

  const visibleStays = filter === "All" ? stays : stays.filter((stay) => stay.propertyType === filter);
  const isFutureService = activeTab === "Tour" || activeTab === "Car";

  const openPopup = (key: PopupKey) => setActivePopup((current) => current === key ? null : key);
  const bookingField = (key: PopupKey, icon: ReactNode, label: string, value: string) => (
    <button type="button" className={activePopup === key ? "booking-field selected" : "booking-field"} onClick={() => openPopup(key)}>
      {icon}<span>{label}<strong>{value}</strong></span>
    </button>
  );

  const openDatePopup = (key: "startDate" | "endDate", value: string) => {
    setCalendarCursor(`${value.slice(0, 7)}-01`);
    openPopup(key);
  };

  const dateBookingField = (
    key: "startDate" | "endDate",
    label: string,
    value: string,
    time?: string,
    onTimeChange?: (value: string) => void,
  ) => (
    <div className={time ? "booking-field date-booking-field with-time" : "booking-field date-booking-field"}>
      <button type="button" className="date-trigger" onClick={() => openDatePopup(key, value)}>
        <CalendarDays />
        <span>{label}<strong>{readableDate(value)}</strong></span>
      </button>
      {time && onTimeChange && (
        <select value={time} onChange={(event) => onTimeChange(event.target.value)} aria-label={`${label} time`}>
          {Array.from({ length: 24 }, (_, hour) => ["00", "30"].map((minute) => {
            const value = `${String(hour).padStart(2, "0")}:${minute}`;
            return <option key={value} value={value}>{value}</option>;
          }))}
        </select>
      )}
    </div>
  );

  const chooseDistrict = (district: string) => {
    if (activePopup === "pickup") setPickup(district);
    else if (activePopup === "dropoff") setDropoff(district);
    else setLocation(district);
    setActivePopup(null);
  };

  const changeGuest = (key: keyof typeof guests, delta: number) => {
    const minimum = key === "children" ? 0 : 1;
    setGuests((current) => ({ ...current, [key]: Math.max(minimum, current[key] + delta) }));
  };

  const calendarDate = new Date(`${calendarCursor}T12:00:00`);
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const calendarBlankDays = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarMonthDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(calendarDate);

  const moveCalendarMonth = (delta: number) => {
    setCalendarCursor(localDateISO(new Date(calendarYear, calendarMonth + delta, 1)));
  };

  const chooseCalendarDate = (value: string) => {
    if (activePopup === "startDate") {
      setStartDate(value);
      if (endDate <= value) setEndDate(addDaysISO(value, 1));
    } else if (activePopup === "endDate") setEndDate(value);
    setActivePopup(null);
  };

  const scrollDestinations = (direction: number) => {
    destinationScrollRef.current?.scrollBy({ left: direction * 580, behavior: "smooth" });
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/catalog/public-home", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Public discovery unavailable");
        return response.json() as Promise<{ stays: StayPreview[]; destinations: DestinationPreview[] }>;
      })
      .then((data) => { setStays(data.stays); setDestinations(data.destinations); })
      .catch((error: unknown) => { if ((error as Error).name !== "AbortError") setDiscoveryError(true); });

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (bookingRef.current && !bookingRef.current.contains(event.target as Node)) setActivePopup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePopup(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      controller.abort();
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <main className="page-shell">
      <div className="site-frame">
        <header className="nav">
          <a className="brand" href="#home" aria-label="Book My Room home">
            <Image src={assets.logo} alt="Book My Room" width={225} height={130} />
          </a>
          <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Primary navigation">
            <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
            <a href="#stays" onClick={() => setMenuOpen(false)}>Hotels</a>
            <a href="#destinations" onClick={() => setMenuOpen(false)}>Destinations</a>
            <a href="#cars" onClick={() => setMenuOpen(false)}>Cars · Coming soon</a>
          </nav>
          <div className="nav-actions">
            <a className="partner-link" href="#footer">Become a Partner</a>
            <a className="dashboard-btn" href="/auth">Dashboard <ArrowRight size={15} /></a>
            <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </header>
        <section className="hero" id="home">
          <Image className="hero-image" src={assets.hero} alt="Abstract forest landscape while approved Bangladesh travel media is prepared" width={1600} height={1000} sizes="100vw" preload />
          <div className="hero-shade" />

          <div className="hero-copy stagger">
            <h1>Find your<br />Bangladesh sanctuary</h1>
          </div>

          <div className="booking-wrap" ref={bookingRef}>
            <div className="booking-tabs" role="tablist" aria-label="Booking type">
              {[
                ["Hotel", Hotel], ["Room", BedDouble], ["Tour", MapPin], ["Car", CarFront],
              ].map(([label, Icon]) => (
                <button role="tab" aria-selected={activeTab === label} key={label as string} className={activeTab === label ? "active" : ""} onClick={() => { setActiveTab(label as string); setActivePopup(null); }}>
                  <Icon size={16} /> {label as string}
                </button>
              ))}
            </div>
            <form action="/search" method="get" className={activeTab === "Car" ? "booking-bar car-mode" : "booking-bar"}>
              {activeTab === "Car" ? (
                <>
                  {bookingField("pickup", <MapPin />, "Pick-up", pickup)}
                  {bookingField("dropoff", <MapPin />, "Drop-off", dropoff)}
                  {dateBookingField("startDate", "Pick-up date & time", startDate, pickupTime, setPickupTime)}
                  {dateBookingField("endDate", "Drop-off date & time", endDate, dropoffTime, setDropoffTime)}
                </>
              ) : (
                <>
                  {bookingField("location", <MapPin />, activeTab === "Tour" ? "Destination" : "Location", location)}
                  {dateBookingField("startDate", activeTab === "Tour" ? "Start date" : "Check in", startDate)}
                  {dateBookingField("endDate", activeTab === "Tour" ? "End date" : "Check out", endDate)}
                  {bookingField("guests", <Users />, activeTab === "Room" ? "Guests & rooms" : "Guests", `${guests.adults + guests.children} Guests · ${guests.rooms} Room${guests.rooms > 1 ? "s" : ""}`)}
                </>
              )}
              <input type="hidden" name="destination" value={location} />
              <input type="hidden" name="checkIn" value={startDate} />
              <input type="hidden" name="checkOut" value={endDate} />
              <input type="hidden" name="adults" value={guests.adults} />
              <input type="hidden" name="children" value={guests.children} />
              <input type="hidden" name="rooms" value={guests.rooms} />
              <button
                type="submit"
                className="search-btn"
                disabled={isFutureService}
                aria-label={isFutureService ? `${activeTab} booking coming soon` : "Check availability"}
                formAction={isFutureService ? undefined : "/search"}
                formMethod="get"
              >
                {isFutureService ? <><Sparkles size={18} /> Coming soon</> : <><Search size={18} /> Check availability</>}
              </button>
            </form>

            {activePopup && (
              <div className={`booking-popover ${activePopup}`} role="dialog" aria-label="Booking options">
                <div className="popover-head">
                  <div><span>BOOK MY ROOM</span><strong>{activePopup === "guests" ? "Guests & rooms" : activePopup === "startDate" ? "Choose check-in date" : activePopup === "endDate" ? "Choose checkout date" : activePopup === "pickup" ? "Pick-up district" : activePopup === "dropoff" ? "Drop-off district" : "Choose your destination"}</strong></div>
                  <button type="button" onClick={() => setActivePopup(null)} aria-label="Close selector"><X size={17} /></button>
                </div>
                {(activePopup === "location" || activePopup === "pickup" || activePopup === "dropoff") && (
                  <div className="district-grid">
                    {districts.map((district) => {
                      const current = activePopup === "pickup" ? pickup : activePopup === "dropoff" ? dropoff : location;
                      return <button type="button" className={current === district ? "active" : ""} key={district} onClick={() => chooseDistrict(district)}><MapPin size={13} />{district}</button>;
                    })}
                  </div>
                )}
                {(activePopup === "startDate" || activePopup === "endDate") && (
                  <div className="calendar-picker">
                    <div className="calendar-toolbar">
                      <button type="button" onClick={() => moveCalendarMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
                      <strong>{calendarLabel}</strong>
                      <button type="button" onClick={() => moveCalendarMonth(1)} aria-label="Next month"><ChevronRight /></button>
                    </div>
                    <div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
                    <div className="calendar-days">
                      {Array.from({ length: calendarBlankDays }, (_, index) => <span key={`blank-${index}`} />)}
                      {Array.from({ length: calendarMonthDays }, (_, index) => {
                        const day = index + 1;
                        const value = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const selected = value === (activePopup === "startDate" ? startDate : endDate);
                        const minimum = activePopup === "endDate" ? addDaysISO(startDate, 1) : todayISO();
                        return <button type="button" key={value} className={selected ? "selected" : ""} disabled={value < minimum} onClick={() => chooseCalendarDate(value)}>{day}</button>;
                      })}
                    </div>
                  </div>
                )}
                {activePopup === "guests" && (
                  <div className="guest-selector">
                    {(["adults", "children", "rooms"] as const).map((key) => (
                      <div className="guest-row" key={key}>
                        <div><strong>{key[0].toUpperCase() + key.slice(1)}</strong><span>{key === "adults" ? "Age 13+" : key === "children" ? "Age 0–12" : "Rooms needed"}</span></div>
                        <div><button type="button" onClick={() => changeGuest(key, -1)} aria-label={`Remove ${key}`}><Minus /></button><strong>{guests[key]}</strong><button type="button" onClick={() => changeGuest(key, 1)} aria-label={`Add ${key}`}><Plus /></button></div>
                      </div>
                    ))}
                    <button type="button" className="apply-guests" onClick={() => setActivePopup(null)}>Apply selection <Check size={16} /></button>
                  </div>
                )}
              </div>
            )}
          </div>
          <a href="#stays" className="scroll-note"><span>Scroll to explore</span><ChevronRight /></a>
        </section>

        <section className="stays-section section" id="stays">
          <div className="section-heading center">
            <span className="section-kicker">CHOOSE YOUR EXPERIENCE</span>
            <h2>Where comfort meets discovery</h2>
            <p>Handpicked stays that place Bangladesh&apos;s best experiences within reach.</p>
          </div>
          <div className="filter-row">
            <div className="filters">
              {["All", "Resort", "Hotel", "Eco Resort"].map((item) => (
                <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>
              ))}
            </div>
            <a href="/search">See all stays <ArrowRight size={15} /></a>
          </div>
          <div className="stay-grid">
            {visibleStays.map((stay, index) => (
              <article className="stay-card" key={stay.name}>
                <Image src={stay.image?.url ?? assets.hero} alt={stay.image?.altText ?? `${stay.name} approved media awaiting upload`} width={stay.image?.width ?? 1600} height={stay.image?.height ?? 1000} sizes="(max-width: 760px) 100vw, (max-width: 1120px) 50vw, 33vw" />
                <div className="card-shade" />
                <button
                  className={liked.includes(index) ? "heart liked" : "heart"}
                  onClick={() => setLiked((current) => current.includes(index) ? current.filter((n) => n !== index) : [...current, index])}
                  aria-label={`Save ${stay.name}`}
                ><Heart size={17} /></button>
                <div className="card-content">
                  <span className="card-type">{stay.propertyType}</span>
                  <h3><a href={`/properties/${stay.slug}`}>{stay.name}</a></h3>
                  <p><MapPin size={13} /> {stay.place}</p>
                  <div className="amenities"><span><Users />2–5 Guests</span><span><BedDouble />1–3 Beds</span></div>
                  <div className="price-row"><strong>{stay.startingPriceMinorUnits === null ? "Choose dates" : formatBdtMinorUnits(stay.startingPriceMinorUnits)}<small>{stay.startingPriceMinorUnits === null ? "" : "/night"}</small></strong><span>{stay.ratingCount > 0 && stay.rating !== null ? <><Star size={13} fill="currentColor" /> {stay.rating}</> : "New listing"}</span></div>
                </div>
              </article>
            ))}
            {visibleStays.length === 0 && <div className="truthful-empty"><strong>{discoveryError ? "The approved catalog is temporarily unavailable." : "Approved stays will appear here."}</strong><span>We do not use sample prices, ratings or properties. Search results come only from published catalog records.</span><a href="/search">Search the live catalog <ArrowRight size={15} /></a></div>}
          </div>
        </section>

        <section className="feature-panel section" id="about">
          <div className="section-heading center compact">
            <span className="section-kicker">WHY BOOK MY ROOM</span>
            <h2>A better way to discover Bangladesh</h2>
            <p>Local travel, made refreshingly simple from first search to final checkout.</p>
          </div>
          <div className="feature-layout">
            <div className="feature-list">
              {featureItems.map(([title, description, Icon], index) => (
                <div className="feature-item" key={title}>
                  <span className="feature-no">0{index + 1}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                  <Icon size={19} />
                </div>
              ))}
            </div>
            <div className="feature-collage">
              <Image className="collage-main" src={assets.about} alt="Abstract landscape while approved destination media is prepared" width={1600} height={1000} sizes="(max-width: 760px) 100vw, 50vw" />
              <Image className="collage-small" src={assets.hero} alt="Approved destination media is being prepared" width={1600} height={1000} sizes="(max-width: 760px) 50vw, 25vw" />
              <span className="rating-chip"><ShieldCheck size={14} /> Verified catalog only</span>
              <span className="booking-chip"><b>Real</b> listings after review</span>
            </div>
          </div>
        </section>

        <section className="destinations section" id="destinations">
          <div className="section-heading split">
            <div><span className="section-kicker">VACATION SPOTS</span><h2>Top destinations,<br />closer than you think.</h2></div>
            <div><p>Published destination guides and their approved stays appear only after content and media review.</p><a href="/search" className="future-note">Browse approved stays</a></div>
          </div>
          <div className="destination-carousel">
            <div className="destination-strip" ref={destinationScrollRef}>
              {destinations.map((destination, index) => (
                <article className="destination-card featured" key={destination.id}>
                  <Image src={destination.image?.url ?? assets.hero} alt={destination.image?.altText ?? `${destination.name} approved media awaiting upload`} width={destination.image?.width ?? 1600} height={destination.image?.height ?? 1000} sizes="(max-width: 760px) 86vw, 31vw" />
                  <div className="destination-overlay" />
                  <span>0{index + 1}</span>
                  <h3>{destination.name}</h3>
                  <a href={`/destinations/${destination.slug}`} aria-label={`Explore ${destination.name}`}><ArrowRight /></a>
                </article>
              ))}
              {destinations.length === 0 && <div className="truthful-empty"><strong>Destination guides await verified launch content.</strong><span>No launch districts or destination imagery have been invented.</span></div>}
            </div>
            <button type="button" className="carousel-control prev" onClick={() => scrollDestinations(-1)} aria-label="Previous destinations"><ChevronLeft /></button>
            <button type="button" className="carousel-control next" onClick={() => scrollDestinations(1)} aria-label="Next destinations"><ChevronRight /></button>
          </div>
        </section>

        <section className="award-section" id="cars">
          <Image className="award-bg" src={assets.award} alt="Abstract landscape while approved journey media is prepared" width={1600} height={1000} sizes="100vw" />
          <div className="award-shade" />
          <div className="award-copy">
            <span className="section-kicker light">PLAN THE WHOLE JOURNEY</span>
            <h2>Stay. Tour.<br />Drive. Discover.</h2>
            <p>Search approved stays today. Booking, tour and car services will open only after their safety and inventory gates are verified.</p>
            <div className="mini-destinations">
              {destinations.slice(0, 4).map((destination, i) => <Image className={i === 0 ? "selected" : ""} key={destination.id} src={destination.image?.url ?? assets.hero} alt={destination.image?.altText ?? destination.name} width={destination.image?.width ?? 1600} height={destination.image?.height ?? 1000} sizes="72px" />)}
            </div>
          </div>
          <div className="floating-booking">
            <Image src={assets.hero} alt="Car service visual awaiting approval" width={1600} height={1000} sizes="(max-width: 760px) 100vw, 450px" />
            <div className="floating-info"><span className="tiny-label">FUTURE SERVICE</span><h3>Car rental</h3><p>Supplier, inventory and operating rules are not yet approved.</p><div><strong>Coming soon</strong></div><button type="button" aria-label="Car service coming soon" disabled>Coming soon</button></div>
          </div>
        </section>

        <section className="testimonial section">
          <svg className="scribble top" viewBox="0 0 700 160" aria-hidden="true"><path d="M-10 146c87-75 145-21 214-96 50-55 110 9 180-40 69-48 175 10 326-16" /></svg>
          <svg className="scribble bottom" viewBox="0 0 700 160" aria-hidden="true"><path d="M-10 146c87-75 145-21 214-96 50-55 110 9 180-40 69-48 175 10 326-16" /></svg>
          <div className="section-heading center compact"><span className="section-kicker">TRAVELER STORIES</span><h2>Verified reviews, when earned</h2><p>Only eligible completed stays can produce a public review.</p></div>
          <blockquote>Guest stories will appear here after the verified-stay review workflow is implemented and real reviews pass moderation.</blockquote>
          <span className="guest-place">No sample identities, avatars, quotes or ratings are published.</span>
        </section>

        <footer id="footer">
          <div className="footer-brand"><Image src={assets.logo} alt="Book My Room" width={225} height={130} /><p>Your trusted starting point for stays across Bangladesh, with more travel services coming later.</p></div>
          <div><span>Explore</span><a href="#stays">Hotels</a><a href="#destinations">Destinations</a><a href="#cars">Cars · Coming soon</a></div>
          <div><span>Company</span><a href="#about">About us</a><a href="/vendor/onboarding">Become a partner</a><a href="/auth">Account access</a></div>
          <div className="footer-cta"><span>Ready to go?</span><h3>Find your next stay.</h3><button>Start exploring <ArrowRight size={16} /></button></div>
          <p className="copyright">© 2026 Book My Room. Crafted for journeys across Bangladesh.</p>
        </footer>
      </div>
    </main>
  );
}
