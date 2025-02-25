document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const settingsButton = document.getElementById('settingsBtn');
    
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
  });