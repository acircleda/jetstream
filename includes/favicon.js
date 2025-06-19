async function generateFaviconFromSVG() {
  const rgb = getComputedStyle(document.documentElement)
                .getPropertyValue('--highlight-color')
                .trim(); // This will be something like "123, 45, 67"

  const cssColor = `rgb(${rgb})`;

  const response = await fetch('favicon_.svg');
  let svgText = await response.text();

  // Replace all instances of "currentColor" with actual RGB value
  svgText = svgText.replace(/currentColor/g, cssColor);

  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  const favicon = document.getElementById('dynamic-favicon');
  favicon.href = url;
}

window.addEventListener('DOMContentLoaded', generateFaviconFromSVG);
