document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const settingsButton = document.getElementById('settingsBtn');
    const captureButton = document.getElementById('captureBtn');
    const screenshotContainer = document.getElementById('screenshotContainer');
    const screenshotImage = document.getElementById('screenshotImage');
    const confirmCropButton = document.getElementById('confirmCropBtn');
    const cancelCropButton = document.getElementById('cancelCropBtn');
    
    let cropper = null;
    
    // Get current status from storage
    chrome.storage.local.get(['status'], function(result) {
      if (result.status) {
        statusElement.textContent = result.status;
      }
    });
    
    // Listen for status updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "showStatus") {
        statusElement.textContent = message.status;
        
        // Save status to storage
        chrome.storage.local.set({ status: message.status });
      }
    });
    
    // Settings button click handler
    settingsButton.addEventListener('click', function() {
      // Open settings page or show settings dialog
      alert('Settings functionality will be implemented in future versions.');
    });
    
    // Capture button click handler
    captureButton.addEventListener('click', function() {
      statusElement.textContent = "Capturing screenshot...";
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.captureVisibleTab(tabs[0].windowId, {format: 'png'}, function(dataUrl) {
          if (chrome.runtime.lastError) {
            statusElement.textContent = "Error: " + chrome.runtime.lastError.message;
            return;
          }
          
          // Save screenshot data to local storage
          chrome.storage.local.set({ screenshotData: dataUrl }, function() {
            // Open the screenshot page in a new tab
            chrome.tabs.create({ url: 'screenshot.html' });
          });
        });
      });
    });
    
    function captureScreenshot() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.captureVisibleTab(tabs[0].windowId, {format: 'png'}, function(dataUrl) {
          if (chrome.runtime.lastError) {
            statusElement.textContent = "Error: " + chrome.runtime.lastError.message;
            return;
          }
          
          // Display the screenshot
          screenshotImage.src = dataUrl;
          screenshotContainer.classList.remove('hidden');
          
          // Initialize cropper after image is loaded
          screenshotImage.onload = function() {
            // Destroy previous cropper instance if it exists
            if (cropper) {
              cropper.destroy();
            }
            
            // Initialize cropper with more explicit options
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
              minContainerWidth: 300,
              minContainerHeight: 300,
              minCropBoxWidth: 50,
              minCropBoxHeight: 50,
              ready: function() {
                console.log('Cropper is ready');
                statusElement.textContent = "Select area to extract data from";
              }
            });
          };
        });
      });
    }
    
    // Confirm crop button click handler
    confirmCropButton.addEventListener('click', function() {
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
        
        // Send the cropped image to the backend
        sendCroppedImageToBackend(canvas.toDataURL('image/png'));
        
        // Reset UI
        resetScreenshotUI();
      } catch (error) {
        console.error('Error cropping image:', error);
        statusElement.textContent = "Error cropping image: " + error.message;
      }
    });
    
    // Cancel crop button click handler
    cancelCropButton.addEventListener('click', function() {
      resetScreenshotUI();
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
          downloadCSV(csvContent, 'chart_data.csv');
          statusElement.textContent = "Data extracted successfully!";
        } else {
          throw new Error(data.error || 'Failed to extract data: API returned error');
        }
      })
      .catch(error => {
        console.error('Error extracting data:', error);
        statusElement.textContent = "Error: " + error.message;
      });
    }
    
    // Function to reset screenshot UI
    function resetScreenshotUI() {
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
      screenshotContainer.classList.add('hidden');
      screenshotImage.src = '';
      document.body.classList.remove('screenshot-mode');
      
      // Resize the popup back to its original size
      chrome.windows.getCurrent(function(currentWindow) {
        chrome.windows.update(currentWindow.id, {
          width: 300,
          height: 400
        });
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
  });