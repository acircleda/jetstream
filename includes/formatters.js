const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const AIRPORTS_DB_PATH = path.join(__dirname, 'airports.db');

// Format function for ADSBDB data
function format_adsblol_route(dataArray) {
  const date = new Date();
  const timestamp = date.getTime();

  // Extract origin and destination from the first object's _airports array
  const airports = dataArray[0]._airports;
  const origin = airports[0];
  const destination = airports[1];

  const formattedArray = dataArray.map(data => ({
    callsign: data.callsign,
    callsign_icao: data.callsign,
    callsign_iata: null,
    airline_name: null,
    origin: {
      name: origin.name,
      city: origin.location,
      country: origin.countryiso2,
      iata: origin.iata,
      icao: origin.icao,
      lat: origin.lat,
      lon: origin.lon
    },
    destination: {
      name: destination.name,
      city: destination.location,
      country: destination.countryiso2,
      iata: destination.iata,
      icao: destination.icao,
      lat: destination.lat,
      lon: destination.lon
    },
    created_at: date,
    timestamp: timestamp,
    api_source: 'adsb.lol'
  }));
  return formattedArray[0];
}

// Format function for ADSBDB data
function format_adsbdb(dataArray) {

  const date = new Date();
  const timestamp = date.getTime();

  const formattedArray = dataArray.map(data => ({
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
    },
    created_at: date,
    timestamp: timestamp,
    api_source: 'adsbdb'
  }));
  return formattedArray[0];
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
  const data = dataArray[0];
  if (!data) return null;

  const depIcao = data.departure?.icao;
  const arrIcao = data.arrival?.icao;
  const depInfo = await getAirportInfo(depIcao);
  const arrInfo = await getAirportInfo(arrIcao);

  const date = new Date();
  const timestamp = date.getTime();

  const formattedArray = dataArray.map(data => ({
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
    },
    created_at: date,
    timestamp: timestamp,
    api_source: 'aviationstack'
  }));

  return formattedArray[0];
}



function titleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(function(word) {
      return word
        .split('-')
        .map(function(part) {
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('-');
    })
    .join(' ');
}

// Adds a callsign in flights/_unknown_routes.json with the current epoch timestamp if it doesn't already exist
function addUnknownCallsign(callsign) {
  if (!callsign) return;
  const unknownsPath = path.join(__dirname, 'flights', '_unknown_routes.json');
  let unknowns = {};
  try {
    if (fs.existsSync(unknownsPath)) {
      const data = fs.readFileSync(unknownsPath, 'utf8');
      unknowns = JSON.parse(data);
    }
  } catch (e) {
    // If file is corrupt or unreadable, start fresh
    unknowns = {};
  }
  if (!(callsign in unknowns)) {
    unknowns[callsign] = Date.now();
    fs.writeFileSync(unknownsPath, JSON.stringify(unknowns, null, 2));
  }
}

function clean_field(val) {
  return (val === null || val === undefined || val === 'undefined') ? '' : val;
}

module.exports = {
  format_adsbdb,
  format_aviationstack,
  format_adsblol_route,
  titleCase,
  addUnknownCallsign,
  clean_field
};