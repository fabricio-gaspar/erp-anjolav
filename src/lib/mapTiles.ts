const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const DEFAULT_MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const configuredTileUrl = import.meta.env.VITE_MAP_TILE_URL?.trim();
const configuredTileKey = import.meta.env.VITE_MAP_TILE_KEY?.trim();

export const mapStyleUrl = import.meta.env.VITE_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE_URL;

export const mapTileUrl = configuredTileUrl && configuredTileKey
  ? `${configuredTileUrl}${configuredTileUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(configuredTileKey)}`
  : configuredTileUrl || null;

export const mapTileAttribution =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() || DEFAULT_MAP_TILE_ATTRIBUTION;
