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
import { useEffect, useRef, useState, type ReactNode } from "react";

const assets = {
  logo: "https://bookmyroom.site/wp-content/uploads/2026/06/Book-My-Room-Logo-1.png",
  hero: "https://bookmyroom.site/wp-content/uploads/2026/06/ptcosiky3tu.jpg",
  about: "https://bookmyroom.site/wp-content/uploads/2026/06/iupgeszsm_m-1.jpg",
  award: "https://bookmyroom.site/wp-content/uploads/2026/06/Nazimgarh-Garden-Resort-2.webp",
};

const stays = [
  {
    name: "Hotel 4",
    place: "Cox's Bazar, Chattogram",
    price: "৳0",
    image: "https://bookmyroom.site/wp-content/uploads/2026/08/Attractive-places-in-Kuakata-1.jpg",
    type: "Hotel",
    rating: "4.9",
  },
  {
    name: "Hotel 3",
    place: "Dhaka, Bangladesh",
    price: "৳1,000",
    image: "https://bookmyroom.site/wp-content/uploads/2026/08/Chattogram-Hilltop-Panorama-Apartment385140-0.jpg",
    type: "Apartment",
    rating: "4.8",
  },
  {
    name: "Hotel 2",
    place: "Dhaka, Bangladesh",
    price: "৳1,999",
    image: "https://bookmyroom.site/wp-content/uploads/2026/08/asfges.jpg",
    type: "Resort",
    rating: "4.7",
  },
  {
    name: "Hotel 1",
    place: "Dhaka, Bangladesh",
    price: "৳2,998",
    image: "https://bookmyroom.site/wp-content/uploads/2026/08/872397871.jpg",
    type: "Hotel",
    rating: "4.9",
  },
  {
    name: "Sundarbans Escape",
    place: "Khulna, Bangladesh",
    price: "৳4,500",
    image: "https://bookmyroom.site/wp-content/uploads/2026/07/Sundarbans.jpg",
    type: "Tour",
    rating: "4.8",
  },
  {
    name: "Saint Martin Retreat",
    place: "Saint Martin's Island",
    price: "৳5,900",
    image: "https://bookmyroom.site/wp-content/uploads/2026/07/Saint-Martins-Island.jpg",
    type: "Resort",
    rating: "4.9",
  },
];

const destinations = [
  ["Sundarbans", "https://bookmyroom.site/wp-content/uploads/2026/07/Sundarbans.jpg"],
  ["Sreemangal", "https://bookmyroom.site/wp-content/uploads/2026/07/Sreemangal.jpg"],
  ["Sajek Valley", "https://bookmyroom.site/wp-content/uploads/2026/07/Sajek-Valley-a.jpg"],
  ["Saint Martin", "https://bookmyroom.site/wp-content/uploads/2026/07/Saint-Martins-Island.jpg"],
  ["Ratargul", "https://bookmyroom.site/wp-content/uploads/2026/07/Ratargul-Swamp-Forest.jpg"],
];

