import type { GeoPreset } from '../types/index';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export const geoPresets: Record<GeoPreset, GeoCoordinates> = {
  us: {
    latitude: 40.7128,
    longitude: -74.006,
  },
  uk: {
    latitude: 51.5074,
    longitude: -0.1278,
  },
  eu: {
    latitude: 52.52,
    longitude: 13.405,
  },
  asia: {
    latitude: 35.6762,
    longitude: 139.6503,
  },
};
