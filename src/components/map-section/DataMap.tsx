import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  useMap,
  useMarkerContext,
  type MapRef,
} from "@/components/ui/map";

import type { FlyRequest, RankedRegionStat } from "./types";

interface DataMapProps {
  rows: RankedRegionStat[];
  totalCount: number;
  maxValue: number;
  formatValue: (n: number) => string;
  valueLabel: string;
  hoveredId: string | null;
  selectedId: string | null;
  flyRequest: FlyRequest | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onPopupClosed: (id: string) => void;
}

const MIN_SIZE = 10;
const MAX_SIZE = 32;
const FOCUS_ZOOM = 11;
// Western Maharashtra, roughly centred on the store network.
const INITIAL_CENTER: [number, number] = [74.7, 17.5];

/** sqrt scale so marker *area* is proportional to value. */
function markerSize(value: number, maxValue: number): number {
  if (maxValue <= 0) return MIN_SIZE;
  const t = Math.sqrt(Math.max(0, value) / maxValue);
  return MIN_SIZE + (MAX_SIZE - MIN_SIZE) * t;
}

export function DataMap({
  rows,
  totalCount,
  maxValue,
  formatValue,
  valueLabel,
  hoveredId,
  selectedId,
  flyRequest,
  onHover,
  onSelect,
  onPopupClosed,
}: DataMapProps) {
  const mapRef = useRef<MapRef>(null);

  // Row click → fly to that marker.
  useEffect(() => {
    if (!flyRequest) return;
    const row = rows.find((r) => r.id === flyRequest.id);
    const map = mapRef.current;
    if (!row || !map) return;
    map.flyTo({
      center: [row.lng, row.lat],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      duration: 900,
      essential: true,
    });
    // Only react to new requests, not to row changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyRequest]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border">
      <Map ref={mapRef} center={INITIAL_CENTER} zoom={6.4} attributionControl={{ compact: true }}>
        <MapControls position="bottom-right" showZoom showLocate />
        <FitToRows rows={rows} />

        {rows.map((row) => {
          const size = markerSize(row.value, maxValue);
          const isActive = row.id === hoveredId || row.id === selectedId;
          return (
            <MapMarker
              key={row.id}
              longitude={row.lng}
              latitude={row.lat}
              onMouseEnter={() => onHover(row.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(row.id)}
            >
              <MarkerContent>
                <div
                  role="img"
                  aria-label={`${row.name}: ${formatValue(row.value)}`}
                  className={cn(
                    "rounded-full border-2 border-white/90 shadow-md transition-transform duration-150 ease-out",
                    isActive && "ring-primary/50 scale-125 ring-4",
                  )}
                  style={{ width: size, height: size, backgroundColor: row.color }}
                />
              </MarkerContent>
              <MarkerPopup closeButton offset={size / 2 + 8}>
                <div className="space-y-1.5 pr-4">
                  <p className="leading-snug font-semibold">{row.name}</p>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: row.color }}
                      aria-hidden
                    />
                    {row.category} · {row.city}
                  </p>
                  <div className="flex items-baseline justify-between gap-4 pt-1">
                    <span className="text-lg font-semibold tabular-nums">
                      {formatValue(row.value)}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      Rank #{row.rank} of {totalCount}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">{valueLabel}</p>
                </div>
              </MarkerPopup>
              <MarkerSync
                id={row.id}
                isActive={isActive}
                isSelected={row.id === selectedId}
                onPopupClosed={onPopupClosed}
              />
            </MapMarker>
          );
        })}
      </Map>
    </div>
  );
}

interface MarkerSyncProps {
  id: string;
  isActive: boolean;
  isSelected: boolean;
  onPopupClosed: (id: string) => void;
}

/**
 * Keeps a marker's popup and stacking order in step with the shared selection
 * state. Must render after <MarkerPopup> so the popup is attached first.
 */
function MarkerSync({ id, isActive, isSelected, onPopupClosed }: MarkerSyncProps) {
  const { marker } = useMarkerContext();
  const onClosedRef = useRef(onPopupClosed);
  useEffect(() => {
    onClosedRef.current = onPopupClosed;
  }, [onPopupClosed]);

  // Bring hovered/selected markers above their neighbours.
  useEffect(() => {
    marker.getElement().style.zIndex = isActive ? "10" : "";
  }, [marker, isActive]);

  // Open/close the popup when selection changes from outside the map.
  useEffect(() => {
    const popup = marker.getPopup();
    if (!popup) return;
    if (isSelected && !popup.isOpen()) marker.togglePopup();
    else if (!isSelected && popup.isOpen()) popup.remove();
  }, [marker, isSelected]);

  // Popup closed by the user (close button / map click) → clear selection.
  useEffect(() => {
    const popup = marker.getPopup();
    if (!popup) return;
    const handleClose = () => onClosedRef.current(id);
    popup.on("close", handleClose);
    return () => {
      popup.off("close", handleClose);
    };
  }, [marker, id]);

  return null;
}

/** Fits the camera to the visible markers whenever the visible set changes. */
function FitToRows({ rows }: { rows: RankedRegionStat[] }) {
  const { map, isLoaded } = useMap();
  const hasFitRef = useRef(false);
  const key = rows.map((r) => r.id).join("|");

  useEffect(() => {
    if (!map || !isLoaded || rows.length === 0) return;
    const duration = hasFitRef.current ? 700 : 0;
    hasFitRef.current = true;

    if (rows.length === 1) {
      map.flyTo({ center: [rows[0].lng, rows[0].lat], zoom: FOCUS_ZOOM, duration });
      return;
    }
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const r of rows) {
      minLng = Math.min(minLng, r.lng);
      minLat = Math.min(minLat, r.lat);
      maxLng = Math.max(maxLng, r.lng);
      maxLat = Math.max(maxLat, r.lat);
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 56, maxZoom: FOCUS_ZOOM, duration },
    );
    // `key` captures the visible set; `rows` identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, key]);

  return null;
}
