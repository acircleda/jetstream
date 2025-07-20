const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const CONFIG = require('./includes/config.js').CONFIG;
const { route_logic_check, route_logic_check2, heading_check, heading_check2, simple_heading_check, smart_heading_check} = require('./includes/logic_checks.js');
const { get_adsbdb, get_aviationstack, get_adsblol_route, get_flightaware, get_flightera } = require('./includes/get.js');
const { addUnknownCallsign, clean_field } = require('./includes/formatters.js');
const morgan = require('morgan');
const { update_flight_counter } = require('./includes/flight_counter');

const app = express();
app.use(express.json())
app.use(cors()); // 👈 this must come BEFORE any routes
thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

const LOG_PATH = path.join(__dirname, 'proxy.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

async function rotateLogIfNeeded() {
  try {
    if (fsSync.existsSync(LOG_PATH)) {
      const stats = await fs.stat(LOG_PATH);
      if (stats.size >= MAX_LOG_SIZE) {
        const archiveName = `proxy.log.${Date.now()}`;
        await fs.rename(LOG_PATH, path.join(__dirname, archiveName));
      }
    }
  } catch (e) {
    origConsole.error('Log rotation error:', e);
  }
}

// Logging setup: capture all console output and errors to proxy.log
const logStream = fsSync.createWriteStream(LOG_PATH, { flags: 'a' });
const origConsole = { ...console };

// Cache log rotation check for performance
let lastRotationCheck = 0;
const ROTATION_CHECK_INTERVAL = 60000; // Check every minute

['log', 'info', 'warn', 'error'].forEach(method => {
  console[method] = function (...args) {
    const now = Date.now();
    if (now - lastRotationCheck > ROTATION_CHECK_INTERVAL) {
      rotateLogIfNeeded().catch(err => origConsole.error('Log rotation error:', err));
      lastRotationCheck = now;
    }
    const msg = `[${new Date().toISOString()}] [${method.toUpperCase()}] ` + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') + '\n';
    fs.appendFile(LOG_PATH, msg).catch(err => origConsole.error('Log write error:', err));
    origConsole[method].apply(console, args);
  };
});

process.on('uncaughtException', err => {
  const msg = `[${new Date().toISOString()}] [UNCAUGHT EXCEPTION] ${err.stack || err}\n`;
  fs.appendFile(LOG_PATH, msg).catch(() => {});
  origConsole.error(err);
});

process.on('unhandledRejection', reason => {
  const msg = `[${new Date().toISOString()}] [UNHANDLED REJECTION] ${reason}\n`;
  fs.appendFile(LOG_PATH, msg).catch(() => {});
  origConsole.error(reason);
});

// HTTP request logging
app.use(morgan('combined', { stream: logStream }));

const FLIGHTS_DIR = path.join(__dirname, 'includes', 'flights');

if (!fsSync.existsSync(FLIGHTS_DIR)) {
  fsSync.mkdirSync(FLIGHTS_DIR, { recursive: true });
}

// In-memory cache for frequently requested data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key, data) {
  // Implement LRU eviction if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// Disk space management for Raspberry Pi
async function getDirectorySize(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error calculating directory size:', error);
    return 0;
  }
}

