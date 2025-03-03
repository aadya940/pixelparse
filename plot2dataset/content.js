// content.js

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sendResponse) {
      sendResponse({ status: "Content script is active" });
  }

  if (message.action === "extractData") {
      extractDataFromImage(message.imageUrl);
  }

  return true;
});

// Function to extract data from image
async function extractDataFromImage(imageUrl) {
  try {
      chrome.runtime.sendMessage({
          action: "showStatus",
          status: "Processing image..."
      });

      const response = await fetch('http://127.0.0.1:5000/extract-data', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ imageUrl })
      });

      if (!response.ok) {
          throw new Error('Failed to extract data: API request failed');
      }

      const data = await response.json();
      console.log("API Response Data:", data);

      if (data.success) {
          const csvContent = convertToCSV(data.rawText);
          console.log("CSV Content:", csvContent);

          downloadCSV(csvContent, 'chart_data.csv');

          chrome.runtime.sendMessage({
              action: "showStatus",
              status: "Data extracted successfully!"
          });
      } else {
          throw new Error(data.error || 'Failed to extract data: API returned error');
      }
  } catch (error) {
      console.error('Error extracting data:', error);
      chrome.runtime.sendMessage({
          action: "showStatus",
          status: "Error: " + error.message
      });
  }
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

// Signal that the content script is loaded
chrome.runtime.sendMessage({
  action: "showStatus",
  status: "Content script loaded and ready"
});