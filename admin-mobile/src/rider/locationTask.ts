import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  LIVE_LOCATION_STATUSES,
  type RiderLocationMode,
  type RiderStop,
} from './model';
import {
  clearPendingRiderLocation,
  RIDER_LOCATION_POLICIES,
  submitRiderLocation,
} from './locationTransport';

export const RIDER_LOCATION_TASK = 'himaliya-rider-live-location';
const LOCATION_SNAPSHOT_KEY = 'himaliya:rider:active-location-stop:v2';

type LocationSnapshot = {
  orderIds: string[];
  trackingStatus: string;
  available: boolean;
  locationMode: RiderLocationMode;
};

async function readSnapshot(): Promise<LocationSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) as LocationSnapshot : null;
  } catch {
    return null;
  }
}

async function sendLocation(location: Location.LocationObject) {
  const snapshot = await readSnapshot();
  if (!snapshot?.available || !LIVE_LOCATION_STATUSES.has(snapshot.trackingStatus)) return;
  await submitRiderLocation(snapshot.orderIds, location, snapshot.locationMode);
}

if (!TaskManager.isTaskDefined(RIDER_LOCATION_TASK)) {
  TaskManager.defineTask(RIDER_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const locations = (data as { locations?: Location.LocationObject[] }).locations || [];
    const latest = locations[locations.length - 1];
    if (!latest) return;
    try { await sendLocation(latest); } catch { /* The durable queue retries network failures. */ }
  });
}

export async function setActiveLocationStop(
  stop: RiderStop | null,
  available: boolean,
  locationMode: RiderLocationMode,
) {
  if (!stop) {
    await AsyncStorage.removeItem(LOCATION_SNAPSHOT_KEY);
    return;
  }
  const snapshot: LocationSnapshot = {
    orderIds: stop.orderIds,
    trackingStatus: stop.trackingStatus,
    available,
    locationMode,
  };
  await AsyncStorage.setItem(LOCATION_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export async function requestRiderLocationPermissions() {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return { foreground: false, background: false };

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted') background = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: background.status === 'granted' };
}

export async function startRiderLocationUpdates(locationMode: RiderLocationMode) {
  const permissions = await requestRiderLocationPermissions();
  if (!permissions.foreground) return { started: false, background: false };
  if (permissions.background) {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK);
    if (alreadyStarted) await Location.stopLocationUpdatesAsync(RIDER_LOCATION_TASK);
    const policy = RIDER_LOCATION_POLICIES[locationMode];
    await Location.startLocationUpdatesAsync(RIDER_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: policy.minimumIntervalMs,
      distanceInterval: policy.minimumDistanceMeters,
      deferredUpdatesInterval: policy.minimumIntervalMs,
      deferredUpdatesDistance: policy.minimumDistanceMeters,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Himaliya delivery location is live',
        notificationBody: 'Customers can follow the active delivery while you are online.',
        notificationColor: '#078CAC',
      },
    });
  }
  return { started: true, background: permissions.background };
}

export async function stopRiderLocationUpdates() {
  if (await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(RIDER_LOCATION_TASK);
  }
  await AsyncStorage.removeItem(LOCATION_SNAPSHOT_KEY);
  await clearPendingRiderLocation();
}

export async function publishCurrentRiderLocation(
  stop: RiderStop,
  locationMode: RiderLocationMode,
) {
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const result = await submitRiderLocation(stop.orderIds, position, locationMode, true);
  return { position, result };
}
