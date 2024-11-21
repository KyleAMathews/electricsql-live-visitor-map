import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Tooltip } from "react-tooltip";
import { useShape } from "@electric-sql/react";
import { v4 as uuidv4 } from "uuid";
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import "../styles/animations.css";
import RecentVisitors from './RecentVisitors';

// Dynamically import Globe to ensure it only loads on the client
const Globe = React.lazy(() => import('react-globe.gl'));

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
  lastVisitTime?: number;
}

function getGridSize(zoom: number): number {
  if (zoom <= 1) return 20; // World view
  if (zoom <= 2) return 10; // Continental view
  if (zoom <= 4) return 5;  // Country view
  return 2; // City view
}

function createClusters(visitors: Visitor[], zoom: number): Cluster[] {
  const grid: { [key: string]: Visitor[] } = {};
  const gridSize = getGridSize(zoom);
  
  // Find the most recent visit time across all visitors
  const mostRecentVisit = Math.max(...visitors.map(v => new Date(v.last_seen || 0).getTime()));
  const recentThreshold = mostRecentVisit - 5000; // Consider visits within last 5 seconds of most recent as new

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
    if (isNaN(lat) || isNaN(lon)) return;

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

    // Find the most recent visit time in this cluster
    const lastVisitTime = Math.max(
      ...cellVisitors.map(v => new Date(v.last_seen || 0).getTime())
    );

    return {
      latitude: avgLat,
      longitude: avgLon,
      visitors: cellVisitors,
      totalVisits,
      lastVisitTime: lastVisitTime >= recentThreshold ? lastVisitTime : undefined,
    };
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
  const globeRef = useRef();
  const [isMounted, setIsMounted] = useState(false);
  const [visitorId, setVisitorId] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const { data: visitors = [], isLoading } = useShape<Visitor>({
    url: `${import.meta.env.PUBLIC_API_URL}/api/visitors/shape`,
  });

  // Monitor visitors data changes
  useEffect(() => {
    console.log("Visitors data updated:", {
      count: visitors.length,
      visitors: visitors.map(v => ({
        id: v.id,
        timestamp: v.timestamp,
        latitude: v.latitude,
        longitude: v.longitude
      }))
    });
  }, [visitors]);

  // Create clusters from visitors
  const clusters = useMemo(
    () => {
      console.log("Creating clusters from visitors:", visitors);
      return createClusters(visitors, 1);
    },
    [visitors],
  );

  const pointData = useMemo(() => {
    console.log("Recalculating point data");
    console.log("Current time:", Date.now());
    console.log("Clusters:", clusters);
    
    return clusters.map(cluster => {
      const baseSize = 0.3; // Increased base size of spike (10x larger)
      const height = Math.max(0.5, Math.log2(cluster.totalVisits) * 1.5); // More reasonable height scaling
      const timeSinceVisit = cluster.lastVisitTime ? Date.now() - cluster.lastVisitTime : Infinity;
      const isNew = timeSinceVisit < 30000; // 30 seconds
      
      console.log("Cluster analysis:", {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        lastVisitTime: cluster.lastVisitTime,
        timeSinceVisit,
        isNew,
        totalVisits: cluster.totalVisits,
        height
      });

      const point = {
        lat: cluster.latitude,
        lng: cluster.longitude,
        size: baseSize,
        height,
        color: isNew ? '#ff3333' : '#ffaa00',
        emissive: isNew ? '#ff0000' : '#ff6600',
        cluster: cluster,
        intensity: isNew ? 2 : 1,
        isNew,
        visitTime: cluster.lastVisitTime,
        timeSinceVisit
      };
      
      console.log("Created point:", point);
      return point;
    });
  }, [clusters]);

  // Effect to handle new visitor recording
  useEffect(() => {
    const recordVisit = async () => {
      if (!visitorId) return;
      
      try {
        console.log("Recording visit for visitor:", visitorId);
        const response = await fetch(`${import.meta.env.PUBLIC_API_URL}/api/record-visit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            visitorId,
            timestamp: Date.now(),
            // Add any other relevant data
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to record visit');
        }
        
        console.log("Visit recorded successfully");
      } catch (error) {
        console.error("Error recording visit:", error);
      }
    };

    // Record visit when the component mounts
    if (visitorId && isMounted) {
      console.log("Component mounted, recording visit");
      recordVisit();
    }
  }, [visitorId, isMounted]);

  useEffect(() => {
    setIsMounted(true);
    setVisitorId(getVisitorId());
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      TWEEN.update();
    };
    
    if (isMounted && globeRef.current) {
      animate();
      
      const controls = (globeRef.current as any).controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      
      // Enhance the globe's appearance
      const globe = (globeRef.current as any).scene();
      globe.fog = new THREE.Fog('#000000', 400, 2000);
      
      // Add ambient light for better visibility
      const ambientLight = new THREE.AmbientLight('#ffffff', 0.8);
      globe.add(ambientLight);
      
      // Add directional light for better depth
      const dirLight = new THREE.DirectionalLight('#ffffff', 1);
      dirLight.position.set(1, 1, 1);
      globe.add(dirLight);
      
      // Add a subtle blue point light from below
      const bottomLight = new THREE.PointLight('#0066ff', 0.8, 1000);
      bottomLight.position.set(0, -500, 0);
      globe.add(bottomLight);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isMounted]);

  // Custom render function for 3D markers
  const customRender = useCallback((marker: any) => {
    console.log("Rendering marker:", {
      lat: marker.lat,
      lng: marker.lng,
      isNew: marker.isNew,
      timeSinceVisit: marker.timeSinceVisit,
      visitTime: marker.visitTime
    });
    
    // Create a group to hold our spike
    const group = new THREE.Group();

    // Create a spike (cone)
    const spikeGeometry = new THREE.ConeGeometry(
      marker.size,    // radius at base
      marker.height,  // height
      8,             // segments
      1,             // height segments
      false          // open ended
    );
    const spikeMaterial = new THREE.MeshPhongMaterial({
      color: marker.color,
      emissive: marker.emissive,
      emissiveIntensity: marker.intensity,
      transparent: true,
      opacity: 0.8,
      shininess: 100,
      side: THREE.DoubleSide
    });
    const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
    
    // Center the spike at its base
    spike.position.y = marker.height / 2;
    
    // Add point light for glow effect
    const light = new THREE.PointLight(marker.color, marker.intensity * 2, marker.height * 10);
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
        .to({ 
          x: scale, 
          y: scale, 
          z: scale 
        }, duration)
        .easing(easing)
        .start();

      // Light intensity tween
      if (light) {
        new TWEEN.Tween(light)
          .to({ intensity: hovering ? marker.intensity * 4 : marker.intensity * 2 }, duration)
          .easing(easing)
          .start();
      }

      // Update tooltip
      if (hovering) {
        const location = marker.cluster.city 
          ? `${marker.cluster.city}, ${marker.cluster.country}`
          : marker.cluster.country || 'Unknown Location';
        
        setTooltipContent(
          `${location}<br/>${marker.cluster.totalVisits} visitor${marker.cluster.totalVisits !== 1 ? 's' : ''}`
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
        lat: marker.lat,
        lng: marker.lng,
        timeSinceVisit: marker.timeSinceVisit
      });
      
      const startTime = Date.now();
      const ANIMATION_DURATION = 30000; // 30 seconds
      const FADE_DURATION = 5000; // 5 second fade out
      
      // Create color objects for interpolation
      const startColor = new THREE.Color('#ffaa00');
      const peakColor = new THREE.Color('#ff3333');
      const startEmissive = new THREE.Color('#ff6600');
      const peakEmissive = new THREE.Color('#ff0000');
      const tempColor = new THREE.Color();
      const tempEmissive = new THREE.Color();
      
      const animate = () => {
        try {
          const elapsedTime = Date.now() - startTime;
          const timeLeft = ANIMATION_DURATION - elapsedTime;
          
          // Calculate fade out factor (1 -> 0 over FADE_DURATION)
          const fadeOutFactor = timeLeft < FADE_DURATION ? timeLeft / FADE_DURATION : 1;
          
          // Slower, more dramatic pulsing
          const pulse = Math.sin(elapsedTime * 0.003) * 0.3 + 1.3; // Pulsing between 1.0 and 1.6
          const finalPulse = 1 + (pulse - 1) * fadeOutFactor; // Smoothly reduce pulse intensity

          // Calculate color interpolation factor (0 to 1 to 0)
          const colorPulse = Math.sin(elapsedTime * 0.003) * 0.5 + 0.5; // Oscillates between 0 and 1
          const finalColorFactor = colorPulse * fadeOutFactor;

          // Interpolate colors
          tempColor.copy(startColor).lerp(peakColor, finalColorFactor);
          tempEmissive.copy(startEmissive).lerp(peakEmissive, finalColorFactor);

          // Log animation state periodically
          if (elapsedTime % 1000 < 16) { // Log roughly every second
            console.log("Animation state:", {
              timeLeft,
              fadeOutFactor,
              pulse,
              finalPulse,
              colorPulse,
              finalColorFactor,
              lat: marker.lat,
              lng: marker.lng
            });
          }

          // Update spike material and scale
          if (spike?.material instanceof THREE.MeshPhongMaterial) {
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
            if (spike?.material instanceof THREE.MeshPhongMaterial) {
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
  }, []);

  // Custom update function for Three.js objects
  const customThreeObjectUpdate = useCallback((obj: THREE.Object3D | undefined, d: any) => {
    if (!obj || !d) return;

    try {
      // Update position if needed
      if (typeof d.lat === 'number' && typeof d.lng === 'number' && globeRef.current) {
        const coords = (globeRef.current as any).getCoords(d.lat, d.lng, 0.1);
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
  }, []);

  const tooltipStyle = {
    position: 'absolute',
    top: tooltipPosition.y + 'px',
    left: '20px',
    transform: 'translate(0, -100%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '14px',
    pointerEvents: 'none',
    zIndex: 1000,
    display: showTooltip ? 'block' : 'none',
    whiteSpace: 'nowrap',
  };

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 39.6, lng: -98.5, altitude: 2.5 });
      
      // Add mousemove handler for tooltip positioning
      const handleMouseMove = (event) => {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div className="title">
        ElectricSQL Live Visitors Map
      </div>
      <RecentVisitors visitors={visitors} />
      <div
        dangerouslySetInnerHTML={{ __html: tooltipContent }}
        style={tooltipStyle as any}
      />
      <div className="visitor-count">
        {visitors.length} total visitors
      </div>
      <React.Suspense fallback={<div>Loading globe visualization...</div>}>
        <Globe
          ref={globeRef}
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
          <h3 style={{ margin: "0 0 15px 0", color: "#ffffff", textShadow: "0 0 10px rgba(255,255,255,0.5)" }}>Cluster Info</h3>
          <p style={{ margin: "5px 0" }}>Visitors: {selectedCluster.visitors.length}</p>
          <p style={{ margin: "5px 0" }}>Total Visits: {selectedCluster.totalVisits}</p>
          <p style={{ margin: "5px 0" }}>
            Cities:{" "}
            {Array.from(
              new Set(selectedCluster.visitors.map((v) => v.city)),
            ).join(", ")}
          </p>
          <button 
            onClick={() => setSelectedCluster(null)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#ffffff",
              padding: "8px 15px",
              borderRadius: "5px",
              cursor: "pointer",
              marginTop: "10px"
            }}
          >
            Close
          </button>
        </div>
      )}
      <style jsx>{`
        .title {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          color: #fff;
          font-size: 24px;
          font-weight: 500;
          text-align: center;
          z-index: 1000;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
          letter-spacing: 1px;
        }

        @media (max-width: 768px) {
          .title {
            font-size: 16px;
            top: 15px;
          }
        }

        .visitor-count {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          color: #fff;
          font-size: 16px;
          text-align: center;
          z-index: 1000;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.05);
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(5px);
        }
      `}</style>
    </div>
  );
}

export default VisitorMap;
