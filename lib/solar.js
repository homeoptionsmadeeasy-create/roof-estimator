// Google Geocoding + Solar API (buildingInsights) → normalized roof measurements.
const fs = require('fs');
const path = require('path');
const { normalize, haversineM, mockSvg } = require('../public/shared');

const cache = new Map(); // key: rounded lat,lng → { at, insights }  (Solar ToS allows caching up to 30 days)
const CACHE_MS = 30 * 24 * 3600 * 1000;

function isMock() {
  return process.env.MOCK_SOLAR === '1' || !process.env.GOOGLE_API_KEY;
}

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function geocode(address) {
  if (isMock()) {
    return {
      lat: 32.7767, lng: -96.797,
      formatted: address,
      components: { street: address.split(',')[0] || address, city: 'Dallas', state: 'TX', zip: '75201' },
    };
  }
  const url = 'https://maps.googleapis.com/maps/api/geocode/json?' + new URLSearchParams({
    address, key: process.env.GOOGLE_API_KEY, components: process.env.GEOCODE_COUNTRY ? `country:${process.env.GEOCODE_COUNTRY}` : '',
  });
  const { body } = await getJson(url);
  if (body.status !== 'OK' || !body.results?.length) return null;
  const r = body.results[0];
  const get = (type, short) => {
    const c = r.address_components.find((c) => c.types.includes(type));
    return c ? (short ? c.short_name : c.long_name) : '';
  };
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address,
    precise: ['ROOFTOP', 'RANGE_INTERPOLATED'].includes(r.geometry.location_type),
    components: {
      street: [get('street_number'), get('route')].filter(Boolean).join(' '),
      city: get('locality') || get('sublocality') || get('postal_town'),
      state: get('administrative_area_level_1', true),
      zip: get('postal_code'),
    },
  };
}

async function buildingInsights(lat, lng, requiredQuality) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.insights;

  let insights;
  if (isMock()) {
    insights = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'mock-building.json'), 'utf8'));
  } else {
    const url = 'https://solar.googleapis.com/v1/buildingInsights:findClosest?' + new URLSearchParams({
      'location.latitude': lat, 'location.longitude': lng,
      requiredQuality: requiredQuality || 'LOW',
      key: process.env.GOOGLE_API_KEY,
    });
    const { status, body } = await getJson(url);
    if (status === 404) return null; // no coverage (not billed)
    if (status !== 200) throw new Error(`Solar API ${status}: ${body.error?.message || 'unknown error'}`);
    insights = body;
  }
  cache.set(key, { at: Date.now(), insights });
  return insights;
}


function staticMapUrl(m) {
  const bb = m.boundingBox;
  const params = new URLSearchParams({
    center: `${m.center.lat},${m.center.lng}`,
    size: '640x400', scale: '2', maptype: 'satellite',
    key: process.env.GOOGLE_API_KEY,
  });
  // Zoom to fit the building
  let zoom = 20;
  if (bb) {
    const w = haversineM({ lat: bb.sw.latitude, lng: bb.sw.longitude }, { lat: bb.sw.latitude, lng: bb.ne.longitude });
    const h = haversineM({ lat: bb.sw.latitude, lng: bb.sw.longitude }, { lat: bb.ne.latitude, lng: bb.sw.longitude });
    const span = Math.max(w, h * 1.6);
    zoom = span > 70 ? 18 : span > 35 ? 19 : 20;
  }
  params.set('zoom', String(zoom));
  let url = 'https://maps.googleapis.com/maps/api/staticmap?' + params.toString();
  // Outline each roof plane
  for (const s of m.segments.slice(0, 25)) {
    if (!s.box) continue;
    const { sw, ne } = s.box;
    const pts = [[sw.latitude, sw.longitude], [sw.latitude, ne.longitude], [ne.latitude, ne.longitude], [ne.latitude, sw.longitude], [sw.latitude, sw.longitude]];
    url += '&path=' + encodeURIComponent('color:0xff7a1acc|weight:2|fillcolor:0xff7a1a22|' + pts.map((p) => p.map((n) => n.toFixed(7)).join(',')).join('|'));
  }
  return url;
}


module.exports = { geocode, buildingInsights, normalize, staticMapUrl, mockSvg, isMock };
