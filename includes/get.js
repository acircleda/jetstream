const { format_adsbdb, 
  format_aviationstack, 
  format_adsblol_route, 
  format_flightaware_live, format_flightaware_all } = require('./formatters.js');
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

async function get_flightaware(callsign, key) {
  if (!key) {
    return { error: 'FlightAware API key is not configured' };
  }

  const url = `https://aeroapi.flightaware.com/aeroapi/flights/${callsign}`;
  const headers = {
    "Accept": "application/json",
    "x-apikey": key
  };

  const api_counter_file = path.join(__dirname, '.flightaware');

  // Ensure the usage file exists
  if (!fsSync.existsSync(api_counter_file)) {
    console.log('Creating .flightaware file');
    await fs.writeFile(api_counter_file, '0', 'utf8'); // Write initial value "0"
  }

  // Read current usage
  const api_counter = await fs.readFile(api_counter_file, 'utf8');
  const current_api_usage = parseInt(api_counter || '0');
  console.log('Current FlightAware API usage:', current_api_usage);

  if (current_api_usage >= 499) {
    console.log('FlightAware API limit reached');
    return { error: 'FlightAware API limit reached' };
  }

  try {
    // Increment usage count
    const new_api_usage = current_api_usage + 1;
    await fs.writeFile(api_counter_file, String(new_api_usage), 'utf8');

    // Use real API request
    //const response = await fetch(url, { headers });
    //const data = await response.json();

    // Or use test data (for development/testing)
    const testFile = path.join(__dirname, 'example.json');
    const data = JSON.parse(await fs.readFile(testFile, 'utf8'));
    console.log('FlightAware Test Data:', data);
    const formatted = await format_flightaware_live(data); //STOPPED HERE
    console.log('Formatted FlightAware Data:', formatted);

    if (!data.data || data.data.length === 0) {
      return { response: 'unknown callsign' };
    } else {
      return data;
    }
  } catch (e) {
    console.error('Error during FlightAware API request:', e);
    return { error: 'Failed to fetch aircraft data from FlightAware' };
  }
}


module.exports = {
    get_adsbdb,
    get_aviationstack,
    get_adsblol_route,
    get_flightaware
};