// background.js
console.log("Background script loaded.");

const API_URL = "http://127.0.0.1:5000/predict";

// Listen for messages from content script and proxy the fetch.
// This avoids page-origin CORS because extensions can fetch with host_permissions.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "PREDICT" && typeof msg.text === "string") {
    (async () => {
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: msg.text }),
        });
        if (!res.ok) {
          sendResponse({ ok: false, error: `HTTP ${res.status}` });
          return;
        }
        const data = await res.json();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    // Keep the channel open for the async response
    return true;
  }
});
