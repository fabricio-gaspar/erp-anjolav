import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline } from "react-leaflet";
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

// Ícone azul para a empresa
const companyIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Ícone vermelho para o cliente
const clientIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
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
  companyLatitude?: number | null;
  companyLongitude?: number | null;
  showCompanyMarker?: boolean;
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

// Componente para ajustar bounds quando há dois marcadores
const MapBoundsUpdater = ({ 
  clientLat, 
  clientLng, 
  companyLat, 
  companyLng 
}: { 
  clientLat: number; 
  clientLng: number; 
  companyLat: number; 
  companyLng: number; 
}) => {
  const map = useMap();
  
  useEffect(() => {
    if (clientLat && clientLng && companyLat && companyLng) {
      const bounds = L.latLngBounds(
        [clientLat, clientLng],
        [companyLat, companyLng]
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [map, clientLat, clientLng, companyLat, companyLng]);
  
  return null;
};

// Componente do marcador arrastável
const DraggableMarker = ({
  position,
  onPositionChange,
  draggable = true,
  icon,
}: {
  position: [number, number];
  onPositionChange?: (lat: number, lng: number) => void;
  draggable?: boolean;
  icon?: L.Icon;
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
      icon={icon || clientIcon}
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
  companyLatitude,
  companyLongitude,
  showCompanyMarker = false,
  onPositionChange,
  draggable = true,
  height = "400px",
}: AddressMapProps) => {
  // Centro padrão: Brasil
  const defaultCenter: [number, number] = [-15.7801, -47.9292];
  const defaultZoom = 4;

  const hasCoordinates = latitude !== null && longitude !== null;
  const hasCompanyCoordinates = companyLatitude !== null && companyLongitude !== null;
  const showBothMarkers = showCompanyMarker && hasCompanyCoordinates && hasCoordinates;
  
  const center: [number, number] = hasCoordinates
    ? [latitude, longitude]
    : hasCompanyCoordinates && showCompanyMarker
    ? [companyLatitude, companyLongitude]
    : defaultCenter;
  const zoom = hasCoordinates || (hasCompanyCoordinates && showCompanyMarker) ? 16 : defaultZoom;

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
        
        {/* Marcador da empresa (azul) */}
        {showCompanyMarker && hasCompanyCoordinates && (
          <Marker 
            position={[companyLatitude, companyLongitude]} 
            icon={companyIcon}
          />
        )}
        
        {/* Marcador do cliente (vermelho, arrastável) */}
        {hasCoordinates && (
          <>
            {!showBothMarkers && <MapCenterUpdater lat={latitude} lng={longitude} />}
            <DraggableMarker
              position={[latitude, longitude]}
              onPositionChange={onPositionChange}
              draggable={draggable}
              icon={showCompanyMarker ? clientIcon : defaultIcon}
            />
          </>
        )}
        
        {/* Ajustar bounds quando há dois marcadores */}
        {showBothMarkers && (
          <MapBoundsUpdater
            clientLat={latitude}
            clientLng={longitude}
            companyLat={companyLatitude!}
            companyLng={companyLongitude!}
          />
        )}
        
        {/* Linha conectando empresa e cliente */}
        {showBothMarkers && (
          <Polyline
            positions={[
              [companyLatitude!, companyLongitude!],
              [latitude, longitude],
            ]}
            color="#3b82f6"
            weight={2}
            dashArray="5, 10"
            opacity={0.7}
          />
        )}
        
        {onPositionChange && <MapClickHandler onPositionChange={onPositionChange} />}
      </MapContainer>
      
      {/* Overlay quando não há coordenadas */}
      {!hasCoordinates && !showCompanyMarker && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 pointer-events-none">
          <p className="text-muted-foreground text-sm text-center px-4">
            Preencha o endereço para visualizar no mapa
          </p>
        </div>
      )}
    </div>
  );
};
