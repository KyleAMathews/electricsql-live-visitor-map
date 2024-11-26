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
import {
  Group,
  ConeGeometry,
  MeshPhongMaterial,
  Mesh,
  PointLight,
  Color,
  DoubleSide,
  AmbientLight,
  DirectionalLight,
  Fog,
} from "three";
import type { Object3D } from "three";
import { feature } from "topojson-client";
import countries from "world-atlas/countries-110m.json";

// Convert TopoJSON to GeoJSON
const countryFeatures = feature(countries, countries.objects.countries);

// Dynamically import Globe
const Globe = React.lazy(() => import("react-globe.gl"));

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
  if (!id) {
    id = uuidv4();
    localStorage.setItem("visitorId", id);
  }
  return id;
}

function VisitorMap() {
  // Ref to the globe instance for direct manipulation
  const globeRef = useRef<any>(null);

  // Basic component state
  const [isMounted, setIsMounted] = useState(false); // Tracks whether the component has finished mounting
  const [visitorId, setVisitorId] = useState(""); // Stores the unique visitor ID
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null); // Stores the currently selected cluster
  const [tooltipContent, setTooltipContent] = useState(""); // Stores the content of the tooltip
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 }); // Stores the position of the tooltip
  const [showTooltip, setShowTooltip] = useState(false); // Tracks whether the tooltip should be shown
  const [isMobile, setIsMobile] = useState(false); // Tracks whether the device is mobile
  const [zoomLevel, setZoomLevel] = useState(1); // Stores the current zoom level

  // Fetch visitors data from the API
  const { data: visitors = [], isLoading } = useShape<Visitor>({
    url: `${import.meta.env.PUBLIC_API_URL}/api/visitors/shape`,
  }); // Fetches visitor data from the API

  // Initialize component and set visitor ID on mount
  useEffect(() => {
    setIsMounted(true);
    setVisitorId(getVisitorId());
  }, []); // Runs once on component mount to initialize state

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

  // Setup Three.js animation loop and scene configuration
  useEffect(() => {
    // Store animation frame ID for cleanup
    let animationFrameId: number;

    // Animation loop function that updates TWEEN animations
    const animate = () => {
      // Request next frame and update all active TWEEN animations
      animationFrameId = requestAnimationFrame(animate);
      TWEEN.update();
    };

    if (isMounted && globeRef.current) {
      // Start animation loop
      animate();

      // Configure globe controls
      const controls = (globeRef.current as any).controls();
      controls.autoRotate = true; // Enable automatic rotation
      controls.autoRotateSpeed = 0.5; // Set rotation speed (degrees per second)

      // Get reference to the Three.js scene
      const globe = (globeRef.current as any).scene();

      // Add fog for depth perception
      // Parameters: color, near distance (when fog starts), far distance (when fog is fully opaque)
      globe.fog = new Fog("#000000", 400, 2000);

      // Add ambient light for overall scene illumination
      // Parameters: color, intensity (0-1)
      const ambientLight = new AmbientLight("#ffffff", 0.8);
      globe.add(ambientLight);

      // Add directional light for shadows and depth
      // Parameters: color, intensity (0-1)
      const dirLight = new DirectionalLight("#ffffff", 1);
      dirLight.position.set(1, 1, 1); // Position light at 45-degree angle
      globe.add(dirLight);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isMounted]); // Sets up Three.js animation loop and scene configuration on mount

  // Memoized data transformations
  const clusters = useMemo(() => {
    console.log("Creating clusters from visitors:", visitors);
    return createClusters(visitors, zoomLevel);
  }, [visitors, zoomLevel]);

  const pointData = useMemo(() => {
    console.log("Recalculating point data");
    return clusters.map((cluster) => ({
      lat: cluster.latitude,
      lng: cluster.longitude,
      alt: Math.min(1.5, Math.log2(cluster.totalVisits) * 0.3 + 0.1), // Height based on visit count
    }));
  }, [clusters]);

  useEffect(() => {
    if (!isMounted || !globeRef.current) return;

    Promise.all([
      import('globe.gl'),
      import('three')
    ]).then(([GlobeModule, THREE]) => {
      const Globe = GlobeModule.default;
      const world = Globe({
        animateIn: true,
        rendererConfig: {
          antialias: true,
          alpha: true
        }
      })(globeRef.current);

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
        // Add visitor location data points to the globe
        .customLayerData(pointData)
        // Define the shape and appearance of visitor markers
        .customThreeObject(() => {
          return new THREE.Mesh(
            new THREE.ConeGeometry(0.3, 1, 8),  // Create cone shape: radius, height, segments
            new THREE.MeshBasicMaterial({
              color: '#ff6b00',   // Orange color for visitor markers
              opacity: 0.9,
              transparent: true,
            })
          );
        })
        // Position and orient the visitor markers on the globe
        .customThreeObjectUpdate((obj, d: Visitor) => {
          // Convert lat/long to 3D coordinates on the globe's surface
          const coords = world.getCoords(
            Number(d.latitude),
            Number(d.longitude),
            0  // assuming no altitude, so defaulting to 0
          );
          Object.assign(obj.position, coords);

          // Make the cone point outward from the globe's center
          const lookAt = new THREE.Vector3();
          lookAt.copy(obj.position).multiplyScalar(2);
          obj.lookAt(lookAt);

          // Rotate the cone to point outward perpendicular to the globe's surface
          obj.rotateX(Math.PI / 2);
        })
        // Configure the globe's atmosphere effect
        //.atmosphereColor('#655ea0')  // Purple-ish atmosphere glow
        // Configure country polygons
        .polygonsData(countryFeatures.features)
        .polygonCapColor(() => '#2a2469')
        .polygonSideColor(() => '#2a2469')
        .polygonStrokeColor(() => '#1a1657')
        .polygonAltitude(0.01)
        // Show latitude/longitude grid lines
        .showGraticules(true);

      // Configure globe controls
      const controls = world.controls();
      controls.autoRotate = true;          // Enable automatic rotation
      controls.enableZoom = false;         // Disable zooming
      controls.autoRotateSpeed = 0.5;      // Set rotation speed
    });

    return () => {
      if (globeRef.current) {
        while (globeRef.current.firstChild) {
          globeRef.current.removeChild(globeRef.current.firstChild);
        }
      }
    };
  }, [isMounted, pointData]);

  const getStyles = (isMobile: boolean) =>
    ({
      title: {
        position: "absolute",
        top: isMobile ? "15px" : "20px",
        left: "50%",
        transform: "translateX(-50%)",
        color: "#fff",
        fontSize: isMobile ? "16px" : "24px",
        fontWeight: 500,
        textAlign: "center",
        zIndex: 1000,
        textShadow: "0 0 10px rgba(255, 255, 255, 0.5)",
        letterSpacing: "1px",
      },
      visitorCount: {
        position: "absolute",
        bottom: isMobile ? "15px" : "20px",
        left: "50%",
        transform: "translateX(-50%)",
        color: "#fff",
        fontSize: isMobile ? "14px" : "16px",
        textAlign: "center",
        zIndex: 1000,
        textShadow: "0 0 10px rgba(255, 255, 255, 0.5)",
        background: "rgba(255, 255, 255, 0.05)",
        padding: isMobile ? "6px 12px" : "8px 16px",
        borderRadius: "20px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(5px)",
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
    <div style={{ width: '100%', height: '100%', background: 'transparent' }}>
      <div ref={globeRef} style={{ width: '100%', height: '100%' }} />
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
    </div>
  );
}

export default VisitorMap;
