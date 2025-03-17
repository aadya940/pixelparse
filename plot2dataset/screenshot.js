let cropper = null;
let screenshotData = null;
const statusElement = document.getElementById('status');
const screenshotImage = document.getElementById('screenshot');
const extractButton = document.getElementById('extractBtn');
const cancelButton = document.getElementById('cancelBtn');

// Get the screenshot data from URL parameters
window.addEventListener('DOMContentLoaded', function() {
  // Get the screenshot data from local storage
  chrome.storage.local.get(['screenshotData'], function(result) {
    if (result.screenshotData) {
      screenshotData = result.screenshotData;
      screenshotImage.src = screenshotData;
      
      // Initialize cropper after image is loaded
      screenshotImage.onload = function() {
        initCropper();
      };
    } else {
      statusElement.textContent = "Error: No screenshot data found";
    }
  });
});

// Initialize the cropper
function initCropper() {
  if (cropper) {
    cropper.destroy();
  }
  
  cropper = new Cropper(screenshotImage, {
    aspectRatio: NaN, // Free aspect ratio
    viewMode: 1,
    dragMode: 'crop',
    autoCropArea: 0.5,
    restore: false,
    guides: true,
    center: true,
    highlight: true,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
    minCropBoxWidth: 50,
    minCropBoxHeight: 50,
    ready: function() {
      statusElement.textContent = "Select area to extract data from";
    }
  });
}

// Extract data button click handler
extractButton.addEventListener('click', function() {
  if (!cropper) {
    statusElement.textContent = "Error: No image selected";
    return;
  }
  
  statusElement.textContent = "Processing cropped image...";
  
  try {
    // Get the cropped canvas
    const canvas = cropper.getCroppedCanvas({
      minWidth: 100,
      minHeight: 100,
      maxWidth: 4096,
      maxHeight: 4096
    });
    
    if (!canvas) {
      statusElement.textContent = "Error: Could not crop image";
      return;
    }
    
    // Get the image data URL
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Send directly to backend instead of using background script
    sendCroppedImageToBackend(imageDataUrl);
    
  } catch (error) {
    console.error('Error cropping image:', error);
    statusElement.textContent = "Error cropping image: " + error.message;
  }
});

// Cancel button click handler
cancelButton.addEventListener('click', function() {
  window.close();
});

// Function to send cropped image to backend
function sendCroppedImageToBackend(imageDataUrl) {
  statusElement.textContent = "Sending to server...";
  
  fetch('http://127.0.0.1:5000/extract-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ imageUrl: imageDataUrl })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to extract data: API request failed');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      const csvContent = convertToCSV(data.rawText);
      
      // First download the CSV
      downloadCSV(csvContent, 'chart_data.csv');
      
      // Update status
      statusElement.textContent = "Data extracted successfully!";
      
      // Store success status in local storage for the popup to read
      chrome.storage.local.set({ 
        status: "Data extracted successfully!",
        lastExtraction: new Date().toISOString()
      });
      
      // Close the window after the download starts
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      throw new Error(data.error || 'Failed to extract data: API returned error');
    }
  })
  .catch(error => {
    console.error('Error extracting data:', error);
    statusElement.textContent = "Error: " + error.message;
  });
}

// Function to convert string data to CSV
function convertToCSV(dataString) {
  if (!dataString) {
    return '';
  }
  
  console.log("Raw data from model:", dataString);
  
  // Check if it's a table with months and values
  if (dataString.includes("Mar '24") || dataString.includes("Apr '24")) {
    return parseTableData(dataString);
  }
  
  // Extract time-value pairs using regex (for time series charts)
  const timeValuePairs = [];
  const regex = /(\d+:\d+\s*(?:am|pm))\s*\|\s*(\d+\.\d+)/gi;
  let match;
  
  while ((match = regex.exec(dataString)) !== null) {
    const time = match[1].trim();
    const value = match[2].trim();
    timeValuePairs.push([time, value]);
  }
  
  // If we found time-value pairs, format them as CSV
  if (timeValuePairs.length > 0) {
    let csv = '';
    timeValuePairs.forEach(pair => {
      csv += `${pair[0]},${pair[1]}\n`;
    });
    return csv;
  }
  
  // Fallback: try to parse the specific format we're seeing
  const parts = dataString.split('<0x0A>');
  const dataPoints = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    
    // Skip title or empty parts
    if (part.startsWith("TITLE") || part === "") {
      continue;
    }
    
    // Look for time | value pattern
    if (part.includes('|')) {
      const segments = part.split('|').map(s => s.trim());
      
      // If we have exactly 2 segments, it might be a simple x,y pair
      if (segments.length === 2) {
        dataPoints.push([segments[0], segments[1]]);
      }
      // Otherwise, try to extract the first segment as x and second as y
      else if (segments.length > 2) {
        const xValue = segments[0];
        const yValue = segments[1];
        if (xValue && yValue) {
          dataPoints.push([xValue, yValue]);
        }
      }
    }
  }
  
  // If we found data points using the fallback method
  if (dataPoints.length > 0) {
    let csv = '';
    dataPoints.forEach(point => {
      csv += `${point[0]},${point[1]}\n`;
    });
    return csv;
  }
  
  // Second fallback: try to extract all time-value pairs from the string
  const timePattern = /(\d+:\d+\s*(?:am|pm))/gi;
  const valuePattern = /\|\s*(\d+\.\d+)/gi;
  
  const times = [];
  const values = [];
  
  while ((match = timePattern.exec(dataString)) !== null) {
    times.push(match[1].trim());
  }
  
  while ((match = valuePattern.exec(dataString)) !== null) {
    values.push(match[1].trim());
  }
  
  // If we have the same number of times and values, pair them
  if (times.length > 0 && times.length === values.length) {
    let csv = '';
    for (let i = 0; i < times.length; i++) {
      csv += `${times[i]},${values[i]}\n`;
    }
    return csv;
  }
  
  // Last resort: try to parse as tab-delimited data
  try {
    const lines = dataString.split('\n');
    let csv = '';
    
    lines.forEach(line => {
      if (line.trim() && !line.startsWith("TITLE")) {
        const cells = line.split('\t');
        csv += cells.join(',') + '\n';
      }
    });
    
    return csv;
  } catch (e) {
    console.error("Error parsing as tab-delimited:", e);
  }
  
  // Very last resort: just return the raw data cleaned up a bit
  console.log("Could not parse data into structured format, returning cleaned data");
  return dataString.replace(/<0x0A>/g, '\n').replace(/TITLE \|/g, '').trim();
}

// Function to parse table data with months
function parseTableData(dataString) {
  // Replace the hex code for newlines with actual newlines
  dataString = dataString.replace(/<0x0A>/g, '\n');
  
  // Split into lines
  const lines = dataString.split('\n');
  let csv = '';
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip title or empty lines
    if (line.startsWith("TITLE") || line === "") {
      continue;
    }
    
    // Split by pipe character
    const cells = line.split('|').map(cell => cell.trim());
    
    // Skip lines that don't have at least two cells
    if (cells.length < 2) {
      continue;
    }
    
    // Extract month and value
    const month = cells[0];
    
    // For each value after the month
    for (let j = 1; j < cells.length; j++) {
      const value = cells[j];
      if (value && !isNaN(parseFloat(value))) {
        csv += `${month},${value}\n`;
      }
    }
  }
  
  return csv;
}

// Function to download CSV file
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
} 