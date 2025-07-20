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
CONFIG_TEMPLATE_FILE=.config_template
GITIGNORE_FILE=.gitignore

config:
	@echo "Copying $(CONFIG_TEMPLATE_FILE) to $(CONFIG_FILE)..."
	@cp $(CONFIG_TEMPLATE_FILE) $(CONFIG_FILE)

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