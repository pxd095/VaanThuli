/**
 * geometryService.js
 * ──────────────────
 * Haversine-based in-memory geographic filtering.
 */

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function filterSatellitesInBubble(satellites, userLat, userLng, radiusKm = 500) {
  const results = [];
  for (const sat of satellites) {
    if (sat.lat == null || sat.lng == null) continue;
    const distKm = haversineKm(userLat, userLng, sat.lat, sat.lng);
    if (distKm <= radiusKm) {
      results.push({
        id:               sat.norad_id,
        name:             sat.name,
        type:             'satellite',
        lat:              sat.lat,
        lng:              sat.lng,
        altKm:            sat.alt_km,
        velocityKms:      sat.velocity_kms,
        distanceFromUserKm: parseFloat(distKm.toFixed(2)),
        propagatedAt:     sat.propagated_at,
      });
    }
  }
  results.sort((a, b) => a.distanceFromUserKm - b.distanceFromUserKm);
  return results;
}

export function filterAsteroidsForBubble(asteroids, daysOut = 7) {
  const now     = Date.now();
  const maxTime = now + daysOut * 24 * 60 * 60 * 1000;

  return asteroids
    .filter(neo => {
      if (!neo.epoch_close_approach_ms) return true; 
      return neo.epoch_close_approach_ms <= maxTime;
    })
    .map(neo => {
      // --- HACKATHON FEATURES: DOOM SCORE & HUMAN SCALE ---
      const avgDiameterKm = (neo.est_diameter_km_min + neo.est_diameter_km_max) / 2;
      const meters = avgDiameterKm * 1000;
      
      let scaleString = "Unknown size";
      if (meters < 80) scaleString = `${Math.round(meters / 4.5)} Cars`;
      else if (meters < 300) scaleString = `${Math.round(meters / 105)} Football Fields`;
      else scaleString = `${(meters / 330).toFixed(1)} Eiffel Towers`;

      const dScore = (neo.velocity_kms && neo.miss_distance_lunar && neo.miss_distance_lunar > 0)
        ? parseFloat(((neo.velocity_kms * avgDiameterKm) / neo.miss_distance_lunar).toFixed(4))
        : 0;
      // ----------------------------------------------------

      return {
        id:                  neo.neo_id,
        name:                neo.name,
        type:                'asteroid',
        estimatedDiameterKm: {
          min: neo.est_diameter_km_min,
          max: neo.est_diameter_km_max,
        },
        velocityKms:         neo.velocity_kms,
        missDistanceKm:      neo.miss_distance_km,
        missDistanceLunar:   neo.miss_distance_lunar,
        hazardous:           neo.is_hazardous,
        closeApproachDate:   neo.close_approach_date,
        closeApproachFull:   neo.close_approach_full,
        humanScale:          scaleString,
        doomScore:           dScore
      };
    })
    .sort((a, b) => {
      if (a.hazardous !== b.hazardous) return a.hazardous ? -1 : 1;
      return a.missDistanceKm - b.missDistanceKm;
    });
}
