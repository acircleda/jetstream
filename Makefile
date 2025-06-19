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
	@echo "  lat: 37.77697315135698," >> $(CONFIG_FILE)
	@echo "  lon: -122.41922177136804," >> $(CONFIG_FILE)
	@echo "  house_lat: 37.77697315135698," >> $(CONFIG_FILE)
	@echo "  house_lon: -122.41922177136804," >> $(CONFIG_FILE)
	@echo "  city_name: 'San Francisco', // your city name" >> $(CONFIG_FILE)
	@echo "  highlight_color: '#FF8200', // The color of the text and plane markers" >> $(CONFIG_FILE)
	@echo "  maxZoom: 15," >> $(CONFIG_FILE)
	@echo "  initialZoom: 12, // Zoom level for the map" >> $(CONFIG_FILE)
	@echo "  distance: 10, // Distance in miles" >> $(CONFIG_FILE)
	@echo "  route_check_threshold: 150, // Threshold to determine if a plane's origin and departure airports (as reported by adsbdb (and hexdb.io)) are logical, in km" >> $(CONFIG_FILE)
	@echo "  heading_tolerance: 15, // Tolerance, in degrees, for heading check of whether a plane is heading towards its destination" >> $(CONFIG_FILE)
	@echo "  refreshRate: 10000, // Refresh rate in milliseconds" >> $(CONFIG_FILE)
	@echo "  use_downtime: false, // Set to true to use downtime" >> $(CONFIG_FILE)
	@echo "  downtime_start: 21, // Set hour downtime begins" >> $(CONFIG_FILE)
	@echo "  downtime_end: 6, // Set hour downtime ends" >> $(CONFIG_FILE)
	@echo "  downtime_refresh: 60000, // Set the refresh rate during downtime" >> $(CONFIG_FILE)
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

go:
	@echo "Starting server..."
	@npm run dev

.PHONY: go

review:
	@echo "Starting server..."
	@echo "Review files at http://localhost:5000/review.html."
	@npm run dev
	
.PHONY: review

commit:
	@echo "Committing ..."
	@git add -A
	@git commit -m "Autocommit"
	@git push
