import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { MapPin, Building2 } from "lucide-react";

interface MiniMapaEntregaProps {
  clienteLatitude?: number | null;
  clienteLongitude?: number | null;
  clienteNome?: string;
  clienteEndereco?: string;
  altura?: string;
}

// Custom icons
const empresaIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="
    background: hsl(var(--primary));
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
      <path d="M10 6h4"/>
      <path d="M10 10h4"/>
      <path d="M10 14h4"/>
      <path d="M10 18h4"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const clienteIcon = new L.DivIcon({
  className: "custom-marker",
  html: `<div style="
    background: hsl(var(--destructive));
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

export function MiniMapaEntrega({
  clienteLatitude,
  clienteLongitude,
  clienteNome,
  clienteEndereco,
  altura = "200px",
}: MiniMapaEntregaProps) {
  const { configuracao } = useConfiguracoesGerais();

  const empresaLat = configuracao?.endereco_latitude || -23.5505;
  const empresaLng = configuracao?.endereco_longitude || -46.6333;
  const empresaNome = configuracao?.nome_empresa || "Empresa";

  const hasClienteLocation = clienteLatitude && clienteLongitude;

  const center = useMemo(() => {
    if (hasClienteLocation) {
      return [
        (empresaLat + clienteLatitude) / 2,
        (empresaLng + clienteLongitude) / 2,
      ] as [number, number];
    }
    return [empresaLat, empresaLng] as [number, number];
  }, [empresaLat, empresaLng, clienteLatitude, clienteLongitude, hasClienteLocation]);

  const zoom = useMemo(() => {
    if (!hasClienteLocation) return 14;
    
    const latDiff = Math.abs(empresaLat - clienteLatitude!);
    const lngDiff = Math.abs(empresaLng - clienteLongitude!);
    const maxDiff = Math.max(latDiff, lngDiff);
    
    if (maxDiff > 0.5) return 10;
    if (maxDiff > 0.2) return 11;
    if (maxDiff > 0.1) return 12;
    if (maxDiff > 0.05) return 13;
    return 14;
  }, [empresaLat, empresaLng, clienteLatitude, clienteLongitude, hasClienteLocation]);

  // Calcular distância aproximada
  const distanciaKm = useMemo(() => {
    if (!hasClienteLocation) return null;
    
    const R = 6371; // Raio da Terra em km
    const dLat = (clienteLatitude! - empresaLat) * Math.PI / 180;
    const dLon = (clienteLongitude! - empresaLng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(empresaLat * Math.PI / 180) * Math.cos(clienteLatitude! * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, [empresaLat, empresaLng, clienteLatitude, clienteLongitude, hasClienteLocation]);

  if (!hasClienteLocation) {
    return (
      <div 
        className="bg-muted/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground"
        style={{ height: altura }}
      >
        <MapPin className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Localização do cliente não disponível</p>
        <p className="text-xs">Cadastre o endereço com coordenadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        className="rounded-lg overflow-hidden border"
        style={{ height: altura }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Marcador da empresa */}
          <Marker position={[empresaLat, empresaLng]} icon={empresaIcon}>
            <Popup>
              <div className="text-center">
                <Building2 className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="font-semibold text-sm">{empresaNome}</p>
                <p className="text-xs text-muted-foreground">Origem</p>
              </div>
            </Popup>
          </Marker>
          
          {/* Marcador do cliente */}
          <Marker 
            position={[clienteLatitude, clienteLongitude]} 
            icon={clienteIcon}
          >
            <Popup>
              <div className="text-center">
                <MapPin className="w-4 h-4 mx-auto mb-1 text-destructive" />
                <p className="font-semibold text-sm">{clienteNome || "Cliente"}</p>
                {clienteEndereco && (
                  <p className="text-xs text-muted-foreground">{clienteEndereco}</p>
                )}
              </div>
            </Popup>
          </Marker>
          
          {/* Linha conectando os pontos */}
          <Polyline
            positions={[
              [empresaLat, empresaLng],
              [clienteLatitude, clienteLongitude],
            ]}
            color="hsl(var(--primary))"
            weight={3}
            opacity={0.7}
            dashArray="10, 10"
          />
        </MapContainer>
      </div>
      
      {/* Info de distância */}
      {distanciaKm !== null && (
        <div className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
          <span className="text-muted-foreground">Distância estimada:</span>
          <span className="font-medium text-primary">
            {distanciaKm < 1 
              ? `${Math.round(distanciaKm * 1000)}m` 
              : `${distanciaKm.toFixed(1)}km`}
          </span>
        </div>
      )}
    </div>
  );
}
