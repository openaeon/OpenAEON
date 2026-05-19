/* popup.js — OpenAEON Browser Relay — Full UX */
"use strict";

// ──────────────────────────────────────────────
// Element references
// ──────────────────────────────────────────────
const relayDot = document.getElementById("relay-dot");
const relayStatusText = document.getElementById("relay-status-text");
const latencyDisplay = document.getElementById("latency-display");
const errorBanner = document.getElementById("error-banner");
const errorMsg = document.getElementById("error-msg");
const countdownEl = document.getElementById("countdown");
const retryBtn = document.getElementById("retry-btn");
const attachBtn = document.getElementById("attach-btn");
const attachBtnIcon = document.getElementById("attach-btn-icon");
const attachBtnText = document.getElementById("attach-btn-text");
const currentFavicon = document.getElementById("current-tab-favicon");
const currentTitle = document.getElementById("current-tab-title");
const currentUrl = document.getElementById("current-tab-url");
const tabsList = document.getElementById("tabs-list");
const tabCount = document.getElementById("tab-count");
const emptyState = document.getElementById("empty-state");
const settingsLink = document.getElementById("settings-link");

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
let currentTabId = null; // Chrome tab ID of the active tab
let retryCountdown = null; // setInterval handle
let retrySecondsLeft = 0;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function clearCountdown() {
  if (retryCountdown) {
    clearInterval(retryCountdown);
    retryCountdown = null;
  }
  countdownEl.textContent = "";
}

function startCountdown(seconds) {
  clearCountdown();
  retrySecondsLeft = seconds;
  countdownEl.textContent = `Retry in ${retrySecondsLeft}s`;
  retryCountdown = setInterval(() => {
    retrySecondsLeft -= 1;
    if (retrySecondsLeft <= 0) {
      clearCountdown();
    } else {
      countdownEl.textContent = `Retry in ${retrySecondsLeft}s`;
    }
  }, 1000);
}

function showError(message, withCountdown = false) {
  errorMsg.textContent = message || "Relay offline";
  errorBanner.classList.add("visible");
  if (withCountdown) {
    startCountdown(10);
  } else {
    clearCountdown();
  }
}

function hideError() {
  errorBanner.classList.remove("visible");
  clearCountdown();
}

function formatDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "—";
  }
}

function truncate(str, n) {
  if (!str) return "—";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function setLatency(ms) {
  if (ms === null || ms === undefined || ms < 0) {
    latencyDisplay.textContent = "";
    latencyDisplay.className = "latency";
    return;
  }
  latencyDisplay.textContent = `${ms} ms`;
  latencyDisplay.className = ms < 100 ? "latency fast" : ms < 500 ? "latency" : "latency slow";
}

// ──────────────────────────────────────────────
// Latency ping
// ──────────────────────────────────────────────
async function measureLatency() {
  const start = Date.now();
  try {
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "ping" }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) return reject();
        resolve(response);
      });
    });
    setLatency(Date.now() - start);
  } catch {
    setLatency(null);
  }
}

// ──────────────────────────────────────────────
// Render attached tabs list
// ──────────────────────────────────────────────
function renderTabsList(attachedTabs, currentChromeTabId) {
  // attachedTabs: Array<{ id: string, title?: string, url?: string, favicon?: string }>
  tabCount.textContent = String(attachedTabs.length);

  // Remove old dynamic items
  while (tabsList.firstChild) tabsList.removeChild(tabsList.firstChild);

  if (attachedTabs.length === 0) {
    tabsList.appendChild(emptyState);
    return;
  }

  for (const tab of attachedTabs) {
    const li = document.createElement("li");
    li.className = "tab-item";

    // Favicon
    if (tab.favicon) {
      const img = document.createElement("img");
      img.className = "tab-favicon";
      img.src = tab.favicon;
      img.alt = "";
      img.onerror = () => img.remove();
      li.appendChild(img);
    }

    // Info
    const infoDiv = document.createElement("div");
    infoDiv.className = "tab-info";
    const nameEl = document.createElement("div");
    nameEl.className = "tab-name";
    nameEl.textContent = truncate(tab.title || formatDomain(tab.url), 40);
    const idEl = document.createElement("div");
    idEl.className = "tab-id";
    idEl.textContent = tab.id ? (tab.id.length > 24 ? tab.id.slice(0, 24) + "…" : tab.id) : "";
    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(idEl);
    li.appendChild(infoDiv);

    // Detach button
    const detachBtn = document.createElement("button");
    detachBtn.className = "detach-tab-btn";
    detachBtn.title = "Detach this tab";
    detachBtn.textContent = "✕";
    detachBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage(
        { type: "detachTab", tabId: tab.chromeTabId ?? currentChromeTabId },
        () => updateUI(),
      );
    });
    li.appendChild(detachBtn);

    tabsList.appendChild(li);
  }
}

// ──────────────────────────────────────────────
// Main update
// ──────────────────────────────────────────────
function updateUI() {
  // Prefill current-tab info from Chrome immediately
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    currentTabId = tab ? tab.id : null;

    if (tab) {
      currentTitle.textContent = truncate(tab.title, 50) || "—";
      currentUrl.textContent = formatDomain(tab.url);
      if (tab.favIconUrl) {
        currentFavicon.src = tab.favIconUrl;
        currentFavicon.style.display = "block";
      } else {
        currentFavicon.style.display = "none";
      }
    }
  });

  chrome.runtime.sendMessage({ type: "getStatus" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      // Background service worker not responding
      relayDot.className = "dot error";
      relayStatusText.textContent = "Extension error";
      showError("Extension background not responding. Reload the extension.", false);
      attachBtn.disabled = true;
      setLatency(null);
      return;
    }

    const { relayConnected, relayConnecting, attachedTabs = [], lastError, currentTab } = response;

    // ── Relay status
    if (relayConnected) {
      relayDot.className = "dot online";
      relayStatusText.textContent = "Online";
      hideError();
    } else if (relayConnecting) {
      relayDot.className = "dot connecting";
      relayStatusText.textContent = "Connecting…";
      hideError();
    } else {
      relayDot.className = "dot error";
      relayStatusText.textContent = "Offline";
      showError(lastError || "Gateway relay not reachable. Start the OPENAEON gateway.", true);
    }

    // ── Determine if current tab is attached
    // currentTab.id comes from the relay (string CDP target id)
    // We match by active Chrome tab id from background
    const isAttached = Boolean(currentTab?.attached);

    // ── Action button
    attachBtn.disabled = false;
    if (isAttached) {
      attachBtn.className = "attach-btn detach";
      attachBtnIcon.textContent = "⏏";
      attachBtnText.textContent = "Detach from OpenAEON";
    } else {
      attachBtn.className = "attach-btn attach";
      attachBtnIcon.textContent = "⚡";
      attachBtnText.textContent = "Attach to OpenAEON";
    }

    // ── Tabs list
    renderTabsList(attachedTabs, currentTabId);

    // ── Measure latency if relay is online
    if (relayConnected) {
      measureLatency();
    } else {
      setLatency(null);
    }
  });
}

// ──────────────────────────────────────────────
// Event handlers
// ──────────────────────────────────────────────
attachBtn.addEventListener("click", () => {
  attachBtn.disabled = true;
  chrome.runtime.sendMessage({ type: "toggleAttach" }, () => {
    setTimeout(updateUI, 300);
  });
});

retryBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "reconnect" }, () => {
    clearCountdown();
    updateUI();
  });
});

settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ──────────────────────────────────────────────
// Kick off
// ──────────────────────────────────────────────
updateUI();
// Refresh every 2 seconds while popup is open
setInterval(updateUI, 2000);
