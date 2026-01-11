import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in React-Leaflet
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface AddressMapProps {
  latitude: number | null;
  longitude: number | null;
  onPositionChange?: (lat: number, lng: number) => void;
  draggable?: boolean;
  height?: string;
}

// Componente para centralizar o mapa quando as coordenadas mudam
const MapCenterUpdater = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 16, { animate: true });
    }
  }, [map, lat, lng]);
  
  return null;
};

// Componente do marcador arrastável
const DraggableMarker = ({
  position,
  onPositionChange,
  draggable = true,
}: {
  position: [number, number];
  onPositionChange?: (lat: number, lng: number) => void;
  draggable?: boolean;
}) => {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker && onPositionChange) {
          const { lat, lng } = marker.getLatLng();
          onPositionChange(lat, lng);
        }
      },
    }),
    [onPositionChange]
  );

  return (
    <Marker
      draggable={draggable}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
};

// Componente para lidar com cliques no mapa
const MapClickHandler = ({
  onPositionChange,
}: {
  onPositionChange?: (lat: number, lng: number) => void;
}) => {
  useMapEvents({
    click(e) {
      if (onPositionChange) {
        onPositionChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const AddressMap = ({
  latitude,
  longitude,
  onPositionChange,
  draggable = true,
  height = "400px",
}: AddressMapProps) => {
  // Centro padrão: Brasil
  const defaultCenter: [number, number] = [-15.7801, -47.9292];
  const defaultZoom = 4;

  const hasCoordinates = latitude !== null && longitude !== null;
  const center: [number, number] = hasCoordinates
    ? [latitude, longitude]
    : defaultCenter;
  const zoom = hasCoordinates ? 16 : defaultZoom;

  return (
    <div className="relative rounded-lg overflow-hidden border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {hasCoordinates && (
          <>
            <MapCenterUpdater lat={latitude} lng={longitude} />
            <DraggableMarker
              position={[latitude, longitude]}
              onPositionChange={onPositionChange}
              draggable={draggable}
            />
          </>
        )}
        
        {onPositionChange && <MapClickHandler onPositionChange={onPositionChange} />}
      </MapContainer>
      
      {/* Overlay quando não há coordenadas */}
      {!hasCoordinates && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 pointer-events-none">
          <p className="text-muted-foreground text-sm text-center px-4">
            Preencha o endereço para visualizar no mapa
          </p>
        </div>
      )}
    </div>
  );
};
