/// ==============================
// content.js — Intent-Guard (final build)
// ==============================

const INTENT_THRESHOLD = 65;
const DEBOUNCE_MS = 300;

// ---- helpers ----
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

function readInputText(node) {
  if (!node) return "";
  if (node.getAttribute && node.getAttribute("contenteditable") === "true") {
    return node.innerText || "";
  }
  return node.value || node.textContent || "";
}

// ---- API via background (no page CORS) ----
async function analyzeText(text) {
  if (!text || !text.trim()) return null;
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "PREDICT", text }, (resp) => {
      if (!resp) {
        console.log("[IG] No response from background");
        return resolve(null);
      }
      if (!resp.ok) {
        console.log("[IG] Background error:", resp.error);
        return resolve(null);
      }
      resolve(resp.data);
    });
  });
}

// ---- Banner UI ----
function createBanner(score) {
  const b = document.createElement("div");
  b.id = "intent-guard-banner";
  Object.assign(b.style, {
    position: "fixed",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    padding: "10px 14px",
    borderRadius: "10px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    fontSize: "13px",
    lineHeight: "1.25",
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.12)",
    maxWidth: "80vw",
    textAlign: "center",
    color: "#111",          // force dark text
    pointerEvents: "none",  // don't block clicks
    whiteSpace: "pre-wrap",
  });
  b.textContent = "";
  document.documentElement.appendChild(b);
  return b;
}

function showBanner(score) {
  let b = document.getElementById("intent-guard-banner");
  if (!b) b = createBanner(score);
  b.innerHTML = `⚠️ <strong>Heads up:</strong> Your draft may be harmful (Intent score: ${Math.round(score)}). Please reconsider.`;
  b.style.display = "block";
}

function hideBanner() {
  const b = document.getElementById("intent-guard-banner");
  if (b) b.remove();
}

// ---- Core logic ----
async function checkAndWarn(inputEl) {
  const text = readInputText(inputEl);
  console.log("[IG] Text:", JSON.stringify(text));
  const result = await analyzeText(text);
  console.log("[IG] API result:", result);
  if (result && typeof result.intent_score === "number") {
    if (result.intent_score > INTENT_THRESHOLD) {
      showBanner(result.intent_score);
    } else {
      hideBanner();
    }
  } else {
    hideBanner();
  }
}

// ---- Composer detection ----
const SELECTORS = [
  'div[data-testid^="tweetTextarea"] div[contenteditable="true"]',
  'div[role="textbox"][contenteditable="true"]',
  '[data-testid="dmComposerTextInput"] div[contenteditable="true"]',
  '[data-testid="replyTextarea"] div[contenteditable="true"]',
  '[contenteditable="true"][data-testid*="tweetTextarea"]',
];

function findComposers(root = document) {
  const found = new Set();
  for (const sel of SELECTORS) {
    root.querySelectorAll(sel).forEach((el) => found.add(el));
  }
  return Array.from(found);
}

const attached = new WeakSet();

function attachToNode(node) {
  if (!node || attached.has(node)) return;
  const handler = debounce(() => checkAndWarn(node), DEBOUNCE_MS);
  node.addEventListener("input", handler);
  node.addEventListener("blur", hideBanner);
  attached.add(node);
  console.log("[IG] Attached to composer:", node);
  handler(); // initial check
}

function scanAndAttach(root = document) {
  const nodes = findComposers(root);
  console.log(`[IG] Composers found: ${nodes.length}`);
  nodes.forEach(attachToNode);
}

// ---- Init ----
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[IG] DOMContentLoaded");
    scanAndAttach();
  });
} else {
  scanAndAttach();
}

new MutationObserver((muts) => {
  for (const m of muts) {
    m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (SELECTORS.some((sel) => n.matches?.(sel))) attachToNode(n);
      else n.querySelectorAll?.(SELECTORS.join(",")).forEach(attachToNode);
    });
  }
}).observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("pagehide", hideBanner);
console.log("[IG] content.js loaded");
