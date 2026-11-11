import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyleUrl, mapTileAttribution, mapTileUrl } from "@/lib/mapTiles";

setWorkerUrl(workerUrl);

interface MapBaseLayerProps {
  onErrorChange?: (hasError: boolean) => void;
}

export function MapBaseLayer({ onErrorChange }: MapBaseLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (mapTileUrl) return;

    let loaded = false;
    let layer: ReturnType<typeof maplibreGL> | undefined;
    try {
      layer = maplibreGL({ style: mapStyleUrl });
      layer.addTo(map);
      const vectorMap = layer.getMaplibreMap();
      vectorMap.on("load", () => {
        loaded = true;
        onErrorChange?.(false);
      });
      vectorMap.on("error", () => {
        if (!loaded) onErrorChange?.(true);
      });
    } catch {
      onErrorChange?.(true);
    }

    return () => {
      if (layer) map.removeLayer(layer);
    };
  }, [map, onErrorChange]);

  if (!mapTileUrl) return null;

  return (
    <TileLayer
      attribution={mapTileAttribution}
      url={mapTileUrl}
      eventHandlers={{
        load: () => onErrorChange?.(false),
        tileerror: () => onErrorChange?.(true),
      }}
    />
  );
}
