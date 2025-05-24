// Helper functions
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function crossTrackDistance(origin, destination, point) {
  const R = 6371; // Earth radius in km

  const [lat1, lon1] = origin.map(toRadians);
  const [lat2, lon2] = destination.map(toRadians);
  const [lat3, lon3] = point.map(toRadians);

  const d13 = haversineDistance(
    origin[0], origin[1], point[0], point[1]
  ) / R;

  const theta13 = Math.atan2(
    Math.sin(lon3 - lon1) * Math.cos(lat3),
    Math.cos(lat1) * Math.sin(lat3) -
    Math.sin(lat1) * Math.cos(lat3) * Math.cos(lon3 - lon1)
  );

  const theta12 = Math.atan2(
    Math.sin(lon2 - lon1) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
  );

  const xtd = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12));
  return Math.abs(xtd * R);
}

// function to check if a flight's route is logical based on its origin and destination coordinates
function route_logic_check(data, local_lat, local_lon) {
  let origin = [Number(data.flightroute.origin?.latitude), Number(data.flightroute.origin?.longitude)];
  let destination = [Number(data.flightroute.destination?.latitude), Number(data.flightroute.destination?.longitude)];
  let local_coords = [Number(local_lat), Number(local_lon)];    
  const distanceKm = crossTrackDistance(origin, destination, local_coords);
  return distanceKm;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let θ = Math.atan2(y, x);
  θ = toDegrees(θ);
  return (θ + 360) % 360;  // Normalize to 0–360°
}

function isHeadingTowardDestination(origin, destination, heading, tolerance = 15) {
  const bearingToDest = calculateBearing(
    origin.lat, origin.lon,
    destination.lat, destination.lon
  );

  const angleDiff = Math.abs(heading - bearingToDest) % 360;
  const smallestDiff = Math.min(angleDiff, 360 - angleDiff);  // Account for wraparound

  return smallestDiff <= tolerance;
}

// function to check if a flight is heading toward its destination
function heading_check(data, heading, toleraance) {
  console.log('within function data:', data);
  let origin = [Number(data.flightroute.origin?.latitude), Number(data.flightroute.origin?.longitude)];
  let destination = [Number(data.flightroute.destination?.latitude), Number(data.flightroute.destination?.longitude)];
  
  const check = isHeadingTowardDestination(origin, destination, heading, toleraance = 15);
  return check;
}


module.exports = {
  crossTrackDistance,
  route_logic_check,
  heading_check
};