const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./includes/config.js').CONFIG;
const { route_logic_check, heading_check } = require('./includes/logic_checks.js');
const { format_adsbdb , format_aviationstack} = require('./includes/formatters.js');

const app = express();
app.use(cors()); // 👈 this must come BEFORE any routes

const FLIGHTS_DIR = path.join(__dirname, 'includes', 'flights');
if (!fs.existsSync(FLIGHTS_DIR)) {
  fs.mkdirSync(FLIGHTS_DIR, { recursive: true });
}

app.get('/planes', async (req, res) => {
  const { lat, lon, dist } = req.query;
  const url = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Data:', data);
    res.json(data)
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch aircraft data' });
  }
});

app.get('/flightinfo', async (req, res) => {
  
    let { callsign, heading } = req.query;
    callsign = callsign ? callsign.trim() : null; // Ensure callsign is trimmed
    if (!callsign) {
      res.status(400).json({ error: 'Missing callsign parameter' });
      return;
    }
    const filePath = path.join(FLIGHTS_DIR, `${callsign}.json`);
    if (fs.existsSync(filePath)) {
      // If file exists, return its contents
      try {
        const fileData = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(fileData));
        console.log('Data (from file):', filePath);
        return;
      } catch (err) {
        console.error('File read error:', err);
        res.status(500).json({ error: 'Failed to read flight info file' });
        return;
      }
    }
    // If not found, fetch and store
    const url = `https://api.adsbdb.com/v0/callsign/${callsign}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      // Only store if not 'unknown callsign'
      console.log('Fetched data:', data);
      if (data && data.response && data.response === 'unknown callsign') {
        res.json(data);
        console.log('Unknown callsign, not storing:', callsign);
        return;
      }
      // Store as JSON file first
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      try {
        const origin = data?.response?.flightroute?.origin;
        const destination = data?.response?.flightroute?.destination;
        console.log('Route logic check for flight:', callsign);
        if (origin && destination ) {
          // Use route_logic_check directly
          const logicRes = route_logic_check(data.response, CONFIG.lat, CONFIG.lon);
          console.log('crossTrackDistance:', logicRes);
          // Flag if crossTrackDistance exceeds threshold
          if (!isNaN(logicRes) && logicRes > CONFIG.route_check_threshold) {
            const flaggedDir = path.join(__dirname, 'includes', 'flights', 'flagged');
            if (!fs.existsSync(flaggedDir)) {
              fs.mkdirSync(flaggedDir, { recursive: true });
            }
            const flaggedPath = path.join(flaggedDir, `${callsign}.json`);
            fs.copyFileSync(filePath, flaggedPath);
            console.log(`Flight ${callsign} flagged: crossTrackDistance ${logicRes} > threshold ${CONFIG.route_check_threshold}`);
          } else {
            // If logicRes is within threshold, perform heading check
            const headingRes = heading_check(data.response, heading, CONFIG.heading_tolerance);
            console.log('heading check:', headingRes);
            if (headingRes === false) {
              // Swap origin and destination in the response (not in file)
              const temp = data.response.flightroute.origin;
              data.response.flightroute.origin = data.response.flightroute.destination;
              data.response.flightroute.destination = temp;
              console.log('Swapped origin and destination in returned data');
            }
          }
        }
      } catch (logicErr) {
        console.error('Error extracting or sending to logic_check:', logicErr);
      }
      res.json(data);
      console.log('Data (fetched and saved):', filePath);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch flight info' });
    }
  })

app.get('/adsbdb', async (req, res) => {
  const { callsign } = req.query;
  const url = `https://api.adsbdb.com/v0/callsign/${callsign}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('adsbdb Data:', data);

    if (data && data.response && data.response === 'unknown callsign') {
      res.json(data);
      return;
    } else {
      const formatted = format_adsbdb([data.response]);
      console.log('Formatted Data:', formatted);
      res.json(formatted);
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch aircraft data from adsbdb' });
  }
});

app.get('/aviationstack', async (req, res) => {
  const { callsign } = req.query;
  if (!CONFIG.aviation_stack_api_key){
    res.status(400).json({ error: 'AviationStack API key is not configured' });
    return;
  }
  const url = `https://api.aviationstack.com/v1/flights?flight_icao=${callsign}&access_key=${CONFIG.aviation_stack_api_key}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const formatted = await format_aviationstack(data.data);
    res.json(formatted);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch aircraft data from aviationstack' });
  }
});

app.post('/move_for_review', express.json(), (req, res) => {
  let callsign = req.query.callsign;
  if (!callsign) {
    res.status(400).json({ error: 'Missing callsign parameter' });
    return;
  }
  // Remove whitespace from callsign (e.g., trailing spaces)
  callsign = callsign.trim();
  const srcPath = path.join(FLIGHTS_DIR, `${callsign}.json`);
  const reviewDir = path.join(__dirname, 'includes', 'flights', 'for_review');
  const destPath = path.join(reviewDir, `${callsign}.json`);
  try {
    if (!fs.existsSync(srcPath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    if (!fs.existsSync(reviewDir)) {
      fs.mkdirSync(reviewDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
    res.json({ success: true });
  } catch (e) {
    console.error('Error moving file for review:', e);
    res.status(500).json({ error: 'Failed to move file for review' });
  }
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
