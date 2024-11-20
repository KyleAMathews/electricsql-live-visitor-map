import React, { useEffect, useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { Tooltip } from "react-tooltip";
import { useShape } from "@electric-sql/react";
import { v4 as uuidv4 } from "uuid";

interface Visitor {
  id: string;
  visitor_id: string;
  latitude: string | number;
  longitude: string | number;
  country: string;
  city: string;
  visit_count: number;
  last_seen: string;
}

interface Cluster {
  latitude: number;
  longitude: number;
  visitors: Visitor[];
  totalVisits: number;
}

function getGridSize(zoom: number): number {
  if (zoom <= 1) return 20; // World view
  if (zoom <= 2) return 10; // Continental view
  if (zoom <= 4) return 5;  // Country view
  return 2; // City view
}

function createClusters(visitors: Visitor[], zoom: number): Cluster[] {
  // Debug log the input data
  console.log("Raw visitors data:", visitors);

  const grid: { [key: string]: Visitor[] } = {};
  const gridSize = getGridSize(zoom);

  // Assign visitors to grid cells
  visitors.forEach((visitor) => {
    // Convert string coordinates to numbers
    const lat =
      typeof visitor.latitude === "string"
        ? parseFloat(visitor.latitude)
        : visitor.latitude;
    const lon =
      typeof visitor.longitude === "string"
        ? parseFloat(visitor.longitude)
        : visitor.longitude;

    // Ensure we have valid coordinates
    if (isNaN(lat) || isNaN(lon)) {
      console.warn("Invalid coordinates for visitor:", visitor);
      return;
    }

    const gridLat = Math.floor(lat / gridSize) * gridSize;
    const gridLon = Math.floor(lon / gridSize) * gridSize;
    const key = `${gridLat},${gridLon}`;

    if (!grid[key]) {
      grid[key] = [];
    }
    grid[key].push({
      ...visitor,
      latitude: lat,
      longitude: lon,
    });
  });

  // Convert grid cells to clusters
  const clusters = Object.entries(grid).map(([key, cellVisitors]) => {
    const avgLat =
      cellVisitors.reduce((sum, v) => {
        const lat =
          typeof v.latitude === "string" ? parseFloat(v.latitude) : v.latitude;
        return sum + lat;
      }, 0) / cellVisitors.length;

    const avgLon =
      cellVisitors.reduce((sum, v) => {
        const lon =
          typeof v.longitude === "string"
            ? parseFloat(v.longitude)
            : v.longitude;
        return sum + lon;
      }, 0) / cellVisitors.length;

    const totalVisits = cellVisitors.reduce(
      (sum, v) => sum + (v.visit_count || 1),
      0,
    );

    return {
      latitude: avgLat,
      longitude: avgLon,
      visitors: cellVisitors,
      totalVisits,
    };
  });

  // Debug log the output clusters
  console.log("Generated clusters:", clusters);

  return clusters;
}

function getMarkerSize(totalVisits: number, zoom: number): number {
  // Base size calculation
  const baseSize = Math.max(4, Math.min(20, Math.log2(totalVisits) * 2));
  // Adjust for zoom to maintain screen-relative size
  return baseSize / zoom;
}

function getClusterTooltip(cluster: Cluster): string {
  const cities = [...new Set(cluster.visitors.map((v) => v.city))];
  const countries = [...new Set(cluster.visitors.map((v) => v.country))];
  return `${cluster.visitors.length} visitor${cluster.visitors.length === 1 ? "" : "s"
    } from ${cities.join(", ")}, ${countries.join(", ")}`;
}

function getVisitorId(): string {
  let id = localStorage.getItem("visitorId");
  if (!id) {
    id = uuidv4();
    localStorage.setItem("visitorId", id);
  }
  return id;
}

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

export const VisitorMap: React.FC = () => {
  const [visitorId, setVisitorId] = useState("");
  const [tooltipContent, setTooltipContent] = useState("");
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  console.log({ visitorId });
  const { data: visitors = [], isLoading } = useShape<Visitor>({
    url: "http://localhost:5010/api/visitors/shape",
  });

  const clusters = useMemo(() => createClusters(visitors, zoom), [visitors, zoom]);

  useEffect(() => {
    setVisitorId(getVisitorId());
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!visitors) {
    return <div>No visitors data available</div>;
  }

  if (!visitorId) {
    return <div>No visitor ID found</div>;
  }
  console.log(`hijkjj`);
  return (
    <div className="w-full h-screen bg-gray-900">
      <Tooltip id="visitor-tooltip" />
      <ComposableMap projection="geoMercator" className="w-full h-full">
        <ZoomableGroup
          center={center}
          zoom={zoom}
          onMoveEnd={({ coordinates, zoom: newZoom }) => {
            setCenter(coordinates);
            setZoom(newZoom);
          }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#2C3E50"
                  stroke="#FFFFFF"
                  strokeWidth={0.5}
                  style={{
                    default: {
                      outline: "none",
                    },
                    hover: {
                      outline: "none",
                    },
                    pressed: {
                      outline: "none",
                    },
                  }}
                />
              ))
            }
          </Geographies>
          {clusters.map((cluster, i) => (
            <Marker
              key={`cluster-${i}`}
              coordinates={[cluster.longitude, cluster.latitude]}
              data-tooltip-id="visitor-tooltip"
              data-tooltip-content={getClusterTooltip(cluster)}
              onMouseEnter={() => {
                setTooltipContent(getClusterTooltip(cluster));
              }}
              onMouseLeave={() => {
                setTooltipContent("");
              }}
            >
              <circle
                r={getMarkerSize(cluster.totalVisits, zoom)}
                fill="#F1C40F"
                fillOpacity={0.6}
                stroke="#F1C40F"
                strokeWidth={2 / zoom} // Scale stroke width with zoom
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};
