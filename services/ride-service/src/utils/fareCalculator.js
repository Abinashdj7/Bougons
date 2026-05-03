const BASE_FARE      = 2.50;  // €
const RATE_PER_KM    = 1.20;  // € per km
const RATE_PER_MIN   = 0.25;  // € per minute
const MINIMUM_FARE   = 5.00;  // €

// Haversine formula — distance between two [lng, lat] points in km
const haversineDistance = (coord1, coord2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Estimate duration in minutes based on distance (avg 30km/h in city)
const estimateDuration = (distanceKm) => Math.ceil((distanceKm / 30) * 60);

const calculateFare = (pickupCoords, destinationCoords, surgeMultiplier = 1.0) => {
  const distance = haversineDistance(pickupCoords, destinationCoords);
  const duration = estimateDuration(distance);

  const raw = BASE_FARE + distance * RATE_PER_KM + duration * RATE_PER_MIN;
  const withSurge = raw * surgeMultiplier;
  const final = Math.max(MINIMUM_FARE, withSurge);

  return {
    distance: Math.round(distance * 100) / 100,   // km, 2 decimals
    duration,                                       // minutes
    estimated: Math.round(final * 100) / 100,       // €
    surgeMultiplier,
    breakdown: {
      baseFare: BASE_FARE,
      distanceFare: Math.round(distance * RATE_PER_KM * 100) / 100,
      timeFare: Math.round(duration * RATE_PER_MIN * 100) / 100,
    },
  };
};

// Surge pricing — increases multiplier based on active ride count in an area
const getSurgeMultiplier = (activeRidesCount) => {
  if (activeRidesCount > 50) return 2.0;
  if (activeRidesCount > 30) return 1.5;
  if (activeRidesCount > 15) return 1.25;
  return 1.0;
};

module.exports = { calculateFare, haversineDistance, estimateDuration, getSurgeMultiplier };