// Create context menu item for images
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "extractChartData",
    title: "Extract Chart Data",
    contexts: ["image"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "extractChartData") {
    // Send message to content script with error handling
    chrome.tabs.sendMessage(tab.id, {
      action: "extractData",
      imageUrl: info.srcUrl
    }, (response) => {
      // If there's an error (content script not ready), inject it manually
      if (chrome.runtime.lastError) {
        console.log("Content script not ready, injecting it now");
        
        // Inject the content script
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        }).then(() => {
          // Try sending the message again after a short delay
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: "extractData",
              imageUrl: info.srcUrl
            });
          }, 100); // Small delay to ensure content script is initialized
        }).catch(err => {
          console.error("Error injecting content script:", err);
        });
      }
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showStatus") {
    // Forward status updates to popup if it's open
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors when popup is not open
      console.log("Popup not available to receive status update");
    });
  }
  
  if (message.action === "processScreenshot") {
    // Process the screenshot in the background
    processScreenshotInBackground(message.imageUrl);
  }
  
  if (sendResponse) {
    sendResponse({ received: true });
  }
  
  return true;
});

// Function to process screenshot in background
function processScreenshotInBackground(imageDataUrl) {
  // Update status
  updateStatus("Sending screenshot to server...");
  
  // Send the image to the backend
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
      
      // Download the CSV
      chrome.downloads.download({
        url: URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' })),
        filename: 'chart_data.csv',
        saveAs: false
      });
      
      // Update status
      updateStatus("Data extracted successfully!");
      
      // Clear the pending image data
      chrome.storage.local.remove('pendingImageData');
    } else {
      throw new Error(data.error || 'Failed to extract data: API returned error');
    }
  })
  .catch(error => {
    console.error('Error extracting data:', error);
    updateStatus("Error: " + error.message);
  });
}

// Function to update status
function updateStatus(status) {
  chrome.storage.local.set({ status: status });
  
  // Also try to update the popup if it's open
  chrome.runtime.sendMessage({
    action: "showStatus",
    status: status
  }).catch(() => {
    // Ignore errors when popup is not open
  });
}

// Function to convert string data to CSV
function convertToCSV(dataString) {
  if (!dataString) {
    return '';
  }
  
  const lines = dataString.split('\n');
  const rows = lines.map(line => line.split('\t'));
  
  let csv = '';
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

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will open the popup
});