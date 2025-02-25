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
    // Execute a script in the tab to check if content script is loaded
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        return true;
      }
    }).then(() => {
      // Send message to content script with the image URL
      chrome.tabs.sendMessage(tab.id, {
        action: "extractData",
        imageUrl: info.srcUrl
      }, (response) => {
        // Handle potential connection error
        if (chrome.runtime.lastError) {
          console.log("Could not establish connection to content script");
          // Inject content script manually and try again
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          }).then(() => {
            // Try again after content script is injected
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {
                action: "extractData",
                imageUrl: info.srcUrl
              });
            }, 100); // Small delay to ensure content script is initialized
          });
        }
      });
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showStatus") {
    // Update the extension icon or show notification
    console.log(message.status);
  }
  return true;
});