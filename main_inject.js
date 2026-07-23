function buildUploadTransfer(base64Str) {
    const byteCharacters = atob(base64Str);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    const file = new File([blob], 'design.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt;
}

function assignFilesToInput(uploadInput, files) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(uploadInput, files);
    } else {
        uploadInput.files = files;
    }

    uploadInput.dispatchEvent(new Event('input', { bubbles: true }));
    uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
}

function dispatchDropUpload(targetZone, dt) {
    ['dragenter', 'dragover', 'drop'].forEach((eventName) => {
        targetZone.dispatchEvent(new DragEvent(eventName, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
        }));
    });
}

window.addEventListener('NH_EXECUTE_UPLOAD', async (e) => {
    try {
        const dt = buildUploadTransfer(e.detail.base64);
        const uploadInput = document.querySelector('.jsUploaderFileInput, input[type="file"], .m-uploader__dropzone-input');
        const dropzone = document.querySelector('.jsUploaderDropzone, .m-uploader__dropzone, .dropzone, [data-upload-zone]');

        if (uploadInput) {
            assignFilesToInput(uploadInput, dt.files);
        } else if (dropzone) {
            dispatchDropUpload(dropzone, dt);
        } else {
            throw new Error('UPLOAD_TARGET_NOT_FOUND');
        }

        window.dispatchEvent(new CustomEvent('NH_UPLOAD_SUCCESS'));
    } catch (err) {
        window.dispatchEvent(new CustomEvent('NH_UPLOAD_ERROR', { detail: err.message }));
    }
});
