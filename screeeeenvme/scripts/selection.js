(function initSelectionTool() {
  if (window.__screeeeenvmeStartSelection) {
    return;
  }

  window.__screeeeenvmeStartSelection = function startSelection(options = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      window.__screeeeenvmeSelectionActive = true;
      overlay.id = "__screeeeenvme-selection-overlay";
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.zIndex = "2147483647";
      overlay.style.cursor = "crosshair";
      overlay.style.background = "rgba(7, 18, 14, 0.18)";
      overlay.style.backdropFilter = "blur(1px)";

      if (options && options.backgroundImage) {
        overlay.style.background = `rgba(7, 18, 14, 0.08) url("${String(options.backgroundImage).replace(/"/g, '\\"')}") center center / 100% 100% no-repeat`;
        overlay.style.backdropFilter = "none";
      }

      const box = document.createElement("div");
      box.style.position = "fixed";
      box.style.border = "2px solid #1e9b74";
      box.style.background = "rgba(30, 155, 116, 0.18)";
      box.style.boxShadow = "0 0 0 99999px rgba(7, 18, 14, 0.18)";
      box.style.display = "none";
      box.style.pointerEvents = "none";

      const badge = document.createElement("div");
      badge.style.position = "fixed";
      badge.style.padding = "8px 10px";
      badge.style.borderRadius = "999px";
      badge.style.background = "#10251d";
      badge.style.color = "#ecfff8";
      badge.style.font = "12px/1.2 Segoe UI, Tahoma, sans-serif";
      badge.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.24)";
      badge.style.pointerEvents = "none";
      badge.textContent = options && options.backgroundImage
        ? "Drag to crop the frozen screenshot. Press Esc to cancel."
        : "Drag to capture. Press Esc to cancel.";

      overlay.appendChild(box);
      overlay.appendChild(badge);
      document.documentElement.appendChild(overlay);

      let startX = 0;
      let startY = 0;
      let dragging = false;
      let cleaned = false;

      function cleanup(result) {
        if (cleaned) {
          return;
        }

        cleaned = true;
        window.removeEventListener("keydown", onKeyDown, true);
        overlay.removeEventListener("mousedown", onMouseDown, true);
        overlay.removeEventListener("mousemove", onMouseMove, true);
        overlay.removeEventListener("mouseup", onMouseUp, true);
        window.__screeeeenvmeSelectionActive = false;
        overlay.remove();
        resolve(result);
      }

      function onKeyDown(event) {
        if (event.key === "Escape") {
          cleanup({ cancelled: true });
        }
      }

      function onMouseDown(event) {
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        box.style.display = "block";
        updateBox(event.clientX, event.clientY);
      }

      function onMouseMove(event) {
        if (!dragging) {
          badge.style.left = `${event.clientX + 16}px`;
          badge.style.top = `${event.clientY + 16}px`;
          return;
        }

        updateBox(event.clientX, event.clientY);
      }

      function updateBox(currentX, currentY) {
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
        badge.style.left = `${left}px`;
        badge.style.top = `${Math.max(12, top - 42)}px`;
        badge.textContent = `${Math.round(width)} x ${Math.round(height)}`;
      }

      function onMouseUp(event) {
        if (!dragging) {
          cleanup({ cancelled: true });
          return;
        }

        dragging = false;
        const left = Math.min(startX, event.clientX);
        const top = Math.min(startY, event.clientY);
        const width = Math.abs(event.clientX - startX);
        const height = Math.abs(event.clientY - startY);

        if (width < 8 || height < 8) {
          cleanup({ cancelled: true });
          return;
        }

        cleanup({
          x: left,
          y: top,
          width,
          height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        });
      }

      window.addEventListener("keydown", onKeyDown, true);
      overlay.addEventListener("mousedown", onMouseDown, true);
      overlay.addEventListener("mousemove", onMouseMove, true);
      overlay.addEventListener("mouseup", onMouseUp, true);
    });
  };

  window.__screeeeenvmeStartSelectionAndNotify = function startSelectionAndNotify(options = {}, payload = {}) {
    return window.__screeeeenvmeStartSelection(options)
      .then((selection) => chrome.runtime.sendMessage({
        action: "NHP_CONTEXT_IMAGE_CROP_READY",
        selection: selection || { cancelled: true },
        requestId: payload?.requestId || ""
      }))
      .catch((error) => chrome.runtime.sendMessage({
        action: "NHP_CONTEXT_IMAGE_CROP_READY",
        selection: { cancelled: true },
        requestId: payload?.requestId || "",
        error: error?.message || "Selection failed."
      }));
  };
})();
