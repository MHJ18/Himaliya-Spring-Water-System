import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationTone } from './model';

const RIDER_NOTIFICATION_TASK = 'himaliya-rider-notification-task';
const REPEAT_ALERTS_KEY = 'himaliya:rider:repeat-order-alerts';
const REPEAT_ALERT_IDS_KEY = 'himaliya:rider:repeat-alert-ids';
const REPEAT_TONE_KEY = 'himaliya:rider:repeat-alert-tone';
const REPEAT_VIBRATION_KEY = 'himaliya:rider:repeat-alert-vibration';

export const NOTIFICATION_TONES: Array<{
  id: NotificationTone;
  label: string;
  description: string;
  sound: string;
}> = [
  { id: 'water_drop', label: 'Water drop', description: 'Short and clear', sound: 'water_drop.wav' },
  { id: 'bright_chime', label: 'Bright chime', description: 'Easy to hear outside', sound: 'bright_chime.wav' },
  { id: 'soft_bell', label: 'Soft bell', description: 'Gentler alert', sound: 'soft_bell.wav' },
  { id: 'default', label: 'Phone default', description: 'Use the Android sound', sound: 'default' },
];

export function channelId(tone: NotificationTone, vibrationEnabled = true) {
  return `rider-orders-${tone.replace(/_/g, '-')}-${vibrationEnabled ? 'vibrate' : 'quiet'}`;
}

function legacyChannelId(tone: NotificationTone) {
  return `rider-orders-${tone.replace(/_/g, '-')}`;
}

async function repeatAlertIds() {
  const value = await AsyncStorage.getItem(REPEAT_ALERT_IDS_KEY).catch(() => null);
  if (!value) return {} as Record<string, string>;
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

function taskOrderId(payload: Notifications.NotificationTaskPayload) {
  if ('actionIdentifier' in payload) {
    const value = payload.notification.request.content.data?.orderId;
    return typeof value === 'string' ? value : '';
  }
  const source = payload.data?.dataString
    ? (() => {
      try { return JSON.parse(payload.data.dataString) as Record<string, unknown>; } catch { return {}; }
    })()
    : payload.data;
  const nested = source?.data && typeof source.data === 'object'
    ? source.data as Record<string, unknown>
    : {};
  const value = source?.orderId || nested.orderId;
  return typeof value === 'string' ? value : '';
}

export async function setNotificationRepeatPreference(
  enabled: boolean,
  tone: NotificationTone,
  vibrationEnabled: boolean,
) {
  await AsyncStorage.multiSet([
    [REPEAT_ALERTS_KEY, enabled ? 'true' : 'false'],
    [REPEAT_TONE_KEY, tone],
    [REPEAT_VIBRATION_KEY, vibrationEnabled ? 'true' : 'false'],
  ]);
  if (!enabled) await cancelRepeatingOrderAlerts();
}

export async function startRepeatingOrderAlert(orderId: string) {
  if (!orderId || AppState.currentState === 'active') return;
  const [enabled, toneValue, vibrationValue, ids] = await Promise.all([
    AsyncStorage.getItem(REPEAT_ALERTS_KEY),
    AsyncStorage.getItem(REPEAT_TONE_KEY),
    AsyncStorage.getItem(REPEAT_VIBRATION_KEY),
    repeatAlertIds(),
  ]);
  if (enabled !== 'true' || ids[orderId]) return;
  const selectedTone = NOTIFICATION_TONES.some((item) => item.id === toneValue)
    ? toneValue as NotificationTone
    : 'water_drop';
  const vibrationEnabled = vibrationValue !== 'false';
  const tone = NOTIFICATION_TONES.find((item) => item.id === selectedTone) || NOTIFICATION_TONES[0];
  await ensureNotificationChannels();
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Delivery waiting',
      body: 'Open Himaliya Rider or mark the bottles picked up.',
      data: { orderId, type: 'repeating_order_alert' },
      sound: tone.sound,
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: true,
      autoDismiss: false,
    },
    trigger: Platform.OS === 'android'
      ? {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 60,
        repeats: true,
        channelId: channelId(selectedTone, vibrationEnabled),
      }
      : {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 60,
        repeats: true,
      },
  });
  await AsyncStorage.setItem(REPEAT_ALERT_IDS_KEY, JSON.stringify({ ...ids, [orderId]: identifier }));
}

