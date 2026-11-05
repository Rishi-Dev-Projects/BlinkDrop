import { PeerDevice } from '../types';

export function getLocalDeviceId(): string {
  const key = 'blinkdrop_device_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = 'peer_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function detectDevice(): PeerDevice {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  const id = getLocalDeviceId();
  const name = `${os} ${browser}`;

  return {
    id,
    name,
    os,
    browser,
    joinedAt: Date.now(),
  };
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

