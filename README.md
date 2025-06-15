# Jetstream

# TODO
- Removing heading check
- RapidAPI integration (to do)
- FlightAware API (finish endpoint, add to review system)
- API reordering (AviationStack, RapidAPI, FlightAware API, ADSB.lol, ADSBDB)
  - Consider checking for aircraft first before fetching flight data
- Add fullscreen refresh button
- Hourly-refresh or half-hour refresh to clear any stagnant data on screen
  - Or find a better way to remove icons
- Set 30-day as constant and make 30-day checks on all JSON files
- Add weather widget


A real-time flight tracking visualization application that displays aircraft near your location on an interactive map. The application fetches flight data from multiple APIs, validates flight routes, and provides detailed information about nearby aircraft.

## Features

- **Live Flight Tracking**: Real-time visualization of aircraft within a configurable radius
- **Interactive Map**: Leaflet-based map with aircraft icons, flight paths, and detailed popups
- **Smart Route Validation**: Automated logic checks to verify flight route accuracy
- **Multiple Data Sources**: Integrates with ADSB.lol, ADSBDB, and AviationStack APIs
- **Flight Review System**: Built-in tools for reviewing and correcting flagged flight data
- **Aircraft Type Detection**: Dynamic icon selection based on aircraft type and category
- **Altitude-based Visualization**: Opacity changes based on aircraft altitude

## Quick Start

### Prerequisites
- Node.js and npm
- Make (for automated setup)

### Setup

1. **Install dependencies**:
   ```bash
   make setup
   ```

2. **Generate configuration**:
   ```bash
   make proj_config
   ```

3. **Configure your location**:
   Edit `includes/config.js` to set your coordinates:
   ```javascript
   lat: 37.77697315135698,    // Your latitude
   lon: -122.41922177136804,  // Your longitude
   city_name: 'Your City',
   distance: 10,              // Search radius in miles
   ```

4. **Start the application**:
   ```bash
   make go
   ```

5. **Access the interface**:
   - Main view: http://localhost:5000
   - Flight review tool: http://localhost:5000/review.html

## Configuration Options

The `includes/config.js` file contains all configuration options:

| Option | Description | Default |
|--------|-------------|---------|
| `lat`, `lon` | Your location coordinates | San Francisco |
| `distance` | Search radius in miles | 10 |
| `refreshRate` | Data refresh interval (ms) | 10000 |
| `route_check_threshold` | Route validation threshold (km) | 150 |
| `heading_tolerance` | Heading validation tolerance | Configurable |
| `aviation_stack_api_key` | AviationStack API key (optional) | null |

## Data Sources

The application uses multiple APIs for comprehensive flight data:

1. **ADSB.lol**: Primary source for real-time aircraft positions
2. **ADSBDB**: Flight route and airline information
3. **AviationStack**: Backup data source for route validation

## File Structure

```
jetstream/
├── index.html              # Main application interface
├── review.html             # Flight review tool
├── proxy.js                # Express server and API proxy
├── includes/
│   ├── config.js           # Configuration file (generated)
│   ├── formatters.js       # Data formatting utilities
│   ├── logic_checks.js     # Route validation logic
│   ├── get.js              # API integration functions
│   ├── flights/            # Cached flight data
│   │   ├── flagged/        # Flights requiring review
│   │   └── reviewed/       # Manually reviewed flights
│   └── aircraft/           # Cached aircraft information
├── icons/                  # Aircraft type icons (SVG)
└── styles.css              # Application styling
```

## Flight Review System

The application includes an automated review system for questionable flight data:

- **Automatic Flagging**: Flights are flagged when route logic checks fail
- **Manual Review**: Use the review interface to validate and correct flight data
- **Multiple Actions**: Approve, remove from flagged, or delete entirely

Access the review tool at: http://localhost:5000/review.html

## API Endpoints

The Express server provides several endpoints:

- `GET /planes` - Live aircraft data
- `GET /flightinfo2` - Detailed flight information
- `GET /aircraft` - Aircraft registration details

## Development Commands

```bash
make setup          # Install dependencies
make proj_config     # Generate configuration
make go             # Start development server
make review         # Start with review interface
```

## Customization

### Aircraft Icons
Add custom aircraft icons to the `icons/` directory and update the type/category lookup files:
- `includes/type_lookup.json`
- `includes/category_lookup.json`

### Map Styling
Modify the tile layer URL in `config.js` to change the map appearance.

### Data Processing
Extend the logic in `includes/logic_checks.js` to customize route validation rules.

## Logging

All server activity is logged to `proxy.log` including:
- HTTP requests
- API calls
- Error messages
- Flight validation results

## Troubleshooting

1. **No aircraft showing**: Check your coordinates and distance settings
2. **API errors**: Verify internet connection and API key configuration
3. **Performance issues**: Adjust refresh rate for your system capabilities

## Contributing

1. Follow the existing code style
2. Test changes with `make go`
3. Use the review system to validate any data modifications
4. Commit changes with `make commit`

## License

This project is for educational and personal use. Ensure compliance with all API terms of service.