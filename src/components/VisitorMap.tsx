import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useShape } from "@electric-sql/react";
import { v4 as uuidv4 } from "uuid";
import * as TWEEN from "@tweenjs/tween.js";
import "../styles/animations.css";
import RecentVisitors from "./RecentVisitors";
import { Modal } from "./Modal";
import {
  AmbientLight,
  DirectionalLight,
  Fog,
} from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection } from 'geojson';
import countries from "world-atlas/countries-110m.json";

// Type the countries data and convert TopoJSON to GeoJSON
const typedCountries = countries as unknown as Topology<{
  countries: GeometryCollection;
  land: GeometryCollection;
}>;

const countryFeatures = feature(
  typedCountries,
  typedCountries.objects.countries
) as FeatureCollection;

type Visitor = {
  id: string;
  visitor_id: string;
  latitude: string | number;
  longitude: string | number;
  country: string;
  city: string;
  visit_count: number;
  last_seen: string;
};

interface Cluster {
  latitude: number;
  longitude: number;
  visitors: Visitor[];
  totalVisits: number;
  lastVisitTime?: number;
}

function calculateDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const earthRadius = 6371; // in kilometers
  const dLat = ((latitude2 - latitude1) * Math.PI) / 180;
  const dLon = ((longitude2 - longitude1) * Math.PI) / 180;
  const lat1Rad = (latitude1 * Math.PI) / 180;
  const lat2Rad = (latitude2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2) *
    Math.cos(lat1Rad) *
    Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  return distance;
}

function createClusters(visitors: Visitor[], zoomLevel: number): Cluster[] {
  if (visitors.length === 0) {
    return [];
  }

  // Convert visitors to points with parsed coordinates
  const points = visitors.map((visitor) => ({
    latitude: parseFloat(visitor.latitude as string),
    longitude: parseFloat(visitor.longitude as string),
    visitor,
  }));

  // Start with the first point as the initial cluster
  const clusters: Cluster[] = [{
    latitude: points[0].latitude,
    longitude: points[0].longitude,
    visitors: [points[0].visitor],
    totalVisits: points[0].visitor.visit_count || 1,
  }];

  // Fixed 50km radius for city-level clustering
  const radius = 50; // 50km radius

  // Try to add each remaining point to an existing cluster
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    let addedToCluster = false;

    for (const cluster of clusters) {
      const distance = calculateDistance(
        cluster.latitude,
        cluster.longitude,
        point.latitude,
        point.longitude,
      );

      if (distance <= radius) {
        // Add to existing cluster
        cluster.visitors.push(point.visitor);
        // Recalculate cluster center
        cluster.latitude = cluster.visitors.reduce(
          (sum, v) => sum + parseFloat(v.latitude as string),
          0,
        ) / cluster.visitors.length;
        cluster.longitude = cluster.visitors.reduce(
          (sum, v) => sum + parseFloat(v.longitude as string),
          0,
        ) / cluster.visitors.length;
        cluster.totalVisits = cluster.visitors.reduce(
          (sum, v) => sum + (v.visit_count || 1),
          0,
        );
        addedToCluster = true;
        break;
      }
    }

    if (!addedToCluster) {
      // Create new cluster
      clusters.push({
        latitude: point.latitude,
        longitude: point.longitude,
        visitors: [point.visitor],
        totalVisits: point.visitor.visit_count || 1,
      });
    }
  }

  console.log(`Created ${clusters.length} clusters from ${visitors.length} visitors`);
  clusters.forEach((cluster, i) => {
    console.log(`Cluster ${i + 1}: ${cluster.visitors.length} visitors at ${cluster.latitude}, ${cluster.longitude}`);
  });

  return clusters;
}

function getVisitorId(): string {
  let id = localStorage.getItem("visitorId");
  if (!id || id === ``) {
    id = uuidv4();
    localStorage.setItem("visitorId", id);
  }
  return id;
}