async function cleanupOldFlights() {
  if (!CONFIG.cleanup_enabled) return;
  
  try {
    const flightsDir = path.join(__dirname, 'includes', 'flights');
    const currentSize = await getDirectorySize(flightsDir);
    const maxSizeBytes = CONFIG.max_flights_dir_size_mb * 1024 * 1024;
    
    console.log(`Flights directory size: ${(currentSize / 1024 / 1024).toFixed(2)}MB / ${CONFIG.max_flights_dir_size_mb}MB`);
    
    if (currentSize <= maxSizeBytes) {
      return; // No cleanup needed
    }
    
    console.log('Disk space limit exceeded, starting cleanup...');
    
    // Get all flight files with their modification times
    const files = await fs.readdir(flightsDir);
    const flightFiles = [];
    
    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('_') && !file.includes('flagged') && !file.includes('reviewed')) {
        const filePath = path.join(flightsDir, file);
        const stats = await fs.stat(filePath);
        flightFiles.push({
          name: file,
          path: filePath,
          mtime: stats.mtime,
          size: stats.size
        });
      }
    }
    
    // Sort by modification time (oldest first)
    flightFiles.sort((a, b) => a.mtime - b.mtime);
    
    // Remove oldest files in batches
    const filesToRemove = flightFiles.slice(0, CONFIG.cleanup_batch_size);
    let removedSize = 0;
    let removedCount = 0;
    
    for (const file of filesToRemove) {
      try {
        await fs.unlink(file.path);
        removedSize += file.size;
        removedCount++;
        console.log(`Removed old flight file: ${file.name}`);
      } catch (error) {
        console.error(`Error removing file ${file.name}:`, error);
      }
    }
    
    console.log(`Cleanup completed: Removed ${removedCount} files, freed ${(removedSize / 1024 / 1024).toFixed(2)}MB`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Track last cleanup check to avoid excessive checking
let lastCleanupCheck = 0;

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

app.get('/planes2', async (req, res) => {
  const { lat, lon, dist, use_bbox, minLat, maxLat, minLon, maxLon } = req.query;

  const url = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('Found', data.ac ? data.ac.length : 0, "planes");
    let aircraftList = data.ac || [];

    // Optionally filter using bounding box
    if (use_bbox === 'true') {
      const bounds = {
        minLat: parseFloat(minLat),
        maxLat: parseFloat(maxLat),
        minLon: parseFloat(minLon),
        maxLon: parseFloat(maxLon)
      };

      aircraftList = aircraftList.filter(ac =>
        ac.lat >= bounds.minLat &&
        ac.lat <= bounds.maxLat &&
        ac.lon >= bounds.minLon &&
        ac.lon <= bounds.maxLon
      );
    }

    if (use_bbox === 'true') { console.log('Found', aircraftList.length, "planes in bounding box"); }
    res.json({ ...data, ac: aircraftList });
  } catch (e) {
    console.error(e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to fetch aircraft data' });
  }
});


app.get('/aircraft', async (req, res) => {
  const { callsign, reg } = req.query;
  
  const callsign_trimmed = callsign.trim();

  // Check cache first
  const cacheKey = `aircraft:${callsign_trimmed}`;
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    res.json(cachedData);
    console.log('Data (from cache):', callsign_trimmed);
    return;
  }
  
  const AIRCRAFT_DIR = path.join(__dirname, 'includes', 'aircraft');
  const filePath = path.join(AIRCRAFT_DIR, `${callsign_trimmed}.json`);
  const unknownsPath = path.join(AIRCRAFT_DIR, '_unknown_aircrafts.json');

  // 1. Try to read the aircraft file if it exists
  try {
    const fileData = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileData);
    setCachedData(cacheKey, data);
    res.json(data);
    console.log('Data (from aircraft file):', filePath);
    return;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('File read error:', err && (err.stack || err.message || err));
      res.status(500).json({ error: 'Failed to read aircraft info file' });
      return;
    }
    // File doesn't exist, continue to check unknowns
  }

  // 2. Try to lookup if it is an unknown aircraft
  try {
    const unknownsData = await fs.readFile(unknownsPath, 'utf8');
    const unknowns = JSON.parse(unknownsData);
    if (unknowns[callsign]) {
      if (Date.now() - unknowns[callsign_trimmed] < thirtyDaysMs) {
        res.status(200).json({ response: 'Unknown aircraft previously seen' });
        return;
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('Error checking _unknown_aircrafts.json:', e && (e.stack || e.message || e));
    }
    // If error or file doesn't exist, continue as normal
  }

  // 3. If not found, fetch and store
  const url = `https://api.adsbdb.com/v0/aircraft/${reg}`;
  try {
    console.log('Fetching aircraft data for callsign:', callsign_trimmed);
    const response = await fetch(url);
    const data = await response.json();
    console.log('Aircraft data:', data);
    // If unknown, add to unknowns file
    if (!data || !data.response || data.response === 'unknown aircraft') {
      let unknowns = {};
      try {
        const unknownsData = await fs.readFile(unknownsPath, 'utf8');
        unknowns = JSON.parse(unknownsData);
      } catch (e) { 
        unknowns = {}; 
      }
      unknowns[callsign_trimmed] = Date.now();
      await fs.writeFile(unknownsPath, JSON.stringify(unknowns, null, 2), 'utf8');
      setCachedData(cacheKey, data);
      res.json(data);
      return;
    }
    // Otherwise, store and return
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    setCachedData(cacheKey, data);
    res.json(data);
  } catch (e) {
    console.error(e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to fetch aircraft data' });
  }
});

