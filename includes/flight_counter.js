const fs = require('fs');
const path = require('path');

async function update_flight_counter(flightId) {
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const filePath = path.join(__dirname, 'flight_counters.json');

  let counters = {};
  if (fs.existsSync(filePath)) {
    counters = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  if (!Array.isArray(counters[today])) {
    counters[today] = [];
  }

  if (!counters[today].includes(flightId.trim())) {
    counters[today].push(flightId.trim());
    fs.writeFileSync(filePath, JSON.stringify(counters, null, 2));
    console.log(`Added flight ${flightId} to ${today}.`);
  } else {
    console.log(`Flight ${flightId} already logged for ${today}.`);
  }
}

module.exports = {
    update_flight_counter
};