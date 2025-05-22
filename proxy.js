const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // 👈 this must come BEFORE any routes

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
    const url = `https://api.adsbdb.com/v0/callsign/${callsign}`;
  
    try {
      const response = await fetch(url);
      const data = await response.json();
      res.json(data)
      console.log('Data:', data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch flight info' });
    }
  })

app.listen(3000, () => console.log('Proxy running on http://localhost:3000'));
