//function to convert CONFIG.highlight_color from hex to rgb format and set as a CSS variable
function hexToRgb(hex) {
      hex = hex.replace(/^#/, '');
      if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
      const num = parseInt(hex, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255].join(', ');
  }

document.documentElement.style.setProperty('--highlight-color', hexToRgb(CONFIG.highlight_color));