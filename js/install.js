// PWA install affordance. Shows a dismissible banner offering to install the
// app: a real "Install" button on Chromium/Android (via the captured
// beforeinstallprompt event, stashed early in index.html), or a short
// Add-to-Home-Screen hint on iOS Safari (which has no programmatic install).
// Hidden when already installed, after install, or once the user dismisses it.
const DISMISS_KEY = 'seinfeld_pwa_dismissed';

function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true; // iOS
}
function isIOS() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
}

export function initInstallPrompt() {
  if (document.getElementById('installBanner')) return;  // already set up
  if (isStandalone()) return;                            // already installed
  try { if (localStorage.getItem(DISMISS_KEY)) return; } catch (e) {}  // dismissed before

  let deferred = window.__installPrompt || null;

  const banner = document.createElement('div');
  banner.id = 'installBanner';
  banner.className = 'install-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Install app');
  document.body.appendChild(banner);

  const remove = (remember) => {
    banner.remove();
    if (remember) { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {} }
  };

  const showAndroid = () => {
    banner.innerHTML =
      '<span class="ib-icon" aria-hidden="true">📲</span>' +
      '<span class="ib-text">Install Seinfeld on your home screen</span>' +
      '<button type="button" class="ib-install">Install</button>' +
      '<button type="button" class="ib-close" aria-label="Dismiss">×</button>';
    banner.hidden = false;
    banner.querySelector('.ib-install').addEventListener('click', async () => {
      if (!deferred) { remove(true); return; }
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) {}
      deferred = null; window.__installPrompt = null;
      remove(false);
    });
    banner.querySelector('.ib-close').addEventListener('click', () => remove(true));
  };

  const showIOS = () => {
    banner.innerHTML =
      '<span class="ib-icon" aria-hidden="true">📲</span>' +
      '<span class="ib-text">Install: tap <b>Share</b>, then <b>Add to Home Screen</b></span>' +
      '<button type="button" class="ib-close" aria-label="Dismiss">×</button>';
    banner.hidden = false;
    banner.querySelector('.ib-close').addEventListener('click', () => remove(true));
  };

  if (deferred) showAndroid();
  else if (isIOS()) showIOS();
  // else: not yet installable on this browser — wait for the event below.

  window.addEventListener('seinfeld:installable', () => {
    deferred = window.__installPrompt;
    if (deferred && banner.isConnected && banner.hidden) showAndroid();
  });
  window.addEventListener('appinstalled', () => remove(true));
}
