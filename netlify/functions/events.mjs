const API_URL = "https://app.ticketmaster.com/discovery/v2/events.json";

export default async (request) => {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Event search is not configured yet. Add TICKETMASTER_API_KEY in your Netlify environment variables, then redeploy." },
      { status: 500 }
    );
  }

  const incoming = new URL(request.url);
  const lat = Number(incoming.searchParams.get("lat"));
  const lon = Number(incoming.searchParams.get("lon"));
  const radius = Number(incoming.searchParams.get("radius") || 25);
  const page = Number(incoming.searchParams.get("page") || 0);
  const size = Number(incoming.searchParams.get("size") || 18);
  const keyword = (incoming.searchParams.get("keyword") || "").trim().slice(0, 100);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return Response.json({ error: "Please provide a valid ZIP code location." }, { status: 400 });
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    latlong: `${lat},${lon}`,
    radius: String(Math.min(100, Math.max(1, Number.isFinite(radius) ? radius : 25))),
    unit: "miles",
    page: String(Math.min(100, Math.max(0, Number.isInteger(page) ? page : 0))),
    size: String(Math.min(50, Math.max(1, Number.isInteger(size) ? size : 18))),
    sort: "date,asc"
  });
  if (keyword) params.set("keyword", keyword);

  try {
    const upstream = await fetch(`${API_URL}?${params.toString()}`);
    const data = await upstream.json();
    if (!upstream.ok) {
      const message = upstream.status === 401 || upstream.status === 403
        ? "Ticketmaster rejected the API key. Check the TICKETMASTER_API_KEY environment variable."
        : "Ticketmaster couldn't complete the event search. Please try again.";
      return Response.json({ error: message }, { status: upstream.status === 429 ? 429 : 502 });
    }
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return Response.json({ error: "Could not connect to the event service. Please try again." }, { status: 502 });
  }
};
