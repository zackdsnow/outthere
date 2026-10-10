const $ = (id) => document.getElementById(id);
const grid = $("eventGrid");
const locationInput = $("locationInput");
const keywordInput = $("keywordInput");
const dateFilter = $("dateFilter");
let activeCategory = "All";
let listMode = false;
let toastTimer;
let lastSearch = null;
let currentEvents = [];
let nextPage = 0;
let totalEvents = 0;
const categoryColors = { Music: "music", Sports: "sports", Food: "food", Outdoors: "outdoors", Arts: "arts", Free: "free", Miscellaneous: "arts" };

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3500);
}
function eventDate(event) {
  const raw = event?.dates?.start?.dateTime || event?.dates?.start?.localDate;
  if (!raw) return { day: "—", month: "DATE" };
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(date.getTime())) return { day: "—", month: "DATE" };
  return { day: date.getDate(), month: date.toLocaleString("en-US", { month: "short" }).toUpperCase() };
}
function eventCategory(event) {
  const cls = event?.classifications?.find((c) => c.segment?.name && c.segment.name !== "Undefined")?.segment?.name || "Events";
  if (/music/i.test(cls)) return "Music";
  if (/food/i.test(cls)) return "Food";
  if (/arts|theatre|theater/i.test(cls)) return "Arts";
  if (/sport/i.test(cls)) return "Sports";
  return cls;
}
function eventPrice(event) {
  const ranges = event?.priceRanges;
  if (!ranges?.length) return "See ticket details";
  const low = ranges[0].min, high = ranges[0].max, currency = ranges[0].currency || "USD";
  if (low === 0 && high === 0) return "Free";
  try {
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
    return low === high ? fmt.format(low) : `${fmt.format(low)}–${fmt.format(high)}`;
  } catch { return "See ticket details"; }
}
function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function renderEvents() {
  if (!currentEvents.length) {
    grid.innerHTML = "";
    $("resultCount").textContent = lastSearch ? "0 events found" : "Enter a ZIP code to find real events near you";
    $("emptyState").classList.remove("hidden");
    $("loadMoreButton").classList.add("hidden");
    return;
  }
  $("emptyState").classList.add("hidden");
  grid.innerHTML = currentEvents.map((event) => {
    const d = eventDate(event);
    const cat = eventCategory(event);
    const venue = event?._embedded?.venues?.[0];
    const venueName = venue?.name || "Venue details online";
    const city = [venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", ");
    const time = event?.dates?.start?.localTime ? new Date(`2000-01-01T${event.dates.start.localTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Time varies";
    const image = event?.images?.slice().sort((a,b) => (b.width || 0) - (a.width || 0)).find((img) => img.ratio === "16_9")?.url || event?.images?.[0]?.url;
    const art = categoryColors[cat] || "arts";
    const badge = event?.dates?.status?.code === "onsale" ? "ON SALE" : cat.toUpperCase();
    return `<article class="event-card"><div class="event-art art-${art}" ${image ? `style="background-image:linear-gradient(180deg,rgba(15,8,35,.05),rgba(15,8,35,.58)),url('${safeText(image)}')"` : ""}><div class="event-date"><small>${safeText(d.month)}</small><b>${safeText(d.day)}</b></div><span class="event-badge">${safeText(badge)}</span><div class="art-symbol" aria-hidden="true">✦</div></div><div class="event-body"><span class="event-category">${safeText(cat)}</span><h3>${safeText(event.name || "Live event")}</h3><p class="event-description">${safeText(event.info || event.pleaseNote || "Explore event details, tickets, and venue information on Ticketmaster.")}</p><div class="event-meta"><span>◷ ${safeText(time)}</span><span>⌖ ${safeText(venueName)}${city ? ` · ${safeText(city)}` : ""}</span></div><div class="event-footer"><span class="event-price">${safeText(eventPrice(event))}</span><a class="event-link" href="${safeText(event.url || "https://www.ticketmaster.com/")}" target="_blank" rel="noopener noreferrer">Tickets & details ↗</a></div></div></article>`;
  }).join("");
  grid.classList.toggle("list-mode", listMode);
  $("resultCount").textContent = `${currentEvents.length} of ${totalEvents} ${totalEvents === 1 ? "event" : "events"} near ${lastSearch?.postalCode || "you"}`;
  $("loadMoreButton").classList.toggle("hidden", currentEvents.length >= totalEvents || currentEvents.length === 0);
}
async function searchEvents({ append = false } = {}) {
  const postalCode = locationInput.value.trim();
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    locationInput.focus();
    toast("Enter a valid 5-digit ZIP code first.");
    return;
  }
  const search = { postalCode, keyword: keywordInput.value.trim(), date: dateFilter.value, category: activeCategory, page: append ? nextPage : 0 };
  lastSearch = search;
  const button = $("searchButton");
  button.disabled = true;
  button.innerHTML = "Searching… <span>✦</span>";
  if (!append) {
    currentEvents = [];
    grid.innerHTML = "";
    $("resultCount").textContent = "Searching Ticketmaster…";
    $("emptyState").classList.add("hidden");
  }
  try {
    const params = new URLSearchParams({ postalCode: search.postalCode, keyword: search.keyword, date: search.date, category: search.category, page: String(search.page), radius: "25" });
    const response = await fetch(`/.netlify/functions/events?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Event search failed. Please try again.");
    const events = data.events || [];
    currentEvents = append ? currentEvents.concat(events) : events;
    totalEvents = Number(data.page?.totalElements ?? currentEvents.length);
    nextPage = Number(data.page?.number ?? search.page) + 1;
    $("sourceLabel").textContent = "LIVE RESULTS · TICKETMASTER";
    renderEvents();
    if (!events.length) {
      $("resultCount").textContent = "No events found for that search";
      $("emptyState").classList.remove("hidden");
      $("emptyState").querySelector("h3").textContent = "Nothing matched this time.";
      $("emptyState").querySelector("p").textContent = "Try a different keyword, category, date, or nearby ZIP code.";
    }
    if (!append) {
      $("weekend").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    if (!append) {
      currentEvents = [];
      renderEvents();
      $("weekend").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    toast(error.message || "Could not load events. Check your connection and try again.");
  } finally {
    button.disabled = false;
    button.innerHTML = 'Find events <span>→</span>';
  }
}
const rouletteCategoryMap = {
  "Music": "Music",
  "Sports": "Sports",
  "Food": "Food",
  "Outdoors": "Outdoors",
  "Arts": "Arts",
  "Nightlife": "Music"
};

function rouletteEventPrice(event) {
  const range = event?.priceRanges?.[0];
  if (!range || typeof range.min !== "number" || typeof range.max !== "number") return null;
  return { min: range.min, max: range.max, currency: range.currency || "USD" };
}

function isWithinRouletteBudget(event, budget) {
  const price = rouletteEventPrice(event);
  if (budget === "free") return Boolean(price && price.min === 0 && price.max === 0);
  if (!price) return false;
  return price.min <= Number(budget) && price.max <= Number(budget);
}

function rouletteEventDateLabel(event) {
  const start = event?.dates?.start;
  if (!start?.localDate) return "Date not confirmed";
  const date = new Date(`${start.localDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Date not confirmed";
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (!start.localTime) return day;
  const time = new Date(`2000-01-01T${start.localTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

function rouletteFallbackPlan(vibe, budget, radius) {
  const suggestions = {
    "Music": ["Make a mini playlist for the trip", "Look for a free public music performance nearby", "End with a sunset walk and trade favorite songs"],
    "Sports": ["Find a public park with courts or open space", "Try a casual skills challenge with friends", "Pick a local team and check its official schedule"],
    "Food": ["Create a $0 snack picnic from food you already have", "Explore a public market area without buying anything", "Rate the best-looking menus and save a spot for later"],
    "Outdoors": ["Explore a public park or waterfront path", "Try a photo scavenger hunt with five nature details", "Find a comfortable spot for a sunset break"],
    "Arts": ["Look for public murals or outdoor art", "Create a mini photo walk around interesting colors and shapes", "Check official local listings for free gallery or community events"],
    "Nightlife": ["Find a public evening event listed as free", "Take a walk through a lively public area", "Make a shared playlist for the ride home"],
    "Surprise me": ["Pick a nearby public park or walkable area", "Try a five-photo scavenger hunt", "Finish with a sunset or skyline view from a public spot"]
  };
  const steps = suggestions[vibe] || suggestions["Surprise me"];
  return `<div class="roulette-result-heading"><span class="pill-label">YOUR SAMPLE ADVENTURE</span><h3>Three ways to get out there.</h3><p>No confirmed free Ticketmaster event matched these settings, so here's an illustrative no-cost plan instead.</p></div>
    <div class="roulette-itinerary">
      <article class="roulette-stop"><span class="stop-number">01</span><div><span class="stop-type">ILLUSTRATIVE IDEA</span><h4>Start exploring</h4><p>${safeText(steps[0])}</p></div></article>
      <article class="roulette-stop"><span class="stop-number">02</span><div><span class="stop-type">MINI CHALLENGE</span><h4>Make it an adventure</h4><p>${safeText(steps[1])}</p></div></article>
      <article class="roulette-stop"><span class="stop-number">03</span><div><span class="stop-type">THE FINALE</span><h4>End on a high note</h4><p>${safeText(steps[2])}</p></div></article>
    </div>
    <p class="roulette-note">These are activity ideas only. They are not verified specific places, events, hours, or directions. Check local rules and opening hours before heading out. Radius selected: ${safeText(radius)} miles.</p>
    <button class="secondary-button roulette-search-link" id="rouletteTryEvents">Try these settings in event search ↓</button>`;
}

async function spinOutThereRoulette() {
  const postalCode = locationInput.value.trim();
  const budget = $("rouletteBudget").value;
  const chosenVibe = $("rouletteVibe").value;
  const radius = $("rouletteRadius").value;
  const date = $("rouletteDate").value;
  const results = $("rouletteResults");
  const button = $("spinRoulette");

  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    locationInput.focus();
    toast("Enter your ZIP code in the main search first, then spin Roulette.");
    return;
  }

  const category = chosenVibe === "Surprise me"
    ? ["Music", "Sports", "Food", "Outdoors", "Arts"][Math.floor(Math.random() * 5)]
    : chosenVibe;
  const categoryForApi = rouletteCategoryMap[category] || "All";
  button.disabled = true;
  wheel?.classList.remove("spinning");
  void wheel?.offsetWidth;
  wheel?.classList.add("spinning");
  const wheelSpinFinished = new Promise((resolve) => setTimeout(resolve, 3200));
  button.innerHTML = "Spinning… <span>✦</span>";
  results.innerHTML = `<div class="roulette-loading"><span class="roulette-spinner">✦</span><strong>The wheel is spinning…</strong><p>Finding a surprise and checking live listings.</p></div>`;

  try {
    const params = new URLSearchParams({
      postalCode,
      keyword: "",
      date,
      category: categoryForApi,
      page: "0",
      radius
    });
    const response = await fetch(`/.netlify/functions/events?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Roulette couldn't load events right now.");

    const liveEvents = (data.events || []).filter((event) => isWithinRouletteBudget(event, budget));
    await wheelSpinFinished;
    wheel?.classList.remove("spinning");
    if (!liveEvents.length) {
      results.innerHTML = rouletteFallbackPlan(chosenVibe, budget, radius);
      const tryButton = $("rouletteTryEvents");
      if (tryButton) tryButton.addEventListener("click", () => {
        activeCategory = categoryForApi;
        dateFilter.value = date;
        keywordInput.value = "";
        document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.category === categoryForApi));
        searchEvents();
      });
      return;
    }

    const event = liveEvents[Math.floor(Math.random() * liveEvents.length)];
    const venue = event?._embedded?.venues?.[0];
    const venueLabel = [venue?.name, venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", ") || "Check the event listing for venue details";
    const image = event?.images?.slice().sort((a,b) => (b.width || 0) - (a.width || 0)).find((img) => img.ratio === "16_9")?.url || event?.images?.[0]?.url;
    const price = rouletteEventPrice(event);
    const priceLabel = price ? (price.min === 0 && price.max === 0 ? "Listed as free ($0)" : `${eventPrice(event)} · within your selected budget`) : "Price not verified";
    const extraSteps = chosenVibe === "Outdoors"
      ? ["Arrive a little early and explore the surrounding public area", "Take a three-photo mini adventure before heading home"]
      : ["Pick a nearby public place for a short walk before the event", "Afterward, share your favorite moment and plan the next spin"];

    results.innerHTML = `<div class="roulette-result-heading"><span class="pill-label">YOUR ROULETTE PICK</span><h3>Tonight has a plan.</h3><p>Randomly selected from live Ticketmaster listings that matched your budget filter.</p></div>
      <article class="roulette-live-event">
        <div class="roulette-live-art" ${image ? `style="background-image:linear-gradient(180deg,rgba(18,8,37,.05),rgba(18,8,37,.45)),url('${safeText(image)}')"` : ""}><span class="verified-label">LIVE TICKETMASTER LISTING</span><span class="roulette-event-spark">✦</span></div>
        <div class="roulette-live-copy"><span class="event-category">${safeText(eventCategory(event))}</span><h4>${safeText(event.name || "Live event")}</h4><p class="roulette-meta">◷ ${safeText(rouletteEventDateLabel(event))}</p><p class="roulette-meta">⌖ ${safeText(venueLabel)}</p><p class="roulette-price">${safeText(priceLabel)}</p><a class="event-link" href="${safeText(event.url || "https://www.ticketmaster.com/")}" target="_blank" rel="noopener noreferrer">Check official event details ↗</a></div>
      </article>
      <div class="roulette-itinerary"><article class="roulette-stop"><span class="stop-number">02</span><div><span class="stop-type">SUGGESTED ACTIVITY</span><h4>Make a little detour</h4><p>${safeText(extraSteps[0])}</p></div></article><article class="roulette-stop"><span class="stop-number">03</span><div><span class="stop-type">THE FINALE</span><h4>Save the memory</h4><p>${safeText(extraSteps[1])}</p></div></article></div>
      <p class="roulette-note">The event listing is live data from Ticketmaster; availability, prices, and event details can change. The additional activity prompts are illustrative, not verified locations or directions. Radius searched: ${safeText(radius)} miles.</p>
      <button class="roulette-button roulette-again" id="spinAgain">Spin again ↻</button>`;
    $("spinAgain").addEventListener("click", spinOutThereRoulette);
  } catch (error) {
    await wheelSpinFinished;
    wheel?.classList.remove("spinning");
    results.innerHTML = `<div class="roulette-error"><strong>We hit a little bump.</strong><p>${safeText(error.message || "Please try again in a moment.")}</p><p>Your existing event search is still available above.</p></div>`;
  } finally {
    wheel?.classList.remove("spinning");
    button.disabled = false;
    button.innerHTML = "✦ Surprise me <span>→</span>";
  }
}

function setCategory(category) {
  activeCategory = category;
  document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("active", button.dataset.category === category));
  if (locationInput.value.trim()) searchEvents();
  else toast("Enter your ZIP code to search by category.");
}
document.querySelectorAll(".filter-chip").forEach((button) => button.addEventListener("click", () => setCategory(button.dataset.category)));
document.querySelectorAll(".quick-tag").forEach((button) => button.addEventListener("click", () => {
  const category = button.dataset.category;
  setCategory(category);
  if (category === "Free") keywordInput.value = "free";
  if (locationInput.value.trim()) searchEvents();
  $("weekend").scrollIntoView({ behavior: "smooth" });
}));
$("searchButton").addEventListener("click", () => searchEvents());
$("spinRoulette").addEventListener("click", spinOutThereRoulette);
[locationInput, keywordInput].forEach((input) => input.addEventListener("keydown", (event) => { if (event.key === "Enter") searchEvents(); }));
dateFilter.addEventListener("change", () => { if (locationInput.value.trim()) searchEvents(); });
$("loadMoreButton").addEventListener("click", () => searchEvents({ append: true }));
$("resetFilters").addEventListener("click", () => {
  locationInput.value = ""; keywordInput.value = ""; dateFilter.value = "all"; activeCategory = "All"; currentEvents = []; lastSearch = null; totalEvents = 0; nextPage = 0;
  document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("active", button.dataset.category === "All"));
  $("emptyState").querySelector("h3").textContent = "Your next plan is out there.";
  $("emptyState").querySelector("p").textContent = "Enter your ZIP code above to search real Ticketmaster events nearby.";
  $("sourceLabel").textContent = "POWERED BY TICKETMASTER";
  renderEvents();
});
$("gridView").addEventListener("click", () => { listMode = false; $("gridView").classList.add("active"); $("listView").classList.remove("active"); renderEvents(); });
$("listView").addEventListener("click", () => { listMode = true; $("listView").classList.add("active"); $("gridView").classList.remove("active"); renderEvents(); });
$("weekendButton").addEventListener("click", () => { toast("Launch reminder: create the official OutThere Instagram page, then link it here."); });
const dialog = $("sponsorDialog");
$("openSponsorForm").addEventListener("click", () => { if (dialog.showModal) dialog.showModal(); else toast("Please try opening this page in a newer browser."); });
$("sponsorForm").addEventListener("submit", (event) => { event.preventDefault(); $("sponsorMessage").textContent = "Demo preview only: this request has not been sent. Connect a secure backend before collecting real leads."; toast("Form tested! No information was sent or saved."); event.target.reset(); });
$("newsletterForm").addEventListener("submit", (event) => { event.preventDefault(); $("newsletterMessage").textContent = "Demo only — signup tested, but no email was saved or sent."; toast("Signup tested! Connect an email service before launch."); event.target.reset(); });
$("menuButton").addEventListener("click", () => { const nav = $("navLinks"), open = nav.classList.toggle("open"); $("menuButton").setAttribute("aria-expanded", String(open)); });
document.querySelectorAll("#navLinks a").forEach((link) => link.addEventListener("click", () => { $("navLinks").classList.remove("open"); $("menuButton").setAttribute("aria-expanded", "false"); }));
$("year").textContent = new Date().getFullYear();
renderEvents();
