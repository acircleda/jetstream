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

function route_logic_check2(data, local_lat, local_lon) {
  let origin = [Number(data.origin?.lat), Number(data.origin?.lon)];
  let destination = [Number(data.destination?.lat), Number(data.destination?.lon)];
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
  
  const check = isHeadingTowardDestination(origin, destination, heading, toleraance);
  return check;
}

function heading_check2(data, heading, toleraance) {
  console.log('within function data:', data);
  let origin = [Number(data.origin?.lat), Number(data.origin?.lon)];
  let destination = [Number(data.destination?.lat), Number(data.destination?.lon)];
  
  const check = isHeadingTowardDestination(origin, destination, heading, toleraance);
  return check;
}

// Simple heading check: takes explicit current, origin, and destination positions
function simple_heading_check(currentLat, currentLon, route_data, heading, tolerance = tolerance) {

   let destLat = Number(route_data.destination?.lat);
   let destLon = Number(route_data.destination?.lon);

  // Calculate bearing from current position to destination
  const bearingToDest = calculateBearing(currentLat, currentLon, destLat, destLon);
  const angleDiff = Math.abs(heading - bearingToDest) % 360;
  const smallestDiff = Math.min(angleDiff, 360 - angleDiff);
  return smallestDiff <= tolerance;
}

function smart_heading_check(currentLat, currentLon, route_data, heading, options = {}) {
    const {
        baseTolerance = 45,
        takeoffTolerance = 90,
        landingTolerance = 30,
        nearDistanceKm = 50  // How close is "near" origin/destination
    } = options;
    
    const origLat = Number(route_data.origin?.lat);
    const origLon = Number(route_data.origin?.lon);
    const destLat = Number(route_data.destination?.lat);
    const destLon = Number(route_data.destination?.lon);

    // Calculate distances and progress
    const totalDistance = calculateDistance(origLat, origLon, destLat, destLon);
    const distanceFromOrigin = calculateDistance(origLat, origLon, currentLat, currentLon);
    const distanceToDestination = calculateDistance(currentLat, currentLon, destLat, destLon);
    const progress = Math.min(distanceFromOrigin / totalDistance, 1);
    
    // Phase 1: Near origin (likely taking off or departing)
    if (distanceFromOrigin < nearDistanceKm || progress < 0.15) {
        // Should be heading in the general direction of destination
        const generalBearing = calculateBearing(origLat, origLon, destLat, destLon);
        const diff = getAngleDifference(heading, generalBearing);
        return diff <= takeoffTolerance; // Very lenient - planes often circle after takeoff
    }
    
    // Phase 2: Near destination (likely approaching/landing)
    if (distanceToDestination < nearDistanceKm || progress > 0.85) {
        // Should be heading toward destination
        const approachBearing = calculateBearing(currentLat, currentLon, destLat, destLon);
        const diff = getAngleDifference(heading, approachBearing);
        return diff <= landingTolerance; // Stricter - should be lined up for approach
    }
    
    // Phase 3: En route (cruise phase)
    // Use multiple checks for better accuracy
    const directBearing = calculateBearing(currentLat, currentLon, destLat, destLon);
    const overallRouteBearing = calculateBearing(origLat, origLon, destLat, destLon);
    
    // Check direct bearing to destination
    const directDiff = getAngleDifference(heading, directBearing);
    if (directDiff <= baseTolerance) {
        return true;
    }
    
    // Check general route bearing (helps with curved routes)
    const routeDiff = getAngleDifference(heading, overallRouteBearing);
    if (routeDiff <= baseTolerance + 15) { // Slightly more lenient
        return true;
    }
    
    // Final check: Is the plane at least not heading back toward origin?
    const backwardsBearing = calculateBearing(currentLat, currentLon, origLat, origLon);
    const backwardsDiff = getAngleDifference(heading, backwardsBearing);
    
    // If it's definitely not going backwards and somewhat toward destination, allow it
    return backwardsDiff > 90 && directDiff <= (baseTolerance + 30);
}

function getAngleDifference(angle1, angle2) {
    const diff = Math.abs(angle1 - angle2) % 360;
    return Math.min(diff, 360 - diff);
}

// Helper function - you might already have this
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = {
  crossTrackDistance,
  route_logic_check,
  route_logic_check2,
  heading_check,
  heading_check2,
  simple_heading_check,
  smart_heading_check
};