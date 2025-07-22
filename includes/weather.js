let weatherCache = {
  data: null,
  lastFetch: 0,
  cacheDuration: 10 * 60 * 1000 // 10 minutes
};

async function fetchCurrentWeather() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (weatherCache.data && (now - weatherCache.lastFetch) < weatherCache.cacheDuration) {
    return weatherCache.data;
  }
  
  try {
    // Use Open-Meteo API - completely free, no API key required
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.center_lat}&longitude=${CONFIG.center_lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${CONFIG.city_name}&count=1&language=en&format=json`;
    
    const [weatherResponse, geoResponse] = await Promise.all([
      fetch(weatherUrl),
      fetch(geocodingUrl)
    ]);
    
    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }
    
    const weatherData = await weatherResponse.json();
    const geoData = await geoResponse.json();
    
    const current = weatherData.current;
    const daily = weatherData.daily;

    const nowDate = new Date().toISOString().split('T')[0]; // e.g., "2025-07-20"
    const sunrise = new Date(daily.sunrise[0]);
    const sunset = new Date(daily.sunset[0]);
    const now = new Date();

    const isNight = now < sunrise || now > sunset;

    const cityName = geoData.results?.[0]?.name || CONFIG.city_name;

    weatherCache.data = {
      temperature: Math.round(current.temperature_2m),
      description: getWeatherDescription(current.weather_code),
      weatherCode: current.weather_code,
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      windDirection: current.wind_direction_10m,
      cityName: cityName,
      isNight: isNight
    };
    
    weatherCache.lastFetch = now;
    
    return weatherCache.data;
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}

function getWeatherDescription(weatherCode) {
  // WMO Weather interpretation codes
  const weatherCodes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };
  
  return weatherCodes[weatherCode] || 'Unknown';
}

function getWeatherIconPath(weatherCode, isNight = false) {
  if (isNight && (weatherCode === 0 || weatherCode === 1)) {
    return 'moon.svg';
  }
  // Map weather codes to local SVG icons
  const weatherIcons = {
    0: 'sun.svg',              // Clear sky
    1: 'sun.svg',              // Mainly clear
    2: 'cloud.svg',            // Partly cloudy
    3: 'cloud.svg',            // Overcast
    45: 'cloud.svg',           // Fog
    48: 'cloud.svg',           // Depositing rime fog
    51: 'cloud-drizzle.svg',   // Light drizzle
    53: 'cloud-drizzle.svg',   // Moderate drizzle
    55: 'cloud-drizzle.svg',   // Dense drizzle
    56: 'cloud-snow.svg',      // Light freezing drizzle
    57: 'cloud-snow.svg',      // Dense freezing drizzle
    61: 'cloud-rain.svg',      // Slight rain
    63: 'cloud-rain.svg',      // Moderate rain
    65: 'cloud-rain.svg',      // Heavy rain
    66: 'cloud-snow.svg',      // Light freezing rain
    67: 'cloud-snow.svg',      // Heavy freezing rain
    71: 'cloud-snow.svg',      // Slight snow fall
    73: 'cloud-snow.svg',      // Moderate snow fall
    75: 'cloud-snow.svg',      // Heavy snow fall
    77: 'cloud-snow.svg',      // Snow grains
    80: 'cloud-rain.svg',      // Slight rain showers
    81: 'cloud-rain.svg',      // Moderate rain showers
    82: 'cloud-rain.svg',      // Violent rain showers
    85: 'cloud-snow.svg',      // Slight snow showers
    86: 'cloud-snow.svg',      // Heavy snow showers
    95: 'cloud-lightning.svg', // Thunderstorm
    96: 'cloud-lightning.svg', // Thunderstorm with slight hail
    99: 'cloud-lightning.svg'  // Thunderstorm with heavy hail
  };
  
  return weatherIcons[weatherCode] || 'sun.svg';
}

async function getStyledWeatherIcon(weatherCode) {
  const iconPath = getWeatherIconPath(weatherCode);
  const rgb = getComputedStyle(document.documentElement)
                .getPropertyValue('--highlight-color')
                .trim();
  const cssColor = `rgb(${rgb})`;
  
  try {
    const response = await fetch(`includes/weather_icons/${iconPath}`);
    let svgText = await response.text();
    
    // Replace currentColor with the highlight color
    svgText = svgText.replace(/currentColor/g, cssColor);
    
    return svgText;
  } catch (error) {
    console.error('Error loading weather icon:', error);
    return '☁️'; // Fallback to emoji
  }
}

async function generateWeatherHTML(weatherData) {
  if (!weatherData) {
    return `
      <div id="weather-widget">
        <h2>Weather</h2>
        <p>Unable to load weather data</p>
      </div>
    `;
  }
  
  const weatherIcon = await getStyledWeatherIcon(weatherData.weatherCode);
  
  return `
    <div id="weather-widget">
      <div class="weather-main">
        <div class="weather-icon">${weatherIcon}</div>
        <div class="weather-temp">${weatherData.temperature}°F</div>
      </div>
      <div class="weather-description">${weatherData.description}</div>
      <div class="weather-details">
        <div class="weather-detail">
          <span class="detail-label">Humidity:</span>
          <span class="detail-value">${weatherData.humidity}%</span>
        </div>
        <div class="weather-detail">
          <span class="detail-label">Wind:</span>
          <span class="detail-value">${weatherData.windSpeed} mph</span>
        </div>
        <div class="weather-location">${weatherData.cityName}</div>
      </div>
    </div>
  `;
}

async function displayWeatherWidget() {
  const weatherData = await fetchCurrentWeather();
  return await generateWeatherHTML(weatherData);
}