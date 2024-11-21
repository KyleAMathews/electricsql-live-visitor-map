import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Tooltip } from "react-tooltip";
import { useShape } from "@electric-sql/react";
import { v4 as uuidv4 } from "uuid";
import * as THREE from 'three';
import "../styles/animations.css";

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
  const { data: visitors = [], isLoading } = useShape<Visitor>({
    url: `${import.meta.env.PUBLIC_API_URL}/api/visitors/shape`,
  });

  const clusters = useMemo(
    () => createClusters(visitors, 1),
    [visitors],
  );

  const pointData = useMemo(() => {
    console.log("Visitors data:", visitors);
    console.log("Clusters:", clusters);
    return clusters.map(cluster => {
      const size = Math.min(20, Math.max(5, Math.sqrt(cluster.totalVisits) * 3));
      const isNew = cluster.lastVisitTime && Date.now() - cluster.lastVisitTime < 5000;
      const point = {
        lat: cluster.latitude,
        lng: cluster.longitude,
        size: size / 5, // Increased from /15 to /5 for larger base size
        height: Math.max(0.5, Math.log2(cluster.totalVisits) * 1), // Increased height multiplier
        color: isNew ? '#ff3333' : '#ffaa00',
        emissive: isNew ? '#ff0000' : '#ff6600',
        cluster: cluster,
        intensity: isNew ? 2 : 1
      };
      console.log("Created point:", point);
      return point;
    });
  }, [clusters]);

  // Custom render function for 3D markers
  const customRender = useCallback((marker: any) => {
    console.log("Rendering marker:", marker);
    
    // Create a group to hold our tower parts
    const group = new THREE.Group();

    // Create the base (wider and shorter cylinder)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.6, 0.3, 6),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(marker.color),
        emissive: new THREE.Color(marker.emissive),
        emissiveIntensity: marker.intensity,
        transparent: true,
        opacity: 0.9,
        shininess: 100
      })
    );
    group.add(base);

    // Create the tower (thinner and taller cylinder)
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.4, 1, 6),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(marker.color),
        emissive: new THREE.Color(marker.emissive),
        emissiveIntensity: marker.intensity,
        transparent: true,
        opacity: 0.9,
        shininess: 100
      })
    );
    tower.position.y = 0.65;
    group.add(tower);

    // Create the top (glowing sphere)
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(marker.emissive),
        emissive: new THREE.Color(marker.emissive),
        emissiveIntensity: marker.intensity * 1.5,
        transparent: true,
        opacity: 0.9,
        shininess: 100
      })
    );
    top.position.y = 1.15;
    group.add(top);

    // Add point lights for glow effect
    const light1 = new THREE.PointLight(marker.color, 2, marker.size * 4);
    light1.position.y = marker.height / 2;
    group.add(light1);

    const light2 = new THREE.PointLight(marker.emissive, 1, marker.size * 2);
    light2.position.y = marker.height;
    group.add(light2);

    // Scale the entire group
    group.scale.set(marker.size, marker.height, marker.size);

    return group;
  }, []);

  useEffect(() => {
    setIsMounted(true);
    setVisitorId(getVisitorId());
  }, []);

  useEffect(() => {
    if (globeRef.current) {
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
  }, [isMounted]);

  useEffect(() => {
    // Record visit when the component mounts
    if (visitorId) {
      fetch(`${import.meta.env.PUBLIC_API_URL}/api/record-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          visitorId: visitorId,
        }),
      }).catch(error => {
        console.error("Error recording visit:", error);
      });
    }
  }, [visitorId]);

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
    <div style={{ height: "100vh", width: "100%" }}>
      <React.Suspense fallback={<div>Loading globe visualization...</div>}>
        <Globe
          ref={globeRef}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          customLayerData={pointData}
          customThreeObject={customRender}
          customThreeObjectUpdate={(obj, d) => {
            console.log("Updating object position:", d);
            const coords = (globeRef.current as any).getCoords(d.lat, d.lng, 0.1); // Fixed altitude
            Object.assign(obj.position, coords);
            // Make the object point outward from the globe center
            obj.lookAt(0, 0, 0);
            obj.rotateX(Math.PI / 2); // Keep it standing upright
          }}
          atmosphereColor="#001133"
          atmosphereAltitude={0.25}
          backgroundColor="#000000"
          onCustomLayerClick={(obj: any, event: any) => {
            console.log("Clicked object:", obj);
            setSelectedCluster(obj.cluster);
          }}
        />
      </React.Suspense>
      {selectedCluster && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.8)",
            padding: "20px",
            borderRadius: "10px",
            color: "#ffffff",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#ffffff" }}>Cluster Info</h3>
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
    </div>
  );
}

export default VisitorMap;
