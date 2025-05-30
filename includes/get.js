const { format_adsbdb, format_aviationstack, format_adsblol_route } = require('./formatters.js');

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

module.exports = {
    get_adsbdb,
    get_aviationstack,
    get_adsblol_route
};