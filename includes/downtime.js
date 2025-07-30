let downtimeState = {
  isAwake: false,
  wakeTimeout: null
};

function isInDowntime() {
  if (!CONFIG.use_downtime) return false;
  
  const now = new Date();
  const hour = now.getHours();
  const start = CONFIG.downtime_start;
  const end = CONFIG.downtime_end;
  
  // Handles overnight downtime (e.g., 21 to 6)
  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}

function showDowntimeOverlay() {
  const overlay = document.getElementById('downtime-overlay');
  if (overlay) {
    overlay.style.display = 'block';
  }
}

function hideDowntimeOverlay() {
  const overlay = document.getElementById('downtime-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function wakeFromDowntime() {
  if (!isInDowntime()) return;
  
  downtimeState.isAwake = true;
  hideDowntimeOverlay();
  
  // Dispatch event for other scripts to know downtime state changed
  document.dispatchEvent(new Event('downtimeStateChanged'));
  
  // Clear any existing wake timeout
  if (downtimeState.wakeTimeout) {
    clearTimeout(downtimeState.wakeTimeout);
  }
  
  // Set timeout to go back to sleep after wake duration
  const wakeDurationMs = CONFIG.downtime_wake_duration_minutes * 60 * 1000;
  downtimeState.wakeTimeout = setTimeout(() => {
    downtimeState.isAwake = false;
    if (isInDowntime()) {
      showDowntimeOverlay();
      // Dispatch event when going back to sleep
      document.dispatchEvent(new Event('downtimeStateChanged'));
    }
  }, wakeDurationMs);
}

function checkDowntimeState() {
  if (isInDowntime() && !downtimeState.isAwake) {
    showDowntimeOverlay();
    // Dispatch event when entering downtime
    document.dispatchEvent(new Event('downtimeStateChanged'));
  } else if (!isInDowntime()) {
    // If we were in downtime before, dispatch event when exiting
    if (downtimeState.isAwake === false && document.getElementById('downtime-overlay').style.display === 'block') {
      document.dispatchEvent(new Event('downtimeStateChanged'));
    }
    
    downtimeState.isAwake = false;
    hideDowntimeOverlay();
    if (downtimeState.wakeTimeout) {
      clearTimeout(downtimeState.wakeTimeout);
      downtimeState.wakeTimeout = null;
    }
  }
}

function initDowntime() {
  // Create overlay element if it doesn't exist
  if (!document.getElementById('downtime-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'downtime-overlay';
    document.body.insertBefore(overlay, document.body.firstChild);
  }
  
  // Add click/tap event listener to wake from downtime
  const overlay = document.getElementById('downtime-overlay');
  if (overlay) {
    overlay.addEventListener('click', wakeFromDowntime);
    overlay.addEventListener('touchstart', wakeFromDowntime);
  }
  
  // Initial check
  checkDowntimeState();
  
  // Check downtime state every minute
  setInterval(checkDowntimeState, 60 * 1000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initDowntime);