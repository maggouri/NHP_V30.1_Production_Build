// ══════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════

// It's recommended to initialize the 'toast' element after the DOM is loaded.
// This can be done in a main script file.
let toast;

document.addEventListener('DOMContentLoaded', () => {
  toast = document.getElementById('toast');
});

function showToast(msg, ms = 2500) {
  if (!toast) {
    console.log('Toast UI not ready yet.');
    return;
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), ms);
}

// Make it globally accessible if that's the pattern used in the project
window.showToast = showToast;
