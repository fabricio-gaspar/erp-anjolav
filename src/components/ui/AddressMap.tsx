import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline, Popup, Tooltip } from "react-leaflet";
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
  clientName?: string;
  companyName?: string;
  distanceKm?: number | null;
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
  altText,
  tooltipText,
  popupContent,
}: {
  position: [number, number];
  onPositionChange?: (lat: number, lng: number) => void;
  draggable?: boolean;
  icon?: L.Icon;
  altText?: string;
  tooltipText?: string;
  popupContent?: React.ReactNode;
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
      alt={altText}
      title={altText}
    >
      {tooltipText && (
        <Tooltip direction="top" offset={[0, -35]} permanent={false}>
          {tooltipText}
        </Tooltip>
      )}
      {popupContent && <Popup>{popupContent}</Popup>}
    </Marker>
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
  clientName = "Cliente",
  companyName = "Empresa",
  distanceKm,
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

  // Formatar distância para exibição
  const formatDistance = (km: number | null | undefined): string => {
    if (km === null || km === undefined) return "";
    if (km < 1) return `${(km * 1000).toFixed(0)} metros`;
    return `${km.toFixed(1)} km`;
  };

  return (
    <div 
      className="relative rounded-lg overflow-hidden border" 
      style={{ height }}
      role="application"
      aria-label="Mapa de localização"
    >
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
        
        {/* Marcador da empresa (azul) - Acessível */}
        {showCompanyMarker && hasCompanyCoordinates && (
          <Marker 
            position={[companyLatitude, companyLongitude]} 
            icon={companyIcon}
            alt={companyName}
            title={companyName}
          >
            <Tooltip direction="top" offset={[0, -35]} permanent={false}>
              🏢 {companyName}
            </Tooltip>
            <Popup>
              <div className="text-center">
                <strong className="text-blue-600">🏢 {companyName}</strong>
                <p className="text-xs text-gray-600 mt-1">Ponto de referência</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Marcador do cliente (vermelho, arrastável) - Acessível */}
        {hasCoordinates && (
          <>
            {!showBothMarkers && <MapCenterUpdater lat={latitude} lng={longitude} />}
            <DraggableMarker
              position={[latitude, longitude]}
              onPositionChange={onPositionChange}
              draggable={draggable}
              icon={showCompanyMarker ? clientIcon : defaultIcon}
              altText={clientName}
              tooltipText={`📍 ${clientName}`}
              popupContent={
                <div className="text-center min-w-[150px]">
                  <strong className="text-red-600">📍 {clientName}</strong>
                  {distanceKm !== null && distanceKm !== undefined && (
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>Distância:</strong> {formatDistance(distanceKm)} da empresa
                    </p>
                  )}
                  {draggable && (
                    <p className="text-xs text-gray-500 mt-2 italic">
                      Arraste para ajustar posição
                    </p>
                  )}
                </div>
              }
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
            weight={3}
            dashArray="8, 12"
            opacity={0.8}
          >
            <Tooltip sticky>
              {distanceKm !== null && distanceKm !== undefined 
                ? `📏 Distância: ${formatDistance(distanceKm)}`
                : "Rota empresa → cliente"
              }
            </Tooltip>
          </Polyline>
        )}
        
        {onPositionChange && <MapClickHandler onPositionChange={onPositionChange} />}
      </MapContainer>
      
      {/* Legenda sobreposta no mapa */}
      {showBothMarkers && (
        <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-gray-900/95 rounded-lg shadow-lg p-3 z-[1000] text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow" />
              <span className="font-medium">{companyName}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow" />
              <span className="font-medium">{clientName}</span>
            </div>
            {distanceKm !== null && distanceKm !== undefined && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-500">📏</span>
                <span className="font-semibold text-primary">{formatDistance(distanceKm)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
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
