const { format_adsbdb, 
  format_aviationstack, 
  format_adsblol_route, 
  format_flightaware_live, 
  format_flightera,
  format_month_year} = require('./formatters.js');

const path = require('path');
const fsSync = require('fs');
const fs = require('fs').promises;

async function get_adsblol_route(callsign) {
  const url = "https://api.adsb.lol/api/0/routeset";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        planes: [
          {
            callsign: callsign,
            lat: 0,
            lng: 0
          }
        ]
      })
    });
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      // Not valid JSON (likely HTML error page)
      const text = await response.text();
      console.error('adsb.lol returned non-JSON:', text);
      return { error: 'adsb.lol returned non-JSON response', details: text.slice(0, 200) };
    }
    // Check if the response is valid
    console.log('adsb.lol data:', data);

    const route = data[0]?._airports;
    console.log('adsb.lol route data:', route);
    if (!route || route.length === 0) {
      return { response: 'unknown callsign' };;
    } else {
      const formatted = format_adsblol_route(data);
      console.log('Formatted Data:', formatted);
      return formatted;
    }
  } catch (e) {
    console.error(e);
    return { error: 'Failed to fetch route data from adsb.lol' };
  }
}

async function get_adsbdb(callsign) {
  const url = `https://api.adsbdb.com/v0/callsign/${callsign}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('adsbdb Data:', data);
    if (!data.response.flightroute) {
        return { response: 'unknown callsign' };;
    } else {
      const formatted = format_adsbdb([data.response]);
      console.log('Formatted Data:', formatted);
      return formatted;
    }
  } catch (e) {
    console.error(e);
    // On error, return unknown callsign object
    res.status(500).json({ error: 'Failed to fetch aircraft data from adsbdb' });
  }
}

async function get_aviationstack(callsign, key) {
  if (!key) {
    return { error: 'AviationStack API key is not configured' };
  }
  const url = `https://api.aviationstack.com/v1/flights?flight_icao=${callsign}&access_key=${key}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('aviationstack Data:', data);

    if (!data.data) {
      return { response: 'unknown callsign' };
    } else {
      const formatted = await format_aviationstack(data.data);
      console.log('Formatted Data:', formatted);
      return formatted;
    }
  } catch (e) {
    console.error(e);
    return { error: 'Failed to fetch aircraft data from aviationstack' };
  }
}

async function get_flightaware(callsign, key, threshold) {
  if (!key) {
    return { error: 'FlightAware API key is not configured' };
  }

  const url = `https://aeroapi.flightaware.com/aeroapi/flights/${callsign}`;
  const headers = {
    "Accept": "application/json",
    "x-apikey": key
  };

  const current_month = format_month_year();
  const api_counter_file = path.join(__dirname, '.api_counter_flightaware');

  // Ensure the usage file exists
  if (!fsSync.existsSync(api_counter_file)) {
    console.log('Creating .api_counter_flightaware file');
    await fs.writeFile(api_counter_file, JSON.stringify({ [current_month]: 1 }, null, 2), 'utf8');
  }

  // Read current usage
  const api_counter_json = await fs.readFile(api_counter_file, 'utf8');
  const api_counter = JSON.parse(api_counter_json);
  const current_api_usage = api_counter[current_month];
  console.log('Current FlightAware API usage:', current_api_usage);

  if (current_api_usage >= (threshold-1)) {
    console.log('FlightAware API limit reached');
    return { error: 'FlightAware API limit reached' };
  }

  try {
    // Increment usage count
    api_counter[current_month] = (api_counter[current_month] || 0) + 1;
    await fs.writeFile(api_counter_file, JSON.stringify(api_counter, null, 2), 'utf8');

    // Use real API request
    const response = await fetch(url, { headers });
    const data = await response.json();
    console.log('FlightAware Data:', data);

    const formatted = await format_flightaware_live(data); //STOPPED HERE
    console.log('Formatted FlightAware Data:', formatted);

    if (!formatted.callsign || formatted.length === 0) {
      return { response: 'unknown callsign' };
    } else {
      return formatted;
    }
  } catch (e) {
    console.error('Error during FlightAware API request:', e);
    return { error: 'Failed to fetch aircraft data from FlightAware' };
  }
}

async function replacePrefix(str) {
  const mapping_file = await fs.readFile(path.join(__dirname, 'icao_iata_airline_lookup.json'), 'utf8');
  const mapping = JSON.parse(mapping_file);
  const prefix = str.slice(0, 3);
  if (mapping.hasOwnProperty(prefix)) {
    return mapping[prefix] + str.slice(3);
  }
  return str;
}

async function get_flightera(callsign, key, threshold) {
  if (!key) {
    return { error: 'Flightera API key is not configured' };
  }

  // Convert ICAO to IATA if needed
  const flight_number = await replacePrefix(callsign)
  console.log('converted callsign', callsign, 'to', flight_number); // "OH5048"

  const url = `https://flightera-flight-data.p.rapidapi.com/flight/info?flnr=${flight_number}`;
  const headers = {
    "Accept": "application/json",
    "x-rapidapi-key": key,
    "x-rapidapi-host": "flightera-flight-data.p.rapidapi.com"
  };

  const current_month = format_month_year();
  const api_counter_file = path.join(__dirname, '.api_counter_flightera');

  // Ensure the usage file exists
  if (!fsSync.existsSync(api_counter_file)) {
    console.log('Creating .api_counter_flightera file');
    await fs.writeFile(api_counter_file, JSON.stringify({ [current_month]: 1 }, null, 2), 'utf8');
  }

  // Read current usage
  const api_counter_json = await fs.readFile(api_counter_file, 'utf8');
  const api_counter = JSON.parse(api_counter_json);
  const current_api_usage = api_counter[current_month];
  console.log('Current Flightera API usage:', current_api_usage);

  if (current_api_usage >= (threshold-1)) {
    console.log('Flightera API limit reached');
    return { error: 'Flightera API limit reached' };
  }

  try {
    // Increment usage count
    api_counter[current_month] = (api_counter[current_month] || 0) + 1;
    await fs.writeFile(api_counter_file, JSON.stringify(api_counter, null, 2), 'utf8');

    // Use real API request
    const response = await fetch(url, { headers });
    const data = await response.json();
    console.log('Flightera Data:', data);

    // Or use test data (for development/testing)
    //const testFile = path.join(__dirname, 'flightera_example.json');
    //const data = JSON.parse(await fs.readFile(testFile, 'utf8'));
    //console.log('Flightera Test Data:', data);
    const formatted = await format_flightera(data, callsign);
    console.log('Flightera Formatted Data:', formatted);

    if (!formatted.callsign || formatted.length === 0) {
      return { response: 'unknown callsign' };
    } else {
      return formatted;
    }
  } catch (e) {
    console.error('Error during Flightera API request:', e);
    return { error: 'Failed to fetch aircraft data from Flightera' };
  }
}


module.exports = {
    get_adsbdb,
    get_aviationstack,
    get_adsblol_route,
    get_flightaware,
    get_flightera
};