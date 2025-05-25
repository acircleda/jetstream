const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const AIRPORTS_DB_PATH = path.join(__dirname, 'airports.db');

// Format function for ADSBDB data
function format_adsbdb(dataArray) {
  return dataArray.map(data => ({
    callsign: data.flightroute?.callsign,
    callsign_icao: data.flightroute?.callsign_icao,
    callsign_iata: data.flightroute?.callsign_iata,
    airline_name: data.flightroute?.airline?.name,
    origin: {
      name: data.flightroute.origin?.name,
      city: data.flightroute.origin?.municipality,
      country: data.flightroute.origin?.country_iso_name,
      iata: data.flightroute.origin?.iata_code,
      icao: data.flightroute.origin?.icao_code,
      lat: data.flightroute.origin?.latitude,
      lon: data.flightroute.origin?.longitude
    },
    destination: {
      name: data.flightroute.destination?.name,
      city: data.flightroute.destination?.municipality,
      country: data.flightroute.destination?.country_iso_name,
      iata: data.flightroute.destination?.iata_code,
      icao: data.flightroute.destination?.icao_code,
      lat: data.flightroute.destination?.latitude,
      lon: data.flightroute.destination?.longitude
    }
  }));
}

// Function to get airport information from the SQLite database
async function getAirportInfo(icao) {
  if (!icao) return { country: null, city: null, lat: null, lon: null };
  return new Promise((resolve) => {
    const db = new sqlite3.Database(AIRPORTS_DB_PATH);
    db.get(
      'SELECT iso_country, municipality, latitude_deg, longitude_deg FROM airports WHERE icao_code = ?',
      [icao],
      (err, row) => {
        db.close();
        if (!err && row) {
          resolve({
            country: row.iso_country || null,
            city: row.municipality || null,
            lat: row.latitude_deg || null,
            lon: row.longitude_deg || null,
          });
        } else {
          resolve({ country: null, city: null, lat: null, lon: null });
        }
      }
    );
  });
}

// Format function for AviationStack data
async function format_aviationstack(dataArray) {
  // Find the first entry where live is not null
  const data = Array.isArray(dataArray) ? dataArray.find(d => d.live != null) : null;
  if (!data) return null;
  const depIcao = data.departure?.icao;
  const arrIcao = data.arrival?.icao;
  const depInfo = await getAirportInfo(depIcao);
  const arrInfo = await getAirportInfo(arrIcao);
  return {
    callsign: data.flight?.icao,
    callsign_icao: data.flight?.icao,
    callsign_iata: data.flight?.iata,
    airline_name: data.airline?.name,
    origin: {
      name: data.departure?.airport,
      city: depInfo.city,
      country: depInfo.country,
      iata: data.departure?.iata,
      icao: depIcao,
      lat: depInfo.lat,
      lon: depInfo.lon
    },
    destination: {
      name: data.arrival?.airport,
      city: arrInfo.city,
      country: arrInfo.country,
      iata: data.arrival?.iata,
      icao: arrIcao,
      lat: arrInfo.lat,
      lon: arrInfo.lon
    }
  };
}


module.exports = {
  format_adsbdb,
  format_aviationstack
};