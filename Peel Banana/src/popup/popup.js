/**
 * Popup Application
 * Handles drag-and-drop, queue management, and batch processing.
 */

import { WatermarkEngine } from '../core/watermark-engine.js';

class PopupApp {
  constructor() {
    this.queue = [];
    this.results = [];
    this.selectedResults = new Set();
    this.engine = null;
    this.isProcessing = false;

    this.initElements();
    this.bindEvents();
    this.initEngine();
  }

  initElements() {
    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.queueSection = document.getElementById('queue-section');
    this.queueList = document.getElementById('queue-list');
    this.queueCount = document.getElementById('queue-count');
    this.processAllBtn = document.getElementById('process-all');
    this.clearQueueBtn = document.getElementById('clear-queue');

    // New Elements
    this.loadingSection = document.getElementById('loading-section');
    this.resultsSection = document.getElementById('results-section');
    this.successBanner = document.getElementById('success-banner');
    this.singleResultContainer = document.getElementById('single-result-container');
    this.singleResultImg = document.getElementById('single-result-img');
    this.resultsList = document.getElementById('results-list');

    this.reuploadBtn = document.getElementById('reupload-btn');
    this.downloadResultBtn = document.getElementById('download-result-btn');
    this.statusBar = document.getElementById('status-bar');
    this.statusText = document.getElementById('status-text');
    this.progressFill = document.getElementById('progress-fill');

    // Selection controls
    this.selectionControls = document.getElementById('selection-controls');
    this.selectAllBtn = document.getElementById('select-all-btn');
    this.unselectAllBtn = document.getElementById('unselect-all-btn');
    this.selectionCount = document.getElementById('selection-count');
  }

  bindEvents() {
    // Drop zone events
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.dropZone.addEventListener('dragleave', () => this.handleDragLeave());
    this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // Button events
    this.processAllBtn.addEventListener('click', () => this.processAll());
    this.clearQueueBtn.addEventListener('click', () => this.clearQueue());
    this.reuploadBtn.addEventListener('click', () => this.reupload());
    this.downloadResultBtn.addEventListener('click', () => this.downloadSelected());

    // Selection events
    this.selectAllBtn.addEventListener('click', () => this.selectAll());
    this.unselectAllBtn.addEventListener('click', () => this.unselectAll());
  }

