setup:
	@echo "Checking for Node.js and npm..."
	@if ! command -v node >/dev/null 2>&1; then \
	  echo "Node.js not found. Installing with Homebrew..."; \
	  brew install node; \
	else \
	  echo "Node.js is already installed."; \
	fi
	@if ! command -v npm >/dev/null 2>&1; then \
	  echo "npm not found. Please check your Node.js installation."; \
	else \
	  echo "npm is already installed."; \
	fi
	@echo "Installing npm dependencies..."
	npm install
	@echo "Setup complete!"

CONFIG_FILE=includes/config2.js
GITIGNORE_FILE=.gitignore

config:
	@echo "Generating $(CONFIG_FILE)..."
	@echo "const CONFIG = {" > $(CONFIG_FILE)
	@echo "  lat: 37.77697315135698, // lat of the center of the ADSB radius" >> $(CONFIG_FILE)
	@echo "  lon: -122.41922177136804, // lon of the center of the ADSB radius" >> $(CONFIG_FILE)
	@echo "  center_lat: 37.77697315135698, // lat of the center of the map" >> $(CONFIG_FILE)
	@echo "  center_lon: -122.41922177136804, // lon of the center of the map" >> $(CONFIG_FILE)
	@echo "  use_bbox: true, // Use bounding box for plane fetching: https://boundingbox.klokantech.com/" >> $(CONFIG_FILE)
	@echo "  south_edge: 37.7034, // South edge of the bounding box" >> $(CONFIG_FILE)
	@echo "  north_edge: 37.8125, // North edge of the bounding box" >> $(CONFIG_FILE)
	@echo "  west_edge: -123.0000, // West edge of the bounding box" >> $(CONFIG_FILE)
	@echo "  east_edge: -122.4000, // East edge of the bounding box" >> $(CONFIG_FILE)
	@echo "  city_name: 'San Francisco', // This will become part of the page title - Jetstream: city_name" >> $(CONFIG_FILE)
	@echo "  highlight_color: '#FF8200', // The color of the text and plane markers" >> $(CONFIG_FILE)
	@echo "  maxZoom: 15," >> $(CONFIG_FILE)
	@echo "  initialZoom: 12, // Zoom level for the map" >> $(CONFIG_FILE)
	@echo "  distance: 10, // Distance in miles to search ADSB" >> $(CONFIG_FILE)
	@echo "  route_check_threshold: 150, // Threshold to determine if a plane's origin and departure airports (as reported by adsbdb (and hexdb.io)) are logical, in km" >> $(CONFIG_FILE)
	@echo "  refreshRate: 10000, // Refresh rate in milliseconds" >> $(CONFIG_FILE)
	@echo "  use_downtime: false, // Set to true to use downtime" >> $(CONFIG_FILE)
	@echo "  downtime_start: 21, // Set hour downtime begins" >> $(CONFIG_FILE)
	@echo "  downtime_end: 6, // Set hour downtime ends" >> $(CONFIG_FILE)
	@echo "  downtime_wake_duration_minutes: 2, // The minutes the app will wake up if tapped/touched during downtime" >> $(CONFIG_FILE)
	@echo "  aviationstack_api_key: null, // http://aviationstack.com/" >> $(CONFIG_FILE)
	@echo "  flightera_api_key: null, // https://rapidapi.com/flightera/api/flightera-flight-data/" >> $(CONFIG_FILE)
	@echo "  flightaware_api_key: null // https://www.flightaware.com/commercial/aeroapi/" >> $(CONFIG_FILE)
	@echo "};" >> $(CONFIG_FILE)
	@echo "" >> $(CONFIG_FILE)
	@echo "module.exports = {" >> $(CONFIG_FILE)
	@echo "  CONFIG" >> $(CONFIG_FILE)
	@echo "};" >> $(CONFIG_FILE)

	@echo "Ensuring $(CONFIG_FILE) is in $(GITIGNORE_FILE)..."
	@if [ ! -f $(GITIGNORE_FILE) ]; then \
		echo "Creating $(GITIGNORE_FILE)"; \
		touch $(GITIGNORE_FILE); \
	fi
	@if ! grep -Fxq "$(CONFIG_FILE)" $(GITIGNORE_FILE); then \
		echo "$(CONFIG_FILE)" >> $(GITIGNORE_FILE); \
		echo "Added $(CONFIG_FILE) to $(GITIGNORE_FILE)"; \
	else \
		echo "$(CONFIG_FILE) already in $(GITIGNORE_FILE)"; \
	fi

.PHONY: config

start:
	@echo "Starting server..."
	@npm run dev

.PHONY: start
