const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./includes/config.js').CONFIG;
const { route_logic_check, route_logic_check2, heading_check, heading_check2, simple_heading_check} = require('./includes/logic_checks.js');
const { get_adsbdb, get_aviationstack, get_adsblol_route } = require('./includes/get.js');
const { addUnknownCallsign, clean_field } = require('./includes/formatters.js');
const morgan = require('morgan');

const app = express();
app.use(cors()); // 👈 this must come BEFORE any routes

// Logging setup: capture all console output and errors to proxy.log
const logStream = fs.createWriteStream(path.join(__dirname, 'proxy.log'), { flags: 'a' });
const origConsole = { ...console };
['log', 'info', 'warn', 'error'].forEach(method => {
  console[method] = function (...args) {
    const msg = `[${new Date().toISOString()}] [${method.toUpperCase()}] ` + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') + '\n';
    logStream.write(msg);
    origConsole[method].apply(console, args);
  };
});
process.on('uncaughtException', err => {
  const msg = `[${new Date().toISOString()}] [UNCAUGHT EXCEPTION] ${err.stack || err}\n`;
  logStream.write(msg);
  origConsole.error(err);
});
process.on('unhandledRejection', reason => {
  const msg = `[${new Date().toISOString()}] [UNHANDLED REJECTION] ${reason}\n`;
  logStream.write(msg);
  origConsole.error(reason);
});
// HTTP request logging
app.use(morgan('combined', { stream: logStream }));

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
    console.error(e && (e.stack || e.message || e));
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
    //const url = `http://localhost:3000/adsbdb?callsign=${callsign}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      // Only store if not 'unknown callsign'
      console.log('Fetched data:', data);
      if (!(data && data.response && data.response.flightroute)) {
        res.json(data);
        console.log('Not storing:', callsign, ':', data);
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

app.get('/aircraft', async (req, res) => {
  const { callsign } = req.query;
  const AIRCRAFT_DIR = path.join(__dirname, 'includes', 'aircraft');
  const filePath = path.join(AIRCRAFT_DIR, `${callsign}.json`);
  const unknownsPath = path.join(AIRCRAFT_DIR, '_unknown_aircrafts.json');

  // 1. Try to read the aircraft file if it exists
  if (fs.existsSync(filePath)) {
    try {
      const fileData = fs.readFileSync(filePath, 'utf8');
      res.json(JSON.parse(fileData));
      console.log('Data (from aircraft file):', filePath);
      return;
    } catch (err) {
      console.error('File read error:', err && (err.stack || err.message || err));
      res.status(500).json({ error: 'Failed to read aircraft info file' });
      return;
    }
  }

  // 2. Try to lookup if it is an unknown aircraft
  try {
    if (fs.existsSync(unknownsPath)) {
      const unknownsData = fs.readFileSync(unknownsPath, 'utf8');
      const unknowns = JSON.parse(unknownsData);
      if (unknowns[callsign]) {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - unknowns[callsign] < thirtyDaysMs) {
          res.status(200).json({ response: 'Unknown aircraft previously seen' });
          return;
        }
      }
    }
  } catch (e) {
    console.error('Error checking _unknown_aircrafts.json:', e && (e.stack || e.message || e));
    // If error, continue as normal
  }

  // 3. If not found, fetch and store
  const url = `https://api.adsbdb.com/v0/aircraft/${callsign}`;
  try {
    console.log('Fetching aircraft data for callsign:', callsign);
    const response = await fetch(url);
    const data = await response.json();
    console.log('Aircraft data:', data);
    // If unknown, add to unknowns file
    if (!data || !data.response || data.response === 'unknown aircraft') {
      let unknowns = {};
      if (fs.existsSync(unknownsPath)) {
        try {
          unknowns = JSON.parse(fs.readFileSync(unknownsPath, 'utf8'));
        } catch (e) { unknowns = {}; }
      }
      unknowns[callsign] = Date.now();
      fs.writeFileSync(unknownsPath, JSON.stringify(unknowns, null, 2), 'utf8');
      res.json(data);
      return;
    }
    // Otherwise, store and return
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json(data);
  } catch (e) {
    console.error(e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to fetch aircraft data' });
  }
});

app.get('/flightinfo2', async (req, res) => {
  let { callsign, heading, current_lat, current_lon } = req.query;

  // 1. Check if callsign is present
  if (!callsign) {
    res.status(400).json({ error: 'Missing callsign parameter' });
    return;
  }

  // 2. Trim callsign
  callsign = callsign.trim();
  const filePath = path.join(FLIGHTS_DIR, `${callsign}.json`);

  // 3. Try to read the callsign.json file, if it exists
  if (fs.existsSync(filePath)) {
    try {
      const fileData = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(fileData);
      const fileTimestamp = jsonData.timestamp ? new Date(jsonData.timestamp).getTime() : null;
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      //if the file is less than 90 days old, return the data
      if (fileTimestamp && (Date.now() - fileTimestamp <= ninetyDaysMs)) {
        // Check heading and swap if needed before returning
        let headingRes = null;
        if (jsonData.origin && jsonData.destination) {
          console.log('Heading check for flight (from file):', callsign);
          //headingRes = heading_check2(jsonData, heading, CONFIG.heading_tolerance);
          headingRes = simple_heading_check(current_lat, current_lon, jsonData, heading, CONFIG.heading_tolerance);
        }
        console.log('heading check (from file):', headingRes);
        if (headingRes === false) {
          const swappedData = {
            ...jsonData,
            origin: jsonData.destination,
            destination: jsonData.origin
          };
          console.log('Swapped origin and destination in returned data (from file)');
          res.json(swappedData);
          console.log('Data (swapped and returned from file):', swappedData);
          return;
        }
        res.json(jsonData);
        console.log('Data (from file):', filePath);
        return;
      } else {
        console.log('File is older than 90 days, skipping:', filePath);
      }
    } catch (err) {
      console.error('File read error:', err);
      res.status(500).json({ error: 'Failed to read flight info file' });
      return;
    }
  }
  //try to lookup if it is an unknown callsign
  try {
    const unknownsPath = path.join(__dirname, 'includes', 'flights', '_unknown_routes.json');
    if (fs.existsSync(unknownsPath)) {
      const unknownsData = fs.readFileSync(unknownsPath, 'utf8');
      const unknowns = JSON.parse(unknownsData);
      if (unknowns[callsign]) {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - unknowns[callsign] < thirtyDaysMs) {
          res.status(200).json({ response: 'Unknown call sign previously seen' });
          return;
        }
      }
    }
  } catch (e) {
    console.error('Error checking _unknown_routes.json:', e);
  }

  try {
    // 4. If it does not exist or is older than 90 days, attempt to get data from adsb.lol
      console.log('Fetching adsb.lol data for flight:', callsign);
      let data = await get_adsblol_route(callsign);
      //let data = await get_adsbdb(callsign);
      console.log('Fetched adsb.lol data:', data);

    // 5. If the data exists, run a logic check on the route
    let route_is_valid; // Declare outside so it's accessible later
    if(data.callsign){
      console.log('Route logic check for adsb.lol data and flight:', callsign);
      let route_logic_check_result;
      try {
        route_logic_check_result = route_logic_check2(data, CONFIG.lat, CONFIG.lon);
        route_is_valid = route_logic_check_result <= CONFIG.route_check_threshold;
        console.log('crossTrackDistance:', route_logic_check_result, 'is route valid:', route_is_valid);
      } catch (err) {
        console.error('Route logic check error:', err);
        route_is_valid = false;
      }
    }

    // 6. If the data does not exist or the route_is_valid is false, try to get data from adsblol
    //if(CONFIG.enable_adsblol){
      if(!data.callsign || route_is_valid === false) {
        if(!data.callsign) { console.log('No callsign found in adsb.lol data, trying adsblol'); }
        if(route_is_valid === false) { console.log('Route logic check failed adsb.lol data for flight:', callsign); }
        console.log('Fetching adsbdb data for flight:', callsign);
        data = await get_adsbdb(callsign);
        console.log('Fetched adsbdb data:', data);
      
        // 7. If the data exists, run a logic check on the route
        if(data.callsign){
        console.log('Route logic check for adsbdb data and flight:', callsign);
        let route_logic_check_result;
        try {
          route_logic_check_result = route_logic_check2(data, CONFIG.lat, CONFIG.lon);
          route_is_valid = route_logic_check_result <= CONFIG.route_check_threshold;
          console.log('crossTrackDistance:', route_logic_check_result, 'is route valid:', route_is_valid, 'threshold:', CONFIG.route_check_threshold);
        } catch (err) {
          console.error('Route logic check error:', err);
          route_is_valid = false;
        }
        }
      }
    //}

    // 8. If the data is empty, don't store the file and return
     if (!data.callsign) {
        addUnknownCallsign(callsign);
        console.log('Not storing data for:', callsign);
        return;
    }

    // 9. Otherwise, save the data
      console.log('Saving data to file:', filePath);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    // 10. If the logic check still fails, copy file to flagged, then get new data from get_aviationstack
      if (!route_is_valid) {
        console.log('Route logic check failed for flight:', callsign, 'Flagging for review');
        const flaggedDir = path.join(__dirname, 'includes', 'flights', 'flagged');
        if (!fs.existsSync(flaggedDir)) {
          fs.mkdirSync(flaggedDir, { recursive: true });
        }
        const flaggedPath = path.join(flaggedDir, `${callsign}.json`);
        fs.copyFileSync(filePath, flaggedPath);
        
    if(CONFIG.aviation_stack_api_key){
        // Get new data from aviationstack
        console.log('Fetching aviationstack data for flight:', callsign);
        const aviationstackData = await get_aviationstack(callsign, CONFIG.aviation_stack_api_key);
        console.log('Fetched aviationstack data:', aviationstackData);
        // Overwrite file with aviationstack data if valid
        if (aviationstackData.callsign) {
          console.log('Overwriting file with aviationstack data:', filePath);
          data = aviationstackData;
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        }
      }
  }

  // TODO if error from aviation stack, try aeroapi

    // 11. If successful data, check the heading.
    let headingRes = null;
    if (data.origin && data.destination) {
      console.log('Heading check for flight:', callsign);
      //headingRes = heading_check2(data, heading, CONFIG.heading_tolerance);
      headingRes = simple_heading_check(current_lat, current_lon, data, heading, CONFIG.heading_tolerance);
    }
    console.log('heading check:', headingRes);

    // 12. If the heading is not within tolerance, swap the destination and origin.
    if (headingRes === false) {
      // Rebuild the JSON with swapped origin and destination
      const swappedData = {
        ...data,
        origin: data.destination,
        destination: data.origin
      };
      console.log('Swapped origin and destination in returned data');
      res.json(swappedData);
      console.log('Data (swapped and returned):', swappedData);
      return;
    }

    // 13. Return the data
    res.json(data);
    console.log('Data (fetched and saved):', filePath);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch flight info' });
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
  const reviewDir = path.join(__dirname, 'includes', 'flights', 'flagged');
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

// List flagged files
app.get('/flagged_files', (req, res) => {
  const flaggedDir = path.join(__dirname, 'includes', 'flights', 'flagged');
  if (!fs.existsSync(flaggedDir)) return res.json([]);
  const files = fs.readdirSync(flaggedDir).filter(f => f.endsWith('.json'));
  res.json(files);
});

// Get a single flagged file's contents
app.get('/flagged_file', (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).send('Missing file');
  const flaggedDir = path.join(__dirname, 'includes', 'flights', 'flagged');
  const filePath = path.join(flaggedDir, file);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.type('application/json').send(fs.readFileSync(filePath, 'utf8'));
});

// API: get_adsblol_route
app.get('/api_adsblol', async (req, res) => {
  const { callsign } = req.query;
  if (!callsign) return res.status(400).json({ error: 'Missing callsign' });
  try {
    const data = await get_adsblol_route(callsign);
    res.json(data);
  } catch (e) {
    console.error('get_adsblol_route error:', e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to fetch from adsblol' });
  }
});

// API: get_aviationstack
app.get('/api_aviationstack', async (req, res) => {
  const { callsign } = req.query;
  if (!callsign) return res.status(400).json({ error: 'Missing callsign' });
  try {
    const data = await get_aviationstack(callsign, CONFIG.aviation_stack_api_key);
    res.json(data);
  } catch (e) {
    console.error('get_aviationstack error:', e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to fetch from aviationstack' });
  }
});

// Approve: overwrite flagged file and move to flights
app.post('/approve_flagged', express.json({limit: '2mb'}), (req, res) => {
  const file = req.query.file;
  const reviewSource = req.body && req.body.api_source ? req.body.api_source : (req.body && req.body.review_source ? req.body.review_source : 'unknown');
  if (!file) return res.status(400).json({ error: 'Missing file' });
  const flaggedDir = path.join(__dirname, 'includes', 'flights', 'flagged');
  const flightsDir = path.join(__dirname, 'includes', 'flights');
  const reviewedDir = path.join(__dirname, 'includes', 'flights', 'reviewed');
  const flaggedPath = path.join(flaggedDir, file);
  const destPath = path.join(flightsDir, file);
  const reviewedPath = path.join(reviewedDir, file);
  try {
    // Ensure reviewed folder exists
    if (!fs.existsSync(reviewedDir)) {
      fs.mkdirSync(reviewedDir, { recursive: true });
    }
    // Add reviewed fields
    let data = req.body;
    data.reviewed = true;
    data.review_source = reviewSource;
    // Write to reviewed first
    fs.writeFileSync(reviewedPath, JSON.stringify(data, null, 2), 'utf8');
    // Write to flights (overwrite or create)
    fs.writeFileSync(destPath, JSON.stringify(data, null, 2), 'utf8');
    // Remove from flagged if it exists
    if (fs.existsSync(flaggedPath)) {
      fs.unlinkSync(flaggedPath);
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Approve flagged error:', e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// Remove from flagged only
app.post('/remove_flagged', (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).json({ error: 'Missing file' });
  const flaggedDir = path.join(__dirname, 'includes', 'flights', 'flagged');
  const flaggedPath = path.join(flaggedDir, file);
  try {
    if (fs.existsSync(flaggedPath)) {
      fs.unlinkSync(flaggedPath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Flagged file not found' });
    }
  } catch (e) {
    console.error('Remove flagged error:', e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to remove from flagged' });
  }
});

// Delete from flagged and flights
app.post('/delete_everywhere', (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).json({ error: 'Missing file' });
  const flaggedDir = path.join(__dirname, 'includes', 'flights', 'flagged');
  const flightsDir = path.join(__dirname, 'includes', 'flights');
  const flaggedPath = path.join(flaggedDir, file);
  const flightsPath = path.join(flightsDir, file);
  let deleted = false;
  try {
    if (fs.existsSync(flaggedPath)) {
      fs.unlinkSync(flaggedPath);
      deleted = true;
    }
    if (fs.existsSync(flightsPath)) {
      fs.unlinkSync(flightsPath);
      deleted = true;
    }
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found in flagged or flights' });
    }
  } catch (e) {
    console.error('Delete everywhere error:', e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Global error handler to log all errors
app.use((err, req, res, next) => {
  console.error('Express error handler:', err && (err.stack || err.message || err));
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