  async initEngine() {
    try {
      this.engine = await WatermarkEngine.create();
    } catch (error) {
      this.showStatus('Failed to initialize: ' + error.message, true);
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.add('drag-over');
  }

  handleDragLeave() {
    this.dropZone.classList.remove('drag-over');
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'image/png'
    );
    this.addToQueue(files);
  }

  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    this.addToQueue(files);
    e.target.value = ''; // Reset for re-selection
  }

  addToQueue(files) {
    files.forEach(file => {
      const id = Date.now() + Math.random();
      const item = {
        id,
        file,
        name: file.name,
        size: this.formatSize(file.size),
        thumbnail: URL.createObjectURL(file)
      };
      this.queue.push(item);
    });

    this.renderQueue();
  }

  /**
   * Create a queue item element using safe DOM methods
   */
  createQueueItemElement(item) {
    const div = document.createElement('div');
    div.className = 'queue-item';
    div.dataset.id = item.id;

    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.className = 'queue-item-thumb';
    img.alt = '';

    const info = document.createElement('div');
    info.className = 'queue-item-info';

    const name = document.createElement('div');
    name.className = 'queue-item-name';
    name.textContent = item.name;

    const size = document.createElement('div');
    size.className = 'queue-item-size';
    size.textContent = item.size;

    info.appendChild(name);
    info.appendChild(size);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'queue-item-remove';
    removeBtn.dataset.id = item.id;
    removeBtn.textContent = '\u00D7'; // × symbol
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeFromQueue(item.id);
    });

    div.appendChild(img);
    div.appendChild(info);
    div.appendChild(removeBtn);

    return div;
  }

  renderQueue() {
    if (this.queue.length === 0) {
      this.queueSection.classList.add('hidden');
      return;
    }

    this.queueSection.classList.remove('hidden');
    this.queueCount.textContent = `${this.queue.length} image${this.queue.length !== 1 ? 's' : ''}`;

    // Clear existing items
    while (this.queueList.firstChild) {
      this.queueList.removeChild(this.queueList.firstChild);
    }

    // Add new items using safe DOM methods
    this.queue.forEach(item => {
      this.queueList.appendChild(this.createQueueItemElement(item));
    });
  }

  removeFromQueue(id) {
    const index = this.queue.findIndex(item => item.id == id);
    if (index > -1) {
      URL.revokeObjectURL(this.queue[index].thumbnail);
      this.queue.splice(index, 1);
      this.renderQueue();
    }
  }

  clearQueue() {
    this.queue.forEach(item => URL.revokeObjectURL(item.thumbnail));
    this.queue = [];
    this.renderQueue();
    this.hideStatus();
  }

  async processAll() {
    if (!this.engine || this.queue.length === 0 || this.isProcessing) return;

    this.results = [];
    this.isProcessing = true;

    // UI State: Loading
    this.queueSection.classList.add('hidden');
    this.dropZone.classList.add('hidden');
    this.loadingSection.classList.remove('hidden');

    const total = this.queue.length;
    let processed = 0;
    let failed = 0;

    for (const item of [...this.queue]) {
      try {
        const result = await this.processImage(item);
        this.results.push(result);
        processed++;
      } catch (error) {
        console.error(`Failed to process ${item.name}:`, error);
        failed++;
      }
    }

    // UI State: Results
    this.loadingSection.classList.add('hidden');
    this.renderResults();
    this.clearQueue();
    this.isProcessing = false;
  }

  async processImage(item) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          await this.engine.processImage(imageData);
          ctx.putImageData(imageData, 0, 0);

          const dataUrl = canvas.toDataURL('image/png');
          resolve({
            name: item.name.replace(/\.[^.]+$/, '_peeled.png'),
            dataUrl,
            thumbnail: dataUrl
          });
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = item.thumbnail;
    });
  }

  /**
   * Create a result item element using safe DOM methods
   */
  createResultItemElement(result, index) {
    const div = document.createElement('div');
    div.className = 'result-item selected';
    div.dataset.index = index;
    div.title = result.name;

    const img = document.createElement('img');
    img.src = result.thumbnail;
    img.alt = result.name;

    // Checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'result-item-checkbox';
    checkbox.checked = true;
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    checkbox.addEventListener('change', () => {
      this.toggleSelection(index);
    });

    const overlay = document.createElement('div');
    overlay.className = 'result-item-overlay';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');

    svg.appendChild(path);
    overlay.appendChild(svg);

    div.appendChild(img);
    div.appendChild(checkbox);
    div.appendChild(overlay);

    // Click on item toggles selection
    div.addEventListener('click', () => {
      checkbox.checked = !checkbox.checked;
      this.toggleSelection(index);
    });

    return div;
  }

  renderResults() {
    if (this.results.length === 0) {
      this.resultsSection.classList.add('hidden');
      return;
    }

    this.resultsSection.classList.remove('hidden');
    this.successBanner.classList.remove('hidden');

    // Reset views
    this.singleResultContainer.classList.add('hidden');
    this.resultsList.classList.add('hidden');
    this.selectionControls.classList.add('hidden');

    // Select all by default
    this.selectedResults.clear();
    this.results.forEach((_, i) => this.selectedResults.add(i));

    // Update download button text using safe DOM methods
    const downloadText = this.results.length === 1 ? 'Download' : 'Download All';
    this.updateDownloadButtonText(downloadText);

    if (this.results.length === 1) {
      // Single View
      this.singleResultContainer.classList.remove('hidden');
      this.singleResultImg.src = this.results[0].dataUrl;
    } else {
      // Grid View with selection controls
      this.resultsList.classList.remove('hidden');
      this.selectionControls.classList.remove('hidden');
      // Clear existing items
      while (this.resultsList.firstChild) {
        this.resultsList.removeChild(this.resultsList.firstChild);
      }
      // Add new items
      this.results.forEach((result, index) => {
        this.resultsList.appendChild(this.createResultItemElement(result, index));
      });
      // Update selection count
      this.updateSelectionUI();
    }

  }

  /**
   * Update download button text using safe DOM methods
   */
  updateDownloadButtonText(text) {
    while (this.downloadResultBtn.firstChild) {
      this.downloadResultBtn.removeChild(this.downloadResultBtn.firstChild);
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');
    svg.appendChild(path);
    this.downloadResultBtn.appendChild(svg);
    this.downloadResultBtn.appendChild(document.createTextNode(text));
  }

  async downloadResult(result) {
    // Use chrome.downloads API via background script
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_IMAGE',
        dataUrl: result.dataUrl,
        filename: result.name
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('Download message failed:', chrome.runtime.lastError);
          this.showStatus('Download failed: ' + chrome.runtime.lastError.message, true);
          reject(chrome.runtime.lastError);
          return;
        }
        if (response && response.success) {
          resolve();
        } else {
          const errorMsg = response ? response.error : 'Unknown error';
          this.showStatus('Download failed: ' + errorMsg, true);
          reject(new Error(errorMsg));
        }
      });
    });
  }

  /**
   * Selection methods
   */
  selectAll() {
    this.results.forEach((_, i) => this.selectedResults.add(i));
    this.updateSelectionUI();
  }

  unselectAll() {
    this.selectedResults.clear();
    this.updateSelectionUI();
  }

  toggleSelection(index) {
    if (this.selectedResults.has(index)) {
      this.selectedResults.delete(index);
    } else {
      this.selectedResults.add(index);
    }
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    // Update checkboxes and visual state
    const items = this.resultsList.querySelectorAll('.result-item');
    items.forEach((item, i) => {
      const checkbox = item.querySelector('.result-item-checkbox');
      if (checkbox) {
        checkbox.checked = this.selectedResults.has(i);
      }
      item.classList.toggle('selected', this.selectedResults.has(i));
    });

    // Update count text
    this.selectionCount.textContent = `${this.selectedResults.size} selected`;

    // Update download button state and text
    this.downloadResultBtn.disabled = this.selectedResults.size === 0;

    // Update button text based on selection
    let buttonText;
    if (this.selectedResults.size === this.results.length) {
      buttonText = 'Download All';
    } else if (this.selectedResults.size === 1) {
      buttonText = 'Download 1 Image';
    } else {
      buttonText = `Download ${this.selectedResults.size} Images`;
    }
    this.updateDownloadButtonText(buttonText);
  }

  /**
   * Download selected images
   */
  async downloadSelected() {
    const selected = this.results.filter((_, i) => this.selectedResults.has(i));

    if (selected.length === 0) return;

    if (selected.length === 1) {
      // Single file: download directly
      await this.downloadResult(selected[0]);
    } else {
      // Multiple files: create ZIP
      await this.downloadAsZip(selected);
    }
  }

  /**
   * Download multiple images as a ZIP file
   */
  async downloadAsZip(results) {
    const zip = new JSZip();

    for (const result of results) {
      // Convert data URL to blob
      const response = await fetch(result.dataUrl);
      const blob = await response.blob();
      zip.file(result.name, blob);
    }

    // Generate ZIP and trigger download
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'peeled-images.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  showStatus(message, isError = false, isSuccess = false) {
    this.statusBar.classList.remove('hidden');
    this.statusText.textContent = message;

    // Reset classes
    this.statusText.classList.remove('success');
    this.statusText.style.color = ''; // Reset inline style if any

    if (isError) {
      this.statusText.style.color = 'var(--error-color)';
    } else if (isSuccess) {
      this.statusText.classList.add('success');
    } else {
      this.statusText.style.color = 'var(--text-color)';
    }
  }

  hideStatus() {
    this.statusBar.classList.add('hidden');
    this.updateProgress(0);
  }

  updateProgress(percent) {
    this.progressFill.style.width = `${percent}%`;
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }


  reupload() {
    this.results = [];
    this.selectedResults.clear();
    this.resultsSection.classList.add('hidden');
    this.dropZone.classList.remove('hidden');
    this.loadingSection.classList.add('hidden');
    this.hideStatus();
    // Dropzone is back
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new PopupApp();
});