function VisitorMap() {
  // Ref to the globe instance for direct manipulation
  const globeRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<any>(null);

  // Basic component state
  const [isMounted, setIsMounted] = useState(false); // Tracks whether the component has finished mounting
  const [visitorId, setVisitorId] = useState(undefined); // Stores the unique visitor ID
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null); // Stores the currently selected cluster
  const [tooltipContent, setTooltipContent] = useState(""); // Stores the content of the tooltip
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 }); // Stores the position of the tooltip
  const [showTooltip, setShowTooltip] = useState(false); // Tracks whether the tooltip should be shown
  const [isMobile, setIsMobile] = useState(false); // Tracks whether the device is mobile
  const [zoomLevel, setZoomLevel] = useState(1); // Tracks the current zoom level
  const [globeInitialized, setGlobeInitialized] = useState(false); // Tracks when globe is fully initialized
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  // Fetch visitors data from the API
  const { data: visitors = [], isLoading } = useShape<Visitor>({
    url: `${import.meta.env.PUBLIC_API_URL}/api/visitors/shape`,
  }); // Fetches visitor data from the API

  // Memoized data transformations
  const clusters = useMemo(() => {
    console.log("Creating clusters from visitors:", visitors);
    return createClusters(visitors, zoomLevel);
  }, [visitors, zoomLevel]);

  const pointData = useMemo(() => {
    console.log("Recalculating point data");
    return clusters.map((cluster) => ({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      visit_count: cluster.totalVisits,
      city: cluster.visitors[0]?.city || 'Unknown City',
      country: cluster.visitors[0]?.country || 'Unknown Country',
      totalVisitors: cluster.visitors.length,
    }));
  }, [clusters]);

  // Initialize mounted state and visitor id
  useEffect(() => {
    setIsMounted(true);
    setVisitorId(getVisitorId())
  }, []);

  // Initialize the globe
  useEffect(() => {
    console.log('Globe initialization attempt:', { isMounted, hasGlobeRef: !!globeRef.current });
    if (!isMounted || !globeRef.current) return;

    Promise.all([
      import('globe.gl'),
      import('three')
    ]).then(([GlobeModule, THREE]) => {
      console.log('Successfully imported globe.gl and three.js');
      const Globe = GlobeModule.default;
      const world = Globe({
        animateIn: true,
        rendererConfig: {
          antialias: true,
          alpha: true
        }
      })(globeRef.current);

      // Store the Globe instance for updates
      globeInstanceRef.current = world;

      world
        // Set the globe height to fill the window
        .height(window.innerHeight)
        // Set transparent background
        .backgroundColor('rgba(255, 255, 255, 0)')
        // Configure the globe's material and appearance
        .globeMaterial(
          new THREE.MeshPhongMaterial({
            color: '#120f30',  // Dark blue color for the globe
            opacity: 0.7,      // Slightly transparent
            transparent: true,
          })
        )
        // Configure country polygons
        .polygonsData(countryFeatures.features)
        .polygonCapColor(() => '#2a2469')
        .polygonSideColor(() => '#2a2469')
        .polygonStrokeColor(() => '#1a1657')
        .polygonAltitude(0.01)

      // Configure globe controls
      const controls = world.controls();
      controls.autoRotate = true;          // Enable automatic rotation
      controls.enableZoom = false;         // Disable zooming
      controls.autoRotateSpeed = 0.2;      // Set rotation speed

      // Mark globe as initialized after all setup is complete
      setGlobeInitialized(true);
      console.log('Globe initialization complete');
    }).catch(error => {
      console.error('Failed to initialize globe:', error);
    });

    return () => {
      if (globeRef.current) {
        while (globeRef.current.firstChild) {
          globeRef.current.removeChild(globeRef.current.firstChild);
        }
        globeInstanceRef.current = null;
      }
    };
  }, [isMounted, globeRef.current]);

  // Update points data separately
  useEffect(() => {
    console.log('Points update attempt:', {
      hasGlobeInstance: !!globeInstanceRef.current,
      hasPointData: !!pointData,
      isGlobeInitialized: globeInitialized
    });
    if (!globeInstanceRef.current || !pointData || !globeInitialized) return;
    globeInstanceRef.current
      .pointsData(pointData)
      .pointLat(d => Number(d.latitude))
      .pointLng(d => Number(d.longitude))
      .pointAltitude(d => Math.min(0.8, Math.max(0.01, d.visit_count / 50)))
      .pointRadius(0.3)
      .pointColor(() => '#ff6090')
      .pointResolution(64)
      .pointsMerge(false)
      .pointsTransitionDuration(0)
      .enablePointerInteraction(true)
      .pointLabel(d => `
        <div style="text-align: center; color: white; background: rgba(0, 0, 0, 0.75); padding: 10px; border-radius: 5px;">
          <div>${(d as typeof pointData[0]).city}, ${(d as typeof pointData[0]).country}</div>
          <div>${(d as typeof pointData[0]).totalVisitors} visitor${(d as typeof pointData[0]).totalVisitors !== 1 ? 's' : ''}</div>
        </div>
      `);
  }, [pointData, globeInstanceRef.current, globeInitialized]);

  // Handle responsive layout changes
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Handles window resize events to update mobile state

  // Memoized event handlers
  const handleMouseMove = useCallback((event: MouseEvent) => {
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  }, []); // Memoizes the handleMouseMove event handler

  // Initialize globe position and setup tooltip tracking
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 39.6, lng: -98.5, altitude: 2.5 });

      // Use the memoized handler for mouse tracking
      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    }
  }, [handleMouseMove]); // Add handleMouseMove to dependencies

  // Setup camera controls and zoom level tracking
  useEffect(() => {
    if (globeRef.current) {
      const camera = globeRef.current.camera();
      const handleCameraChange = () => {
        const distance = camera.position.length();
        const maxDistance = 1000;
        const minDistance = 200;
        const normalizedZoom =
          1 - (distance - minDistance) / (maxDistance - minDistance);
        setZoomLevel(Math.max(0.1, Math.min(1, normalizedZoom)));
      };

      globeRef.current
        .controls()
        .addEventListener("change", handleCameraChange);
      return () => {
        if (globeRef.current) {
          globeRef.current
            .controls()
            .removeEventListener("change", handleCameraChange);
        }
      };
    }
  }, []); // Sets up camera controls and zoom level tracking on mount

  // Record new visitor on initial load
  useEffect(() => {
    if (!visitorId) return;

    fetch(`${import.meta.env.PUBLIC_API_URL}/api/record-visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        visitorId,
      }),
    }).catch(console.error);
  }, [visitorId]); // Records a new visitor on initial load

  // Log visitors data changes for debugging
  useEffect(() => {
    console.log("Visitors data updated:", {
      count: visitors.length,
      visitors: visitors.map((v) => ({
        id: v.id,
        last_seen: v.last_seen,
        latitude: v.latitude,
        longitude: v.longitude,
      })),
    });
  }, [visitors]); // Logs visitors data changes for debugging

  const getStyles = (isMobile: boolean) => ({
    container: {
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      minHeight: isMobile ? '100svh' : '100vh',
    },
    titleContainer: {
      position: 'absolute' as const,
      top: isMobile ? '10px' : '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '8px',
      zIndex: 1000,
    },
    title: {
      color: 'white',
      fontSize: isMobile ? '1.2rem' : '1.8rem',
      fontWeight: 'bold',
      textAlign: 'center' as const,
      background: 'rgba(0, 0, 0, 0.75)',
      padding: '8px 16px',
      borderRadius: '4px',
      whiteSpace: 'nowrap' as const,
    },
    aboutButton: {
      color: 'white',
      background: 'rgba(0, 0, 0, 0.75)',
      padding: '6px 12px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      fontSize: isMobile ? '0.9rem' : '1rem',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        background: 'rgba(0, 0, 0, 0.85)',
      },
    },
    visitorCount: {
      position: 'absolute' as const,
      bottom: isMobile ? '10px' : '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: 'white',
      fontSize: isMobile ? '1rem' : '1.4rem',
      textAlign: 'center' as const,
      background: 'rgba(0, 0, 0, 0.75)',
      padding: '8px 16px',
      borderRadius: '4px',
      zIndex: 1000,
      whiteSpace: 'nowrap' as const,
      maxWidth: '90%',
    },
  }) as const;

  if (!isMounted) {
    return <div>Loading globe...</div>;
  }

  if (isLoading) {
    return <div>Loading visitor data...</div>;
  }

  if (!visitors) {
    return <div>No visitors data available</div>;
  }

  if (!visitorId) {
    return <div>No visitor ID found</div>;
  }

  const styles = getStyles(isMobile);

  const tooltipStyle = {
    position: "absolute",
    top: tooltipPosition.y + "px",
    left: "20px",
    transform: "translate(0, -100%)",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "white",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "14px",
    pointerEvents: "none",
    zIndex: 1000,
    display: showTooltip ? "block" : "none",
    whiteSpace: "nowrap",
  };

  return (
    <div style={styles.container}>
      <div style={styles.titleContainer}>
        <div style={styles.title}>ElectricSQL Live Visitor Map</div>
        <button
          style={styles.aboutButton}
          onClick={() => setIsAboutModalOpen(true)}
        >
          About
        </button>
      </div>
      <div style={styles.visitorCount}>
        {visitors.length} Total Visitor{visitors.length !== 1 ? 's' : ''}
      </div>
      <div
        ref={globeRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
      <RecentVisitors visitors={visitors} />
      {showTooltip && (
        <div
          dangerouslySetInnerHTML={{ __html: tooltipContent }}
          style={{
            position: 'absolute',
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y + 10}px`,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}
      <Modal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        title="About the ElectricSQL Live Visitor Map"
      >
        <p className="mb-4">
          Welcome to the Live Visitor Map demo for <a
            href="https://electric-sql.com/">ElectricSQL</a>, a real-time visualization
          of visitors to the website.
        </p>
        <p className="mb-4">
          ElectricSQL provides seamless real-time data synchronization between Postgres tables
          and the visualization. You simply define your data structures in Postgres and then start syncing into the app.
        </p>
        <p className="mb-4">
          View the source code on <a href="https://github.com/KyleAMathews/electricsql-live-visitor-map">GitHub</a>.
        </p>
        <div className="mb-4">
          <p>The visitor data is stored in the following Postgres table:</p>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
            <code className="language-sql">{`CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY,
  latitude DECIMAL,
  longitude DECIMAL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  visitor_id UUID,
  country TEXT,
  city TEXT,
  visit_count INTEGER DEFAULT 1
);`}</code>
          </pre>
          <p>And loaded with the <a href="https://electric-sql.com/docs/integrations/react"><code>useShape</code></a> hook:</p>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
            <code className="language-sql">{`const { data: visitors } = useShape<Visitor>({
  url,
  table: 'visitors'
});`}</code>
          </pre>
          <p>That's all you need for real-time syncing from Postgres that scales to millions of visitors!</p>
        </div>
      </Modal>
    </div>
  );
}

export default VisitorMap;
