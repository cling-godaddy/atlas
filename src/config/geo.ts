import type { GeoPreset } from '../types/index';

export interface GeoConfig {
  latitude: number;
  longitude: number;
  lang: string;
  acceptLanguage: string;
  country: string;
  timezone: string;
}

export const geoPresets: Record<GeoPreset, GeoConfig> = {
  us: {
    latitude: 40.7128,
    longitude: -74.006,
    lang: 'en-US',
    acceptLanguage: 'en-US,en;q=0.9',
    country: 'US',
    timezone: 'America/New_York',
  },
  uk: {
    latitude: 51.5074,
    longitude: -0.1278,
    lang: 'en-GB',
    acceptLanguage: 'en-GB,en;q=0.9',
    country: 'GB',
    timezone: 'Europe/London',
  },
  eu: {
    latitude: 52.52,
    longitude: 13.405,
    lang: 'de-DE',
    acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8',
    country: 'DE',
    timezone: 'Europe/Berlin',
  },
  asia: {
    latitude: 35.6762,
    longitude: 139.6503,
    lang: 'ja-JP',
    acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8',
    country: 'JP',
    timezone: 'Asia/Tokyo',
  },
};
