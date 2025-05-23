const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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
    //res.setHeader('Access-Control-Allow-Origin', '*'); // optional backup
    res.json(data)
    console.log('Data:', data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch aircraft data' });
  }
});

app.get('/flightinfo', async (req, res) => {
    const { callsign } = req.query;
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
      // Store as JSON file
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      res.json(data);
      console.log('Data (fetched and saved):', filePath);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch flight info' });
    }
  })

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