export async function cancelRepeatingOrderAlerts(orderIds?: string[]) {
  const ids = await repeatAlertIds();
  const targets = orderIds?.length ? orderIds : Object.keys(ids);
  await Promise.all(targets.flatMap((orderId) => {
    const identifier = ids[orderId];
    if (!identifier) return [];
    return [
      Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {}),
      Notifications.dismissNotificationAsync(identifier).catch(() => {}),
    ];
  }));
  const remaining = Object.fromEntries(
    Object.entries(ids).filter(([orderId]) => !targets.includes(orderId)),
  );
  await AsyncStorage.setItem(REPEAT_ALERT_IDS_KEY, JSON.stringify(remaining));
}

if (!TaskManager.isTaskDefined(RIDER_NOTIFICATION_TASK)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    RIDER_NOTIFICATION_TASK,
    async ({ data, error }) => {
      if (error) return Notifications.BackgroundNotificationTaskResult.Failed;
      if ('actionIdentifier' in data) {
        await cancelRepeatingOrderAlerts();
        return Notifications.BackgroundNotificationTaskResult.NewData;
      }
      const orderId = taskOrderId(data);
      if (orderId) await startRepeatingOrderAlert(orderId);
      return orderId
        ? Notifications.BackgroundNotificationTaskResult.NewData
        : Notifications.BackgroundNotificationTaskResult.NoData;
    },
  );
}

export function configureNotificationBehavior() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  Notifications.registerTaskAsync(RIDER_NOTIFICATION_TASK).catch(() => {});
}

export async function ensureNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all(NOTIFICATION_TONES.flatMap((tone) => [
    ...[true, false].map((vibrationEnabled) => (
      Notifications.setNotificationChannelAsync(channelId(tone.id, vibrationEnabled), {
        name: `New orders - ${tone.label}${vibrationEnabled ? '' : ' (no vibration)'}`,
        description: 'Alerts for newly assigned Himaliya deliveries',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: vibrationEnabled ? [0, 220, 120, 220] : null,
        enableVibrate: vibrationEnabled,
        lightColor: '#26BCE2',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: tone.sound,
      })
    )),
    Notifications.setNotificationChannelAsync(legacyChannelId(tone.id), {
      name: `New orders - ${tone.label}`,
      description: 'Compatibility channel for Himaliya order alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 220, 120, 220],
      enableVibrate: true,
      lightColor: '#26BCE2',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: tone.sound,
    }),
  ]));
}

export async function registerRiderPushToken() {
  await ensureNotificationChannels();
  if (!Device.isDevice) return { token: null, state: 'device-required' as const };

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { token: null, state: 'denied' as const };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) return { token: null, state: 'unconfigured' as const };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return { token, state: 'registered' as const };
}

export async function previewNotificationTone(toneId: NotificationTone, vibrationEnabled = true) {
  await ensureNotificationChannels();
  const tone = NOTIFICATION_TONES.find((item) => item.id === toneId) || NOTIFICATION_TONES[0];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: tone.label,
      body: 'This is how a new delivery will sound.',
      sound: tone.sound,
    },
    trigger: Platform.OS === 'android'
      ? {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        repeats: false,
        channelId: channelId(tone.id, vibrationEnabled),
      }
      : null,
  });
}

export function notificationOrderId(response: Notifications.NotificationResponse | null | undefined) {
  const value = response?.notification.request.content.data?.orderId;
  return typeof value === 'string' ? value : '';
}
