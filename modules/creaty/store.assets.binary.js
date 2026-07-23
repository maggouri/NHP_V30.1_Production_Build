function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isImageFile(file) {
  return !!file && /^image\//i.test(String(file.type || ''));
}

export function initStoreAssetsBinary(rootEl, helpers = {}) {
  if (!rootEl) return null;

  let activeTarget = helpers.initialTarget === 'cover' ? 'cover' : 'avatar';

  const metaFor = (target) => target === 'cover'
    ? {
        title: helpers.coverTitle || 'Cover',
        subtitle: helpers.coverSubtitle || '1920x480 banner upload',
        prompt: helpers.coverPrompt || 'Upload or drop a wide storefront cover image',
      }
    : {
        title: helpers.avatarTitle || 'Avatar',
        subtitle: helpers.avatarSubtitle || '500x500 profile upload',
        prompt: helpers.avatarPrompt || 'Upload or drop a square storefront avatar image',
      };

  async function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('file_read_failed'));
      reader.readAsDataURL(file);
    });
  }

  async function assignFile(file) {
    if (!isImageFile(file)) {
      helpers.showToast?.(helpers.invalidFileText || 'Image file required', 'error');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await helpers.onAssign?.(activeTarget, dataUrl, file);
      helpers.showToast?.(
        activeTarget === 'cover'
          ? (helpers.coverAssignedText || 'Cover ready')
          : (helpers.avatarAssignedText || 'Avatar ready'),
        'success'
      );
      render();
    } catch (err) {
      helpers.showToast?.(`${helpers.assignFailedText || 'Upload failed'}: ${err?.message || err}`, 'error');
    }
  }

  function render() {
    const meta = metaFor(activeTarget);
    const currentValue = helpers.getValue?.(activeTarget) || '';
    rootEl.innerHTML = `
      <div class="creaty-store-binary-tabs" data-active-target="${escapeHtml(activeTarget)}">
        <button type="button" class="creaty-store-binary-tab${activeTarget === 'avatar' ? ' is-active' : ''}" data-store-binary-tab="avatar">Avatar</button>
        <button type="button" class="creaty-store-binary-tab${activeTarget === 'cover' ? ' is-active' : ''}" data-store-binary-tab="cover">Cover</button>
      </div>
      <div class="creaty-store-binary-dropzone${activeTarget === 'cover' ? ' is-cover' : ' is-avatar'}" id="creaty-store-binary-dropzone" tabindex="0" role="button">
        <input type="file" id="creaty-store-binary-input" accept="image/png,image/jpeg,image/webp" hidden>
        <div class="creaty-store-binary-copy">
          <strong>${escapeHtml(meta.title)}</strong>
          <span>${escapeHtml(meta.subtitle)}</span>
          <small>${escapeHtml(meta.prompt)}</small>
        </div>
        ${currentValue ? `<div class="creaty-store-binary-thumb${activeTarget === 'cover' ? ' is-cover' : ''}"><img src="${escapeHtml(currentValue)}" alt="${escapeHtml(meta.title)}"></div>` : ''}
      </div>
    `;
    bind();
  }

  function bind() {
    rootEl.querySelectorAll('[data-store-binary-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTarget = btn.dataset.storeBinaryTab === 'cover' ? 'cover' : 'avatar';
        render();
      });
    });

    const input = rootEl.querySelector('#creaty-store-binary-input');
    const dropzone = rootEl.querySelector('#creaty-store-binary-dropzone');
    if (!input || !dropzone) return;

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) await assignFile(file);
      input.value = '';
    });

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    });
    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('is-dragover');
    });
    dropzone.addEventListener('drop', async (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragover');
      const file = event.dataTransfer?.files?.[0];
      if (file) await assignFile(file);
    });
  }

  render();
  return {
    refresh(nextTarget) {
      if (nextTarget === 'avatar' || nextTarget === 'cover') activeTarget = nextTarget;
      render();
    },
  };
}
