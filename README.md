# Jetstream

Version: 3.9

# TODO
- Add all APIs to review system
- Add weather widget when no data


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

#### Optional but recommended APIs

By default, the application uses [ADSB.lol](https://api.adsb.lol/docs) and [ADSBDB](https://www.adsbdb.com/) for flight route data. However, these data sources are not completely reliable.

For enhanced route information, you can also use the following free-but-limited APIs:

- **Flightera**: Free tier allows 200 requests/month. Sign up at (https://rapidapi.com/flightera/api/flightera-flight-data/). **No payment information required**.
- **AviationStack**: Free tier allows 100 requests/month. Sign up at https://aviationstack.com/ and get your API key.
- **FlightAware AeroAPI**: Personal tier allows roughly 500 requests/month, after which there is a fee per request. Sign up at (https://www.flightaware.com/commercial/aeroapi/). **Payment information required**. Note: API requests are tracked and the application should preevent you from exceeding your quota.

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
   Edit `includes/config.js` to set your information. This file is git-ignored to protect your API keys and persobal information. See configuration options below.

4. **Start the application**:
   ```bash
   make go
   ```

5. **Access the interface**:
   - Main view: http://localhost:5000
   - Flight review tool: http://localhost:5000/review

## Configuration Options

The `includes/config.js` file contains all configuration options:

| Option | Description | Default |
|--------|-------------|---------|
| `lat`, `lon` | The coordinates of your search radius area | San Francisco |
| `house_lat`, `house_lon` | Your coordinates of the center of the map, which is likely the same as `lat` and `lon` above. This is useful if you want to set a different search radius than the map center. | San Francisco |
| `city_name` | The name of your city. This will become part of the page title, e.g., Jetstream: `city_name` | San Francisco |
| `zipcode` | Your zipcode. This is used for the weather widget. Note: not yet implemented. |  |
| `highlight_color` | The hex code of the color used to highlight aircraft icons and important text. | #FF8200 |
| `maxZoom` | The maximum zoom level for the map. Note: zooming is currently disabled. | 15 |
| `initialZoom` |  The initial zoom level for the map | 12 |
| `distance` | Search radius in miles | 10 |
| `route_check_threshold` | Route validation threshold in (km). | 150 |
| `refreshRate` | Refresh rate, in milliseconds, to check for local aircrafts | 10000 |
| `use_downtime` | Whether to use downtime mode. Downtime mode reduces the refresh rate during certain hours to reduce API usage. | false |
| `downtime_start` | Refresh rate, in milliseconds, to check for local aircrafts | 10000 |
| `downtime_end` | The hour (0-23) to end downtime mode | 6 |
| `downtime_refresh` | Refresh rate, in milliseconds, to check for local aircrafts | 60000 |
| `refreshRate` | Refresh rate, in milliseconds, to check for local aircrafts | 10000 |
| `refreshRate` | Refresh rate, in milliseconds, to check for local aircrafts | 10000 |
| `refreshRate` | Refresh rate, in milliseconds, to check for local aircrafts | 10000 |
| `refreshRate` | Refresh rate, in milliseconds, to check for local aircrafts | 10000 |
| `aviationstack_api_key` | The API key for AviationStack. This is optional, but recommended. | null |
| `flightera_api_key` | The API key for Flightera. This is optional, but recommended. | null |
| `flightaware_api_key` | The API key for FlightAware. This is optional, but recommended. | null |



## Data Sources

The application uses multiple APIs for comprehensive flight data:

1. **ADSB.lol**: Primary source for real-time aircraft positions. This is also checked for flight route information
2. **ADSBDB**: Flight route and aircraft information
3. **Flightera**: Optional API for additional flight route data
3. **Flightaware AeroAPI**: Optional API for additional flight route data

## File Structure

```
jetstream/
├── index.html              # Main application interface
├── review/index.html            # Flight review tool
├── proxy.js                # Express server and API proxy
├── python                  # Scripts for data processing of icons and airports
├── includes/
│   ├── config.js           # Configuration file (generated)
│   ├── formatters.js       # Data formatting utilities
│   ├── logic_checks.js     # Route validation logic
│   ├── get.js              # API integration functions
│   ├── airports.db         # SQLite database of airports
│   ├── flights/            # Cached flight data
│   │   ├── flagged/        # Flights requiring review
│   └── aircraft/           # Cached aircraft information
├── icons/                  # Aircraft type icons (SVG)
└── styles.css              # Application styling
```

## Flight Review System

The application includes an automated review system for questionable flight data:

- **Automatic Flagging**: Flights are flagged when route logic checks fail
- **Manual Review**: Use the review interface to validate and correct flight data
- **Multiple Actions**: Approve, remove from flagged, or delete entirely

Access the review tool at: http://localhost:5000/review

## API Endpoints

The Express server provides several endpoints:

- `GET /planes` - Live aircraft data
- `GET /flightinfo3` - Detailed flight information
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