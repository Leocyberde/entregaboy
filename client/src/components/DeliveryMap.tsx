import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: "red" | "blue" | "green" | "orange" | "purple";
  popup?: string;
  icon?: "bike" | "marker"; // Tipo de ícone a exibir
}

export interface MapRoute {
  coordinates: [number, number][]; // [lng, lat] from OSRM
  color?: string;
}

interface DeliveryMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  route?: MapRoute;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

const ICON_COLORS: Record<string, string> = {
  red: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  blue: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  green: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  orange: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  purple: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
};

const BIKE_ICON_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI4IiBjeT0iMjQiIHI9IjYiIGZpbGw9IiMwMDAwIi8+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iNiIgZmlsbD0iIzAwMDAiLz48cGF0aCBkPSJNOCAxOEwxNiA4TDI0IDE4IiBzdHJva2U9IiMwMDAwIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=";

function createColorIcon(color: string = "blue"): L.Icon {
  return new L.Icon({
    iconUrl: ICON_COLORS[color] ?? ICON_COLORS.blue,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

function createBikeIcon(): L.Icon {
  return new L.Icon({
    iconUrl: BIKE_ICON_URL,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    shadowSize: [0, 0],
  });
}

export default function DeliveryMap({
  center = [-23.5505, -46.6333], // São Paulo default
  zoom = 13,
  markers = [],
  route,
  className = "",
  onMapClick,
}: DeliveryMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeRef = useRef<L.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (onMapClick) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center when it changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(center, zoom);
  }, [center[0], center[1], zoom]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(markers.map((m) => m.id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    for (const m of markers) {
      const existing = markersRef.current.get(m.id);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        if (m.popup) existing.setPopupContent(m.popup);
      } else {
        const icon = m.icon === "bike" ? createBikeIcon() : createColorIcon(m.color);
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        if (m.popup) marker.bindPopup(m.popup);
        if (m.label) marker.bindTooltip(m.label, { permanent: false });
        markersRef.current.set(m.id, marker);
      }
    }
  }, [markers]);

  // Update route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    if (route && route.coordinates.length >= 2) {
      // OSRM returns [lng, lat], Leaflet needs [lat, lng]
      const latlngs: [number, number][] = route.coordinates.map(([lng, lat]) => [lat, lng]);
      routeRef.current = L.polyline(latlngs, {
        color: route.color ?? "#E85D04",
        weight: 4,
        opacity: 0.8,
      }).addTo(map);

      map.fitBounds(routeRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [route]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[300px] rounded-lg overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
