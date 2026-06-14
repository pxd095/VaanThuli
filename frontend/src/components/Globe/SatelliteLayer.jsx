import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3, altToRadius, getOrbitColor } from '../../utils/propagator';
import { MAX_DISPLAY_SATELLITES } from '../../utils/constants';

/**
 * SatelliteLayer
 * ──────────────
 * Renders satellites using THREE.InstancedMesh (1 draw call for all dots).
 *
 * SIMPLIFIED APPROACH: Uses server-pre-propagated lat/lng/alt_km directly.
 * No client-side satellite.js re-propagation — just convert lat/lng → 3D vector.
 * Positions update every 30s by asking the parent for fresh data (via re-fetch).
 *
 * This avoids all TLE-parsing failures that were causing 0 visible satellites.
 */
export function SatelliteLayer({ tleData, visible, onSelect }) {
  const meshRef      = useRef();
  const positionsRef = useRef([]);  // { pos, name, norad_id, lat, lng, altKm }[]
  const colorsBaked  = useRef(false);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // ── Build positions from server lat/lng/alt_km ───────────────
  const buildPositions = useCallback(() => {
    if (!tleData?.length) {
      positionsRef.current = [];
      return;
    }

    const limited = tleData.slice(0, MAX_DISPLAY_SATELLITES);
    const results = [];

    for (const sat of limited) {
      try {
        const lat   = sat.lat;
        const lng   = sat.lng;
        const altKm = sat.alt_km;  // server field name is alt_km

        if (!isFinite(lat) || !isFinite(lng) || !isFinite(altKm) || altKm < 0) continue;

        const r   = altToRadius(altKm);
        const pos = latLngToVector3(lat, lng, r);
        results.push({ pos, name: sat.name, norad_id: sat.norad_id, lat, lng, altKm });
      } catch { /* skip */ }
    }

    console.log(`[SatelliteLayer] Built ${results.length} positions from ${limited.length} TLEs`);
    positionsRef.current = results;
    colorsBaked.current  = false; // signal useFrame to rebake colors
  }, [tleData]);

  // Rebuild positions whenever tleData changes
  useEffect(() => {
    buildPositions();
  }, [buildPositions]);

  // ── Bake colors + push matrices every frame ──────────────────
  useFrame(() => {
    if (!meshRef.current) return;
    const positions = positionsRef.current;
    if (!positions.length) return;

    // Set colors once per data change
    if (!colorsBaked.current) {
      const col = new THREE.Color();
      for (let i = 0; i < positions.length; i++) {
        col.set(getOrbitColor(positions[i].altKm));
        meshRef.current.setColorAt(i, col);
      }
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
      colorsBaked.current = true;
    }

    // Update matrix for every satellite every frame
    for (let i = 0; i < positions.length; i++) {
      dummy.position.copy(positions[i].pos);
      dummy.scale.setScalar(0.005);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.count = positions.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!visible) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, MAX_DISPLAY_SATELLITES]}
      frustumCulled={false}
      onPointerDown={(e) => {
        e.stopPropagation();
        const sat = positionsRef.current[e.instanceId];
        if (sat && onSelect) {
          onSelect({
            type:     'satellite',
            name:     sat.name,
            norad_id: sat.norad_id,
            lat:      sat.lat,
            lng:      sat.lng,
            altKm:    sat.altKm,
          });
        }
      }}
    >
      <sphereGeometry args={[0.003, 6, 6]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
