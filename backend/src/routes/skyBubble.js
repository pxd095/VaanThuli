/**
 * skyBubble.js
 */

import {
  getSatelliteCache,
  getAsteroidCache,
} from '../services/cacheService.js';

import {
  filterSatellitesInBubble,
  filterAsteroidsForBubble,
} from '../services/geometryService.js';

import { supabase } from '../db/supabaseClient.js';

const RADIUS_DEFAULT = 500;
const RADIUS_MAX     = 5000;
const LIMIT_DEFAULT  = 100;
const LIMIT_MAX      = 500;

async function querySupabaseBubble(lat, lng, radiusKm) {
  const { data, error } = await supabase.rpc('objects_near', {
    p_lat:       lat,
    p_lng:       lng,
    p_radius_km: radiusKm,
  });

  if (error) {
    throw new Error(`Supabase PostGIS query failed: ${error.message}`);
  }

  return (data ?? []).map(row => ({
    id:                 row.norad_id,
    name:               row.name,
    type:               'satellite',
    lat:                row.lat,
    lng:                row.lng,
    altKm:              row.alt_km,
    velocityKms:        row.velocity_kms,
    distanceFromUserKm: row.distance_km,
    propagatedAt:       row.propagated_at,
    source:             'supabase_l2', 
  }));
}

export default async function skyBubbleRoute(fastify) {
  fastify.get('/api/core/sky-bubble', {
    schema: {
      description: 'Returns cosmic objects within a localized bubble around user GPS coordinates',
      tags:        ['core'],
      querystring: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat:    { type: 'number', minimum: -90,  maximum: 90 },
          lng:    { type: 'number', minimum: -180, maximum: 180 },
          radius: { type: 'integer', minimum: 1, maximum: RADIUS_MAX, default: RADIUS_DEFAULT },
          type:   { type: 'string', enum: ['satellites', 'asteroids', 'both'], default: 'both' },
          limit:  { type: 'integer', minimum: 1, maximum: LIMIT_MAX,   default: LIMIT_DEFAULT },
        },
      },
    },
  }, async (request, reply) => {
    const reqStart = Date.now();

    const {
      lat,
      lng,
      radius = RADIUS_DEFAULT,
      type   = 'both',
      limit  = LIMIT_DEFAULT,
    } = request.query;

    let satellites = [];
    let asteroids  = [];
    let cacheSource = 'l1_memory';

    try {
      if (type === 'satellites' || type === 'both') {
        const cachedSats = getSatelliteCache();
        if (cachedSats) {
          satellites = filterSatellitesInBubble(cachedSats, lat, lng, radius);
        } else {
          cacheSource = 'l2_supabase';
          request.log.warn('L1 cache miss for satellites — falling back to Supabase');
          satellites = await querySupabaseBubble(lat, lng, radius);
        }
        satellites = satellites.slice(0, limit);
      }

      if (type === 'asteroids' || type === 'both') {
        const cachedNeos = getAsteroidCache();
        if (cachedNeos) {
          asteroids = filterAsteroidsForBubble(cachedNeos);
        } else {
          cacheSource = 'l2_supabase';
          const { data } = await supabase
            .from('asteroids')
            .select('*')
            .gte('close_approach_date', new Date().toISOString().slice(0, 10))
            .order('close_approach_date', { ascending: true })
            .limit(50);

          asteroids = (data ?? []).map(neo => {
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
              source:              'supabase_l2',
              humanScale:          scaleString,
              doomScore:           dScore
            };
          });
        }
      }

      const responseTimeMs = Date.now() - reqStart;

      return reply.code(200).send({
        status: 'ok',
        meta: {
          bubble: { lat, lng, radiusKm: radius },
          filter:          type,
          responseTimeMs,
          cacheSource,
          timestamp:       new Date().toISOString(),
        },
        count: {
          satellites: satellites.length,
          asteroids:  asteroids.length,
          total:      satellites.length + asteroids.length,
        },
        objects: [
          ...satellites,
          ...asteroids,
        ],
      });

    } catch (err) {
      request.log.error(err, 'sky-bubble route error');
      return reply.code(500).send({
        status:  'error',
        message: err.message || 'Internal server error',
      });
    }
  });
}
