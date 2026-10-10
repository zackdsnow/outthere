# OutThere — live event finder

A brighter, more compact, mobile-friendly OutThere event discovery site. Search by US ZIP code and optionally add a keyword, date, or category. Live event results come from Ticketmaster through a Netlify serverless function.

## Files
- `index.html` — page structure
- `style.css` — bright purple/pink/blue responsive design
- `script.js` — ZIP search, filters, event cards, Ticketmaster results
- `netlify/functions/events.mjs` — secure Ticketmaster API proxy
- `netlify.toml` — Netlify publish/function configuration

## Deploy on Netlify
1. Unzip this folder.
2. Upload the contents/folder to your Netlify site, or push the files to the GitHub repository connected to Netlify.
3. In Netlify, open **Site configuration → Environment variables** (sometimes shown under **Project configuration → Environment variables**).
4. Add an environment variable named `TICKETMASTER_API_KEY` and paste your Ticketmaster API key as its value. Do not paste the key into any HTML, CSS, or browser JavaScript file.
5. Trigger a fresh deploy so the function receives the environment variable.
6. Open the deployed site, enter a five-digit ZIP code, and select **Find events**.

## Important
- Do not share the API key or commit it to GitHub.
- The event search needs to run on Netlify because the browser should never receive the secret key.
- Ticketmaster results depend on Ticketmaster's current event catalog, API limits, and your API account permissions.
- The business sponsorship and newsletter forms are still demo-only; they do not send or save submissions.
- The function validates US ZIP codes and limits search radius to 1–200 miles.


Recent updates: the search now scrolls to results after successful searches, empty results, and request errors; Sports is available as a category filter; and the When menu includes This month. The hero uses a remotely hosted Unsplash concert-crowd photo as a background.