app.get('/flightinfo', async (req, res) => {
  let { callsign, heading, current_lat, current_lon } = req.query;

  // 1. Check if callsign is present
  if (!callsign) {
    res.status(400).json({ error: 'Missing callsign parameter' });
    return;
  }

  // 2. Trim callsign
  callsign = callsign.trim();
  const filePath = path.join(FLIGHTS_DIR, `${callsign}.json`);

  // 3. Try to read the flight file, if it exists
  try {
    const fileData = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(fileData);
    const fileTimestamp = jsonData.timestamp ? new Date(jsonData.timestamp).getTime() : null;
    //if the file is less than 30 days old, return the data
    if (fileTimestamp && (Date.now() - fileTimestamp <= thirtyDaysMs)) {
        // Check heading and swap if needed before returning
        /*
        let headingRes = null;
        if (jsonData.origin && jsonData.destination) {
          console.log('Heading check for flight (from file):', callsign);
          //headingRes = heading_check2(jsonData, heading, CONFIG.heading_tolerance);
          headingRes = smart_heading_check(current_lat, current_lon, jsonData, heading);
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
          */
        res.json(jsonData);
        console.log('Data (from file):', filePath);
        return;
      } else {
        console.log('File is older than 90 days, skipping:', filePath);
      }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('File read error:', err);
      res.status(500).json({ error: 'Failed to read flight info file' });
      return;
    }
    // File doesn't exist, continue to fetch from API
  }
  //try to lookup if it is an unknown callsign
  try {
    const unknownsPath = path.join(__dirname, 'includes', 'flights', '_unknown_routes.json');
    const unknownsData = await fs.readFile(unknownsPath, 'utf8');
    const unknowns = JSON.parse(unknownsData);
    if (unknowns[callsign]) {
      if (Date.now() - unknowns[callsign] < thirtyDaysMs) {
        res.status(200).json({ response: 'Unknown call sign previously seen' });
        return;
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('Error checking _unknown_routes.json:', e);
    }
    // If error or file doesn't exist, continue as normal
  }

  try {
    // 4. If it does not exist or is older than 30 days, attempt to get data from APIs

    // 4.1 - Flightera
      console.log('Fetching Flightera data for flight:', callsign);
      data = await get_flightera(callsign, CONFIG.flightera_api_key, threshold = 50);
      console.log('Fetched Flightera data:', data);

    // 4.2 - Aviation Stack
      if(!data.callsign){
      console.log('Fetching Aviation Stack data for flight:', callsign);
      let data = await get_aviationstack(callsign, CONFIG.aviationstack_api_key);
      console.log('Fetched Aviation Stack data:', data);
      }

    // 4.3 - FlightAware
      if(!data.callsign){
        console.log('Fetching FlightAware data for flight:', callsign);
        data = await get_flightaware(callsign, CONFIG.flightaware_api_key, threshold = 500);
        console.log('Fetched FlightAware data:', data);
      }

    // 4.4 - adsblol
      if(!data.callsign){
        console.log('Fetching adsblol data for flight:', callsign);
        data = await get_adsblol_route(callsign);
        console.log('Fetched adsblol data:', data);
      }

    // 4.5 - adsbdb
      if(!data.callsign){
        console.log('Fetching adsbdb data for flight:', callsign);
        data = await get_adsbdb(callsign);
        console.log('Fetched adsbdb data:', data);
      }

    // 5. If the data is still empty, don't store the file and return
     if (!data.callsign) {
        addUnknownCallsign(callsign);
        console.log('Adding unknown callsign for', callsign);
        return;
    }

    // 6.  If the data exists, save the data
    console.log('Saving data to file:', filePath);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    // Trigger cleanup check after saving new flight data
    const now = Date.now();
    const checkInterval = CONFIG.cleanup_check_interval_minutes * 60 * 1000;
    if (now - lastCleanupCheck > checkInterval) {
      lastCleanupCheck = now;
      // Run cleanup in background without blocking response
      cleanupOldFlights().catch(err => console.error('Background cleanup error:', err));
    }

    // 7. If the data exists, run a logic check on the route
    console.log('Route logic check for flight:', callsign);
    let route_is_valid; // Declare outside so it's accessible later
    let route_logic_check_result;
    try {
        route_logic_check_result = route_logic_check2(data, CONFIG.lat, CONFIG.lon);
        route_is_valid = route_logic_check_result <= CONFIG.route_check_threshold;
        console.log('crossTrackDistance:', route_logic_check_result, 'is route valid:', route_is_valid, 'threshold:', CONFIG.route_check_threshold);
    } catch (err) {
        console.error('Route logic check error:', err);
        route_is_valid = false;
    }

    // append the route logic check result to the data
    data.valid = route_is_valid;
    if (!route_is_valid) {
        console.log('Route logic check failed for flight:', callsign, 'Flagging for review');
      }


    // 9. Check the heading.
    /*
    let headingRes = null;
    if (data.origin && data.destination) {
      console.log('Heading check for flight:', callsign);
      headingRes = smart_heading_check(current_lat, current_lon, jsonData, heading);
      //headingRes = simple_heading_check(current_lat, current_lon, data, heading, CONFIG.heading_tolerance);
    }
    console.log('heading check:', headingRes);

    // 10. If the heading is not within tolerance, swap the destination and origin.
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
      */

      // 11. Return the data
      res.json(data);
      console.log('Data (fetched and saved):', filePath);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch flight info' });
    }
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


app.get('/api_flightaware', async (req, res) => {
  const { callsign } = req.query;
  if (!callsign) return res.status(400).json({ error: 'Missing callsign' });
  try {
    const data = await get_flightaware(callsign, CONFIG.flightaware_api_key, threshold = 500);
    res.json(data);
  } catch (e) {
    console.error('get_flightaware error:', e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to fetch from FlightAware' });
  }
});

app.get('/api_flightera', async (req, res) => {
  const { callsign } = req.query;
  if (!callsign) return res.status(400).json({ error: 'Missing callsign' });
  try {
    const data = await get_flightera(callsign, CONFIG.flightera_api_key, threshold = 200);
    res.json(data);
  } catch (e) {
    console.error('get_flightera error:', e && (e.stack || e.message || e));
    res.status(500).json({ error: 'Failed to fetch from Flightera' });
  }
});

app.post('/log-flight', async (req, res) => {
  const { flightId } = req.body;
  if (!flightId) {
    return res.status(400).json({ error: 'Missing flightId' });
  }
  try {
    await update_flight_counter(flightId);
    console.log(`Flight ${flightId} logged successfully.`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET endpoint to return today's flight count
app.get('/flight-count', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const filePath = path.join(__dirname, 'includes', 'flight_counters.json');
    let counters = {};
    if (fsSync.existsSync(filePath)) {
      counters = JSON.parse(fsSync.readFileSync(filePath, 'utf8'));
    }
    const count = Array.isArray(counters[today]) ? counters[today].length : 0;
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global error handler to log all errors
app.use((err, req, res, next) => {
  console.error('Express error handler:', err && (err.stack || err.message || err));
  res.status(500).json({ error: 'Internal server error' });
});

// Periodic cleanup check
if (CONFIG.cleanup_enabled) {
  const cleanupInterval = CONFIG.cleanup_check_interval_minutes * 60 * 1000;
  setInterval(() => {
    cleanupOldFlights().catch(err => console.error('Periodic cleanup error:', err));
  }, cleanupInterval);
  
  console.log(`Disk cleanup enabled: max ${CONFIG.max_flights_dir_size_mb}MB, checking every ${CONFIG.cleanup_check_interval_minutes} minutes`);
}

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
