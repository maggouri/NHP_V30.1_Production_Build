/**
 * Image Storage Utility for Niche Hunter Pro
 * Uses IndexedDB to store large image Blobs, preventing RAM spikes from long Base64 strings.
 */

const DB_NAME = 'NHP_ImageCache';
const STORE_NAME = 'designs';
const DB_VERSION = 1;

const ImageStorage = {
    _db: null,

    /**
     * Initialize DB
     */
    async init() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => {
                this._db = request.result;
                resolve(this._db);
            };
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Store an image (Base64 string or Blob)
     * @param {string} id Unique identifier for the design
     * @param {string|Blob} data Image data
     */
    async save(id, data) {
        const db = await this.init();
        let blob = data;

        // Convert base64 to blob if needed
        if (typeof data === 'string' && data.startsWith('data:')) {
            blob = await this._dataURLtoBlob(data);
        } else if (typeof data === 'string') {
            // Assume it's raw base64 without prefix if not starts with data:
            blob = await this._dataURLtoBlob(`data:image/png;base64,${data}`);
        }

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(blob, id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Retrieve an image as a Blob URL (for display)
     */
    async getAsUrl(id) {
        const blob = await this.get(id);
        if (!blob) return null;
        return URL.createObjectURL(blob);
    },

    /**
     * Retrieve an image as a Blob
     */
    async get(id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Retrieve an image as Base64 string (for legacy processing)
     */
    /**
     * Retrieve an image as a Data URL
     */
    async getAsDataURL(id) {
        const blob = await this.get(id);
        if (!blob) return null;
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    },

    /**
     * Retrieve an image as raw Base64 string (for legacy processing)
     */
    async getAsBase64(id) {
        const dataURL = await this.getAsDataURL(id);
        if (!dataURL) return null;
        return dataURL.split(',')[1];
    },

    /**
     * Delete an image
     */
    async delete(id) {
        const db = await this.init();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(id).onsuccess = () => resolve(true);
        });
    },

    /**
     * Clear all images
     */
    async clear() {
        const db = await this.init();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear().onsuccess = () => resolve(true);
        });
    },

    /**
     * Internal: DataURL to Blob converter
     */
    async _dataURLtoBlob(dataURL) {
        const res = await fetch(dataURL);
        return await res.blob();
    }
};

export default ImageStorage;
