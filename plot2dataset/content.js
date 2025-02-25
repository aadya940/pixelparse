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
          const csvContent = convertToCSV(data.rawText); // Use data.rawText
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

  const lines = dataString.split('<0x0A>');
  const headers = lines[0].split(' | ');
  const rows = lines.slice(1).map(line => line.split(' | '));

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
      csv += row.map(cell => {
          if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
              return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
      }).join(',') + '\n';
  });
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