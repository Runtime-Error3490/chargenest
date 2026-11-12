// The driver's real position from the browser. Asks permission once per page load.
// Resolves to { latitude, longitude } or null if unavailable or refused.
export const DEMO_LOCATION = { latitude: 12.9716, longitude: 77.5946, demo: true }; // central Bengaluru

let pending = null;

export function getBrowserLocation() {
  if (pending) return pending;
  pending = new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
  return pending;
}
