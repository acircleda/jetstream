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

CONFIG_FILE=includes/config.js
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
	@echo "  // Refresh rate and downtime settings" >> $(CONFIG_FILE)
	@echo "  refreshRate: 10000, // Refresh rate in milliseconds" >> $(CONFIG_FILE)
	@echo "  use_downtime: false, // Set to true to use downtime" >> $(CONFIG_FILE)
	@echo "  downtime_start: 21, // Set hour downtime begins" >> $(CONFIG_FILE)
	@echo "  downtime_end: 6, // Set hour downtime ends" >> $(CONFIG_FILE)
	@echo "  downtime_wake_duration_minutes: 2, // The minutes the app will wake up if tapped/touched during downtime" >> $(CONFIG_FILE)
	@echo "  // Disk space management for Raspberry Pi" >> $(CONFIG_FILE)
	@echo "  cleanup_enabled: true, // Enable disk space management" >> $(CONFIG_FILE)
	@echo "  max_flights_dir_size_mb: 100, // Maximum size for includes/flights directory in MB" >> $(CONFIG_FILE)
	@echo "  cleanup_batch_size: 50, // Number of oldest files to remove in each cleanup" >> $(CONFIG_FILE)
	@echo "  cleanup_check_interval_minutes: 600, // Check disk usage every 600 minutes" >> $(CONFIG_FILE)
	@echo "  // API keys for various services" >> $(CONFIG_FILE)
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

cleanup_flights:
	@count=0; \
	files_to_delete=""; \
	cutoff_date=$$(date -v-30d -u +"%Y-%m-%dT%H:%M:%SZ"); \
	cutoff_unix=$$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$$cutoff_date" +%s); \
	for file in includes/flights/*.json; do \
		created_at=$$(jq -r '.created_at' "$$file"); \
		if [ "$$created_at" = "null" ] || [ -z "$$created_at" ]; then continue; fi; \
		created_at_stripped=$$(echo "$$created_at" | sed 's/\.[0-9]*Z$$/Z/'); \
		created_unix=$$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$$created_at_stripped" +%s 2>/dev/null); \
		if [ -z "$$created_unix" ]; then \
			echo "Warning: couldn't parse date in $$file"; \
			continue; \
		fi; \
		if [ "$$created_unix" -lt "$$cutoff_unix" ]; then \
			files_to_delete="$$files_to_delete $$file"; \
			count=$$((count + 1)); \
		fi; \
	done; \
	if [ "$$count" -eq 0 ]; then \
		echo "No JSON flight files older than 30 days by created_at."; \
	else \
		echo "$$count flight file(s) older than 30 days."; \
		read -p "Delete them? [y/N]: " confirm; \
		if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
			for f in $$files_to_delete; do rm "$$f"; done; \
			echo "Deleted $$count file(s)."; \
		else \
			echo "Aborted."; \
		fi \
	fi

APP_DIR = /home/pi/jetstream

setup-pi:
	@echo "Setting up Raspberry Pi environment..."
	cd $(APP_DIR)
	@echo "Installing Pi dependencies"
	sudo apt install -y make curl git xdotool unclutter lightdm
	@echo "Installing Chromium"
	sudo apt install -y chromium-browser
	@echo "Installing pm2 for process management..."
	sudo npm install -g pm2
	@echo "Installing Node.js and npm..."
	sudo apt-get update
	sudo apt-get install -y nodejs npm
	@echo "Installing required packages..."
	npm install
	@echo "Raspberry Pi setup complete!"
	@echo "Creating app directory at $(APP_DIR)..."
	cd $(APP_DIR) && pm2 start npm --name jetstream -- run dev
	pm2 save
	pm2 startup systemd -u pi --hp /home/pi
	@echo "Setting up kiosk autostart..."
	mkdir -p /home/pi/.config/lxsession/LXDE-pi
	echo '@chromium-browser --noerrdialogs --kiosk http://localhost:5000' > /home/pi/.config/lxsession/LXDE-pi/autostart
	echo '@unclutter -idle 3' >> /home/pi/.config/lxsession/LXDE-pi/autostart