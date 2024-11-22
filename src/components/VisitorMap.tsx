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
  console.log("Recalculating point data");
  console.log("Current time:", Date.now());

  if (visitors.length === 0) {
    console.log("Clusters: []");
    return [];
  }

  // Adjust clustering radius based on zoom level
  const baseRadius = 30; // Base clustering radius in degrees
  const radius = baseRadius * (1 - zoomLevel); // Radius decreases as zoom increases

  const clusters: Cluster[] = [];
  const points = visitors.map((visitor) => ({
    latitude: parseFloat(visitor.latitude as string),
    longitude: parseFloat(visitor.longitude as string),
    visitor,
  }));

  points.forEach((point) => {
    let addedToCluster = false;

    for (const cluster of clusters) {
      const distance = calculateDistance(
        cluster.latitude,
        cluster.longitude,
        point.latitude,
        point.longitude,
      );

      if (distance <= radius) {
        cluster.visitors.push(point.visitor);
        cluster.latitude =
          cluster.visitors.reduce(
            (sum, v) => sum + parseFloat(v.latitude as string),
            0,
          ) / cluster.visitors.length;
        cluster.longitude =
          cluster.visitors.reduce(
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
      clusters.push({
        latitude: point.latitude,
        longitude: point.longitude,
        visitors: [point.visitor],
        totalVisits: point.visitor.visit_count || 1,
      });
    }
  });

  console.log("Clusters:", clusters);
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
  }, [visitors, zoomLevel]); // Memoizes the clusters data transformation

  const pointData = useMemo(() => {
    console.log("Recalculating point data");
    return clusters.map((cluster) => {
      const baseSize = 0.3;
      const height = Math.max(0.5, Math.log2(cluster.totalVisits) * 1.5);
      const lastSeen = cluster.visitors.reduce(
        (latest, v) => Math.max(latest, new Date(v.last_seen || 0).getTime()),
        0,
      );
      const isNew = Date.now() - lastSeen < 30000;

      return {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        size: baseSize,
        height,
        color: isNew ? "#ff3333" : "#ffaa00",
        emissive: isNew ? "#ff0000" : "#ff6600",
        cluster: cluster,
        intensity: isNew ? 2 : 1,
        isNew,
        lastSeen,
        timeSinceLastSeen: Date.now() - lastSeen,
      };
    });
  }, [clusters]); // Memoizes the pointData data transformation

  const customRender = useCallback((marker: any) => {
    try {
      console.log("Rendering marker:", {
        latitude: marker.latitude,
        longitude: marker.longitude,
        isNew: marker.isNew,
        timeSinceLastSeen: marker.timeSinceLastSeen,
        lastSeen: marker.lastSeen,
      });

      // Create a group to hold our spike
      const group = new Group();

      // Create a spike (cone)
      const spikeGeometry = new ConeGeometry(
        marker.size, // radius at base
        marker.height, // height
        8, // segments
        1, // height segments
        false, // open ended
      );
      const spikeMaterial = new MeshPhongMaterial({
        color: marker.color,
        emissive: marker.emissive,
        emissiveIntensity: marker.intensity,
        transparent: true,
        opacity: 0.8,
        shininess: 100,
        side: DoubleSide,
      });
      const spike = new Mesh(spikeGeometry, spikeMaterial);

      // Center the spike at its base
      spike.position.y = marker.height / 2;

      // Add point light for glow effect
      const light = new PointLight(
        marker.color,
        marker.intensity * 2,
        marker.height * 10,
      );
      light.position.y = marker.height / 2;

      group.add(spike);
      group.add(light);

      // Add hover effect
      const onHover = (hovering: boolean) => {
        if (!group) return;

        const scale = hovering ? 1.2 : 1.0;
        const duration = 200;
        const easing = TWEEN.Easing.Cubic.Out;

        // Scale tween
        new TWEEN.Tween(group.scale)
          .to(
            {
              x: scale,
              y: scale,
              z: scale,
            },
            duration,
          )
          .easing(easing)
          .start();

        // Light intensity tween
        if (light) {
          new TWEEN.Tween(light)
            .to(
              {
                intensity: hovering
                  ? marker.intensity * 4
                  : marker.intensity * 2,
              },
              duration,
            )
            .easing(easing)
            .start();
        }

        // Update tooltip
        if (hovering) {
          const location = marker.cluster.visitors[0].city
            ? `${marker.cluster.visitors[0].city}, ${marker.cluster.visitors[0].country}`
            : marker.cluster.visitors[0].country || "Unknown Location";

          setTooltipContent(
            `${location}<br/>${marker.cluster.totalVisits} visitor${marker.cluster.totalVisits !== 1 ? "s" : ""}`,
          );
          setShowTooltip(true);
        } else {
          setShowTooltip(false);
        }
      };

      // Store the hover handler on the group
      (group as any).__onHover = onHover;

      // Set initial scale
      group.scale.set(1, 1, 1);

      // Add a pulsing animation for new visitors
      let animationFrameId: number | null = null;
      if (marker.isNew) {
        console.log("Starting pulse animation for new visitor", {
          latitude: marker.latitude,
          longitude: marker.longitude,
          timeSinceLastSeen: marker.timeSinceLastSeen,
        });

        const startTime = Date.now();
        const ANIMATION_DURATION = 30000; // 30 seconds
        const FADE_DURATION = 5000; // 5 second fade out

        // Create color objects for interpolation
        const startColor = new Color("#ffaa00");
        const peakColor = new Color("#ff3333");
        const startEmissive = new Color("#ff6600");
        const peakEmissive = new Color("#ff0000");
        const tempColor = new Color();
        const tempEmissive = new Color();

        const animate = () => {
          try {
            const elapsedTime = Date.now() - startTime;
            const timeLeft = ANIMATION_DURATION - elapsedTime;

            // Calculate fade out factor (1 -> 0 over FADE_DURATION)
            const fadeOutFactor =
              timeLeft < FADE_DURATION ? timeLeft / FADE_DURATION : 1;

            // Slower, more dramatic pulsing
            const pulse = Math.sin(elapsedTime * 0.003) * 0.3 + 1.3; // Pulsing between 1.0 and 1.6
            const finalPulse = 1 + (pulse - 1) * fadeOutFactor; // Smoothly reduce pulse intensity

            // Calculate color interpolation factor (0 to 1 to 0)
            const colorPulse = Math.sin(elapsedTime * 0.003) * 0.5 + 0.5; // Oscillates between 0 and 1
            const finalColorFactor = colorPulse * fadeOutFactor;

            // Interpolate colors
            tempColor.copy(startColor).lerp(peakColor, finalColorFactor);
            tempEmissive
              .copy(startEmissive)
              .lerp(peakEmissive, finalColorFactor);

            // Log animation state periodically
            if (elapsedTime % 1000 < 16) {
              // Log roughly every second
              console.log("Animation state:", {
                timeLeft,
                fadeOutFactor,
                pulse,
                finalPulse,
                colorPulse,
                finalColorFactor,
                latitude: marker.latitude,
                longitude: marker.longitude,
              });
            }

            // Update spike material and scale
            if (spike?.material instanceof MeshPhongMaterial) {
              spike.material.emissiveIntensity = marker.intensity * finalPulse;
              spike.material.opacity = Math.min(0.8, 0.6 + finalPulse * 0.2);
              spike.material.color.copy(tempColor);
              spike.material.emissive.copy(tempEmissive);
              spike.material.needsUpdate = true;
            }

            // Scale the spike slightly with the pulse
            group.scale.set(finalPulse, 1, finalPulse);

            if (light) {
              // Update light intensity, distance, and color
              light.intensity = marker.intensity * 3 * finalPulse;
              light.distance = marker.height * (10 + finalPulse * 5);
              light.color.copy(tempColor);
            }

            if (timeLeft > 0) {
              animationFrameId = requestAnimationFrame(animate);
            } else {
              console.log("Ending pulse animation");
              // Reset to non-new state
              if (spike?.material instanceof MeshPhongMaterial) {
                spike.material.color.copy(startColor);
                spike.material.emissive.copy(startEmissive);
                spike.material.emissiveIntensity = 1;
                spike.material.opacity = 0.8;
              }
              group.scale.set(1, 1, 1);
              if (light) {
                light.color.copy(startColor);
                light.intensity = 2;
              }
            }
          } catch (error) {
            console.error("Error in animation:", error);
            if (animationFrameId !== null) {
              cancelAnimationFrame(animationFrameId);
            }
          }
        };
        animate();
      }

      // Cleanup function
      (group as any).__cleanup = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        // Dispose of geometries and materials
        spikeGeometry.dispose();
        spikeMaterial.dispose();
      };

      return group;
    } catch (error) {
      console.error("Error rendering marker:", error);
      return null;
    }
  }, []);

  const customThreeObjectUpdate = useCallback(
    (obj: Object3D | undefined, d: any) => {
      if (!obj || !d) return;

      try {
        // Update position if needed
        if (
          typeof d.latitude === "number" &&
          typeof d.longitude === "number" &&
          globeRef.current
        ) {
          const coords = (globeRef.current as any).getCoords(
            d.latitude,
            d.longitude,
            0.1,
          );
          if (coords) {
            obj.position.set(coords.x, coords.y, coords.z);
            // Make the object point outward from the globe center
            obj.lookAt(0, 0, 0);
            obj.rotateX(Math.PI / 2);
          }
        }
      } catch (error) {
        console.error("Error updating object:", error);
      }
    },
    [],
  );

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
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={styles.title}>ElectricSQL Live Visitors Map</div>
      {visitors.length > 0 && (
        <div style={styles.visitorCount}>
          {visitors.length.toLocaleString()} visitor
          {visitors.length !== 1 ? "s" : ""}
        </div>
      )}
      <RecentVisitors visitors={visitors} />
      <div
        dangerouslySetInnerHTML={{ __html: tooltipContent }}
        style={tooltipStyle as any}
      />
      <React.Suspense fallback={<div>Loading globe visualization...</div>}>
        <Globe
          ref={globeRef}
          onGlobeReady={() =>
            globeRef.current?.pointOfView({ lng: -90, lat: 30 })
          }
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          customLayerData={pointData}
          customThreeObject={customRender}
          customThreeObjectUpdate={customThreeObjectUpdate}
          onCustomLayerHover={(obj: any) => {
            if (obj && (obj as any).__onHover) {
              (obj as any).__onHover(true);
            } else {
              // Find and unhover any previously hovered objects
              const globe = globeRef.current;
              if (globe) {
                const scene = (globe as any).scene();
                scene.traverse((object: any) => {
                  if (object.__onHover) {
                    object.__onHover(false);
                  }
                });
              }
            }
          }}
          onCustomLayerClick={(obj: any, event: any) => {
            console.log("Clicked object:", obj);
            setSelectedCluster(obj.cluster);
          }}
          atmosphereColor="#001133"
          atmosphereAltitude={0.25}
          backgroundColor="#000000"
        />
      </React.Suspense>
      {selectedCluster && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            background: "rgba(0,0,0,0.8)",
            padding: "20px",
            borderRadius: "10px",
            color: "#ffffff",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 0 20px rgba(255,255,255,0.1)",
            maxWidth: "300px",
            zIndex: 1000,
          }}
        >
          <h3
            style={{
              margin: "0 0 15px 0",
              color: "#ffffff",
              textShadow: "0 0 10px rgba(255,255,255,0.5)",
              fontSize: "16px",
              fontWeight: "normal",
            }}
          >
            {Array.from(
              new Set(selectedCluster.visitors.map((v) => v.city)),
            ).join(", ")}
          </h3>
          <p style={{ margin: "5px 0", fontSize: "14px" }}>
            {selectedCluster.visitors.length} visit
            {selectedCluster.visitors.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => setSelectedCluster(null)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#ffffff",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              marginTop: "10px",
              fontSize: "12px",
              transition: "all 0.2s ease",
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default VisitorMap;
