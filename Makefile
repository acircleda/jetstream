CONFIG_FILE=includes/config.js
GITIGNORE_FILE=.gitignore

proj_config:
	@echo "Generating $(CONFIG_FILE)..."
	@echo "const CONFIG = {" > $(CONFIG_FILE)
	@echo "  lat: 37.77697315135698," >> $(CONFIG_FILE)
	@echo "  lon: -122.41922177136804," >> $(CONFIG_FILE)
	@echo "  tileLayerUrl: 'http://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'," >> $(CONFIG_FILE)
	@echo "  maxZoom: 14," >> $(CONFIG_FILE)
	@echo "  initialZoom: 12, // Zoom level for the map" >> $(CONFIG_FILE)
	@echo "  distance: 2, // Distance in miles" >> $(CONFIG_FILE)
	@echo "  refreshRate: 10000 // Refresh rate in milliseconds" >> $(CONFIG_FILE)
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

.PHONY: proj_config

server:
	@echo "Starting server..."
	@node proxy.js

.PHONY: start_server

site:
	@echo "Starting site"
	@python3 -m http.server 8000