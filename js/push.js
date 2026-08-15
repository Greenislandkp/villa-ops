// Web Push subscription management. The daily task-notification content
// itself is built and sent server-side (Supabase Edge Function on a
// pg_cron schedule, see the project's Supabase config) — this module
// only handles getting the browser subscribed and saving/removing that
// subscription in `push_subscriptions`.
import { savePushSubscription, deletePushSubscription } from './data.js';
import { showToast } from './utils.js';

const VAPID_PUBLIC_KEY = 'BIPA3VQ0G2mNJ8JzGIHoWQQOuQm9UmG9lDvXA1IM2ZOAb6SQTayPSve3K76zIzVImsiY5TV9t1k2NEAFxgvM8Jo';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (_) {
    return null;
  }
}

export async function subscribeToPush(teamMemberId) {
  if (!isPushSupported()) {
    showToast("This browser doesn't support push notifications.");
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    showToast('Notification permission was not granted.');
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await savePushSubscription(teamMemberId, subscription.toJSON());
    showToast('Daily task notifications enabled.');
    return true;
  } catch (err) {
    showToast(err.message || 'Could not enable notifications.');
    return false;
  }
}

export async function unsubscribeFromPush() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch (_) {
    /* proceed to clean up the DB row regardless */
  }
  try {
    await deletePushSubscription(endpoint);
  } catch (_) {
    /* best effort */
  }
  showToast('Daily task notifications disabled.');
}