const featureItems = [
  ["Local stays, thoughtfully picked", "Hotels and resorts across Bangladesh, selected for comfort and character.", Sparkles],
  ["Straightforward BDT pricing", "Clear local pricing helps you compare stays and plan with confidence.", Check],
  ["Hotels, tours & cars in one place", "Build the whole trip—from the room to the road—without switching platforms.", CarFront],
  ["Fast, secure reservations", "A simple booking flow designed to get you from searching to packing sooner.", ShieldCheck],
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

  const visibleStays = filter === "All" ? stays : stays.filter((stay) => stay.type === filter);

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
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (bookingRef.current && !bookingRef.current.contains(event.target as Node)) setActivePopup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePopup(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <main className="page-shell">
      <div className="site-frame">
        <header className="nav">
          <a className="brand" href="#home" aria-label="Book My Room home">
            <img src={assets.logo} alt="Book My Room" />
          </a>
          <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Primary navigation">
            <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
            <a href="#stays" onClick={() => setMenuOpen(false)}>Hotels</a>
            <a href="#destinations" onClick={() => setMenuOpen(false)}>Tours</a>
            <a href="#cars" onClick={() => setMenuOpen(false)}>Cars</a>
          </nav>
          <div className="nav-actions">
            <a className="partner-link" href="#footer">Become a Partner</a>
            <button className="dashboard-btn">Dashboard <ArrowRight size={15} /></button>
            <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </header>
        <section className="hero" id="home">
          <img className="hero-image" src={assets.hero} alt="A scenic Bangladesh travel destination" />
          <div className="hero-shade" />

          <div className="hero-copy stagger">
            <h1>Find your<br />Bangladesh sanctuary</h1>
          </div>

          <div className="booking-wrap" ref={bookingRef}>
            <div className="booking-tabs" role="tablist" aria-label="Booking type">
              {[
                ["Hotel", Hotel], ["Room", BedDouble], ["Tour", MapPin], ["Car", CarFront],
              ].map(([label, Icon]) => (
                <button key={label as string} className={activeTab === label ? "active" : ""} onClick={() => { setActiveTab(label as string); setActivePopup(null); }}>
                  <Icon size={16} /> {label as string}
                </button>
              ))}
            </div>
            <div className={activeTab === "Car" ? "booking-bar car-mode" : "booking-bar"}>
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
              <button type="button" className="search-btn"><Search size={18} /> Check availability</button>
            </div>

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
              {["All", "Apartment", "Resort", "Hotel", "Tour"].map((item) => (
                <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>
              ))}
            </div>
            <a href="https://bookmyroom.site/hotels/" target="_blank">See all stays <ArrowRight size={15} /></a>
          </div>
          <div className="stay-grid">
            {visibleStays.map((stay, index) => (
              <article className="stay-card" key={stay.name}>
                <img src={stay.image} alt={stay.name} />
                <div className="card-shade" />
                <button
                  className={liked.includes(index) ? "heart liked" : "heart"}
                  onClick={() => setLiked((current) => current.includes(index) ? current.filter((n) => n !== index) : [...current, index])}
                  aria-label={`Save ${stay.name}`}
                ><Heart size={17} /></button>
                <div className="card-content">
                  <span className="card-type">{stay.type}</span>
                  <h3>{stay.name}</h3>
                  <p><MapPin size={13} /> {stay.place}</p>
                  <div className="amenities"><span><Users />2–5 Guests</span><span><BedDouble />1–3 Beds</span></div>
                  <div className="price-row"><strong>{stay.price}<small>/night</small></strong><span><Star size={13} fill="currentColor" /> {stay.rating}</span></div>
                </div>
              </article>
            ))}
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
              <img className="collage-main" src={assets.about} alt="A beautiful Bangladesh destination" />
              <img className="collage-small" src={destinations[1][1]} alt="Sreemangal landscape" />
              <span className="rating-chip"><Star size={14} fill="currentColor" /> 4.9 average rating</span>
              <span className="booking-chip"><b>100+</b> places to discover</span>
            </div>
          </div>
        </section>

        <section className="destinations section" id="destinations">
          <div className="section-heading split">
            <div><span className="section-kicker">VACATION SPOTS</span><h2>Top destinations,<br />closer than you think.</h2></div>
            <div><p>From mangrove forests to tea-covered hills and coral islands, find a stay at the heart of Bangladesh&apos;s most remarkable places.</p><a href="https://bookmyroom.site/tours/" target="_blank">View all destinations <ArrowRight size={16} /></a></div>
          </div>
          <div className="destination-carousel">
            <div className="destination-strip" ref={destinationScrollRef}>
              {destinations.map(([name, image], index) => (
                <article className="destination-card featured" key={name}>
                  <img src={image} alt={name} />
                  <div className="destination-overlay" />
                  <span>0{index + 1}</span>
                  <h3>{name}</h3>
                  <button aria-label={`Explore ${name}`}><ArrowRight /></button>
                </article>
              ))}
            </div>
            <button type="button" className="carousel-control prev" onClick={() => scrollDestinations(-1)} aria-label="Previous destinations"><ChevronLeft /></button>
            <button type="button" className="carousel-control next" onClick={() => scrollDestinations(1)} aria-label="Next destinations"><ChevronRight /></button>
          </div>
        </section>

        <section className="award-section" id="cars">
          <img className="award-bg" src={assets.award} alt="A premium resort in Bangladesh" />
          <div className="award-shade" />
          <div className="award-copy">
            <span className="section-kicker light">PLAN THE WHOLE JOURNEY</span>
            <h2>Stay. Tour.<br />Drive. Discover.</h2>
            <p>Book a room, choose a guided experience, and add the right car—all from Book My Room.</p>
            <div className="mini-destinations">
              {destinations.slice(0, 4).map(([name, image], i) => <img className={i === 0 ? "selected" : ""} key={name} src={image} alt={name} />)}
            </div>
          </div>
          <div className="floating-booking">
            <img src="https://bookmyroom.site/wp-content/uploads/2024/12/Sedan-car.jpeg" alt="Sedan car" />
            <div className="floating-info"><span className="tiny-label">POPULAR RIDE</span><h3>Sedan Car</h3><p><Users size={13} /> 5 persons <span>·</span> 3 bags <span>·</span> Automatic</p><div><strong>৳120<small>/day</small></strong><span><Star size={13} fill="currentColor" /> 4.9</span></div><button>Book now <ArrowRight size={15} /></button></div>
          </div>
        </section>

        <section className="testimonial section">
          <svg className="scribble top" viewBox="0 0 700 160" aria-hidden="true"><path d="M-10 146c87-75 145-21 214-96 50-55 110 9 180-40 69-48 175 10 326-16" /></svg>
          <svg className="scribble bottom" viewBox="0 0 700 160" aria-hidden="true"><path d="M-10 146c87-75 145-21 214-96 50-55 110 9 180-40 69-48 175 10 326-16" /></svg>
          <div className="section-heading center compact"><span className="section-kicker">TRAVELER STORIES</span><h2>What our guests say</h2><p>Real journeys, warm stays and memories made across Bangladesh.</p></div>
          <blockquote>“Finding a stay for our Sylhet trip was effortless. The options were clear, the booking felt simple, and everything we needed was right there.”</blockquote>
          <div className="testimonial-nav"><button><ChevronLeft /></button><div className="guest-avatars"><img src="https://i.pravatar.cc/80?img=47" alt="Guest" /><img className="active" src="https://i.pravatar.cc/80?img=12" alt="Guest" /><img src="https://i.pravatar.cc/80?img=32" alt="Guest" /></div><button><ChevronRight /></button></div>
          <strong className="guest-name">Rakib Hasan</strong><span className="guest-place">Dhaka, Bangladesh</span><div className="stars">★★★★★</div>
        </section>

        <footer id="footer">
          <div className="footer-brand"><img src={assets.logo} alt="Book My Room" /><p>Your trusted starting point for stays, tours and drives across Bangladesh.</p></div>
          <div><span>Explore</span><a href="#stays">Hotels</a><a href="#destinations">Tours</a><a href="#cars">Cars</a></div>
          <div><span>Company</span><a href="#about">About us</a><a href="https://bookmyroom.site/" target="_blank">Original website</a><a href="#home">Become a partner</a></div>
          <div className="footer-cta"><span>Ready to go?</span><h3>Find your next stay.</h3><button>Start exploring <ArrowRight size={16} /></button></div>
          <p className="copyright">© 2026 Book My Room. Crafted for journeys across Bangladesh.</p>
        </footer>
      </div>
    </main>
  );
}
