const emptyState = document.getElementById("emptyState");
const itemsGrid = document.getElementById("itemsGrid");

function formatBytes(bytes) {
  if (!bytes) {
    return "n/a";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function renderItems(items) {
  itemsGrid.innerHTML = "";
  emptyState.hidden = items.length > 0;

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "item-card";

    card.innerHTML = `
      <span class="item-kind">${item.kind} / ${item.mode}</span>
      <h2>${escapeHtml(item.title || "Untitled")}</h2>
      <div class="item-meta">
        <div>Saved: ${formatDate(item.createdAt)}</div>
        <div>Size: ${formatBytes(item.bytes)}</div>
      </div>
      <div class="item-file">${escapeHtml(item.filename || "")}</div>
    `;

    itemsGrid.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function refresh() {
  const response = await chrome.runtime.sendMessage({ action: "get-recent-items" });
  const items = Array.isArray(response?.items) ? response.items : [];
  renderItems(items);
}

document.getElementById("clearHistory").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "clear-recent-items" });
  await refresh();
});

document.getElementById("openDownloads").addEventListener("click", async () => {
  await chrome.downloads.showDefaultFolder();
});

refresh().catch((error) => {
  emptyState.hidden = false;
  emptyState.textContent = error.message || "Unable to load local history.";
});
