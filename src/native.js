// Native shell (iPhone / Android app store builds). Everything here is a no-op on the website.
import { Capacitor } from '@capacitor/core';

export const NATIVE = Capacitor.isNativePlatform();
export const SITE = 'https://www.longevityconcierge.app';

const REMINDER_KEY = 'lc-reminder';
const REMINDER_ID = 1001;

export function getReminder() {
  try { return localStorage.getItem(REMINDER_KEY) || ''; } catch { return ''; }
}

// time = "HH:MM" to schedule a daily reminder, or '' to turn it off. Returns true when it is on.
export async function setReminder(time) {
  if (!NATIVE) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
  if (!time) { try { localStorage.removeItem(REMINDER_KEY); } catch {} return false; }
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  const [hour, minute] = time.split(':').map(Number);
  await LocalNotifications.schedule({ notifications: [{
    id: REMINDER_ID,
    title: 'Longevity Concierge',
    body: 'Time for a quick check-in on today’s habits.',
    schedule: { on: { hour, minute }, allowWhileIdle: true },
  }] });
  try { localStorage.setItem(REMINDER_KEY, time); } catch {}
  return true;
}

export async function initNative({ onBack } = {}) {
  if (!NATIVE) return;
  document.documentElement.classList.add('native', 'native-' + Capacitor.getPlatform());
  const [{ StatusBar, Style }, { SplashScreen }, { App }, { Browser }] = await Promise.all([
    import('@capacitor/status-bar'), import('@capacitor/splash-screen'), import('@capacitor/app'), import('@capacitor/browser'),
  ]);
  StatusBar.setStyle({ style: Style.Light }).catch(() => {}); // dark text on the light app background
  if (Capacitor.getPlatform() === 'android') {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#eef1ea' }).catch(() => {});
  }
  setTimeout(() => SplashScreen.hide().catch(() => {}), 300);

  // Web links (Terms, Privacy, outside sites) open in an in-app browser instead of replacing the app.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a) return;
    const href = a.getAttribute('href');
    if (/^(sms:|tel:|mailto:)/.test(href)) return; // the phone handles these
    const external = /^https?:\/\//.test(href) && !href.startsWith(location.origin);
    if (a.target === '_blank' || external) {
      e.preventDefault();
      Browser.open({ url: external ? href : SITE + (href.startsWith('/') ? href : '/' + href) });
    }
  }, true);

  // Android back button: close whatever is open, otherwise leave the app in the background.
  Promise.resolve().then(() => App.addListener('backButton', () => { if (!(onBack && onBack())) App.minimizeApp().catch(() => {}); })).catch(() => {});
}
