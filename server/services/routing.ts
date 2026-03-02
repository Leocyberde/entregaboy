import axios from "axios";

// ─── Nominatim Geocoding ───────────────────────────────────────────────────────

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: address,
        format: "json",
        limit: 1,
        countrycodes: "br",
        addressdetails: 1,
      },
      headers: {
        "User-Agent": "MotoDelivery/1.0 (delivery-platform)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      timeout: 10000,
    });

    if (!response.data || response.data.length === 0) return null;

    const result = response.data[0];
    const addr = result.address;
    
    // Simplificar o endereço: rua, número, bairro, cidade, estado
    const street = addr.road || addr.street || addr.pedestrian || "";
    const houseNumber = addr.house_number || "";
    const neighborhood = addr.suburb || addr.neighbourhood || addr.village || "";
    const city = addr.city || addr.town || addr.municipality || "";
    const state = addr.state || "";

    const parts = [
      street + (houseNumber ? `, ${houseNumber}` : ""),
      neighborhood,
      city,
      state
    ].filter(Boolean);

    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: parts.join(", ") || result.display_name,
      street,
      number: houseNumber,
      neighborhood,
      city,
      state,
    };
  } catch (error) {
    console.error("[Geocoding] Error:", error);
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { lat, lon: lng, format: "json" },
      headers: {
        "User-Agent": "MotoDelivery/1.0 (delivery-platform)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      timeout: 10000,
    });
    return response.data?.display_name ?? null;
  } catch {
    return null;
  }
}

// ─── OSRM Route Calculation ───────────────────────────────────────────────────

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][]; // [lng, lat] pairs
}

// Public OSRM demo server — for production, host your own instance
const OSRM_BASE = "https://router.project-osrm.org";

export async function calculateRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult | null> {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`;
    const response = await axios.get(url, {
      params: {
        overview: "simplified",
        geometries: "geojson",
        steps: false,
      },
      timeout: 15000,
    });

    if (response.data.code !== "Ok" || !response.data.routes?.length) return null;

    const route = response.data.routes[0];
    // Aumentar a distância para aproximar do Waze (usando multiplicador 0.95 em vez de 0.85)
    const distanceKm = (route.distance / 1000) * 0.95; // meters → km com ajuste
    const durationMinutes = Math.ceil(route.duration / 60); // seconds → minutes

    const geometry: [number, number][] =
      route.geometry?.coordinates ?? [];

    return { distanceKm, durationMinutes, geometry };
  } catch (error) {
    console.error("[OSRM] Error calculating route:", error);
    // Fallback: straight-line distance (Haversine) com ajuste
    const dist = haversineDistance(fromLat, fromLng, toLat, toLng) * 0.95;
    return {
      distanceKm: dist,
      durationMinutes: Math.ceil((dist / 30) * 60), // assume 30 km/h average
      geometry: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
    };
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
