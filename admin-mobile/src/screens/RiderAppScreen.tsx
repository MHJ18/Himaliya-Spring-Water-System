import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState as NativeAppState,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import {
  ACTIVE_TRACKING_STATUSES,
  LIVE_LOCATION_STATUSES,
  bottleName,
  customerOf,
  formatOrderDate,
  groupRiderStops,
  itemSummary,
  normalizeItems,
  sortActiveOrders,
  trackingStatusName,
  type BottleItem,
  type NotificationTone,
  type RiderLocationMode,
  type RiderMobileConfig,
  type RiderOrder,
  type RiderStop,
} from '../rider/model';
import {
  flushDeliveryQueue,
  queuedDeliveryCount,
  submitDeliveryUpdate,
} from '../rider/offlineQueue';
import {
  publishCurrentRiderLocation,
  setActiveLocationStop,
  startRiderLocationUpdates,
  stopRiderLocationUpdates,
} from '../rider/locationTask';
import {
  flushPendingRiderLocation,
  RIDER_LOCATION_POLICIES,
  submitRiderLocation,
} from '../rider/locationTransport';
import {
  NOTIFICATION_TONES,
  cancelRepeatingOrderAlerts,
  notificationOrderId,
  previewNotificationTone,
  registerRiderPushToken,
  setNotificationRepeatPreference,
} from '../rider/notifications';

type Tab = 'route' | 'orders' | 'history' | 'profile';
type GpsState = 'off' | 'starting' | 'live' | 'foreground' | 'blocked';
type PushState = 'starting' | 'registered' | 'disabled' | 'denied' | 'device-required' | 'unconfigured' | 'failed';
type SettingsSection = 'profile' | 'delivery' | 'appearance' | 'alerts' | 'location' | 'help';

const THEME_KEY = 'himaliya:rider:theme';
const COMPACT_TEXT_KEY = 'himaliya:rider:compact-text';
const REPEAT_ALERTS_KEY = 'himaliya:rider:repeat-order-alerts';
const SHOW_ROUTE_HEADER_KEY = 'himaliya:rider:show-route-header';
const PICK_UP_ALL_KEY = 'himaliya:rider:pick-up-all';
const ACTIVE_STATUS_VALUES = Array.from(ACTIVE_TRACKING_STATUSES);
const RIDER_ORDER_SELECT = [
  'id',
  'customer_id',
  'assigned_rider_id',
  'quantity',
  'bottle_type',
  'items',
  'delivered_items',
  'delivery_address',
  'delivery_date',
  'notes',
  'status',
  'tracking_status',
  'bottles_collected',
  'bottles_dropped_off',
  'rider_lat',
  'rider_lng',
  'rider_heading',
  'assigned_at',
  'delivered_at',
  'created_at',
  'updated_at',
  'customers(id,name,phone,address)',
].join(',');
const RIDER_REALTIME_COLUMNS = [
  'id',
  'customer_id',
  'assigned_rider_id',
  'quantity',
  'bottle_type',
  'items',
  'delivered_items',
  'delivery_address',
  'delivery_date',
  'notes',
  'status',
  'tracking_status',
  'bottles_collected',
  'bottles_dropped_off',
  'rider_lat',
  'rider_lng',
  'rider_heading',
  'assigned_at',
  'delivered_at',
  'created_at',
  'updated_at',
];

function nextAction(status: string) {
  if (status === 'assigned') return { status: 'picked_up', label: 'Bottles picked up', icon: 'archive-outline' as const };
  if (status === 'picked_up') return { status: 'en_route', label: 'Start delivery', icon: 'navigate-outline' as const };
  if (status === 'en_route' || status === 'nearby') return { status: 'delivered', label: 'Finish delivery', icon: 'checkmark-circle-outline' as const };
  return null;
}

function bottleAcronym(value: string) {
  const normalized = bottleName(value).toLocaleLowerCase();
  if (normalized.includes('19l') || normalized.includes('gallon')) return '19L';
  if (normalized.includes('small')) return 'S';
  if (normalized.includes('medium')) return 'M';
  if (normalized.includes('large')) return 'L';
  return bottleName(value).replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'H2O';
}

function orderAddress(order?: RiderOrder | null) {
  return String(order?.delivery_address || customerOf(order).address || '').trim();
}

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || '');
  return String(error || 'Something went wrong.');
}

function isMissingRpc(error: unknown, functionName: string) {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const text = errorText(error);
  return code === 'PGRST202'
    || (text.toLocaleLowerCase().includes(functionName.toLocaleLowerCase())
      && /schema cache|could not find the function|function .* does not exist/i.test(text));
}

function optimisticStopUpdate(
  stop: RiderStop,
  status: string,
  bottlesCollected: number,
  deliveredItems?: BottleItem[],
) {
  if (status !== 'delivered' || !deliveredItems) {
    return stop.orders.map((order) => ({ ...order, tracking_status: status }));
  }
  const remaining = new Map(deliveredItems.map((item) => [
    item.bottleType.trim().toLocaleLowerCase(),
    Number(item.quantity || 0),
  ]));
  return stop.orders.map((order, orderIndex) => {
    const allocated = normalizeItems(order).map((item) => {
      const key = item.bottleType.trim().toLocaleLowerCase();
      const quantity = Math.min(item.quantity, remaining.get(key) || 0);
      remaining.set(key, Math.max(0, (remaining.get(key) || 0) - quantity));
      return { bottleType: item.bottleType, quantity };
    }).filter((item) => item.quantity > 0);
    return {
      ...order,
      tracking_status: status,
      delivered_items: allocated,
      bottles_dropped_off: allocated.reduce((sum, item) => sum + item.quantity, 0),
      bottles_collected: orderIndex === 0 ? bottlesCollected : 0,
      delivered_at: new Date().toISOString(),
    };
  });
}

export function RiderAppScreen() {
  const { admin, setAdmin } = useApp();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [tab, setTab] = useState<Tab>('route');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(Boolean(admin?.rider_available));
  const [config, setConfig] = useState<RiderMobileConfig | null>(null);
  const [tone, setTone] = useState<NotificationTone>('water_drop');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [repeatOrderAlerts, setRepeatOrderAlerts] = useState(false);
  const [locationMode, setLocationMode] = useState<RiderLocationMode>('balanced');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pushState, setPushState] = useState<PushState>('starting');
  const [gps, setGps] = useState<GpsState>('off');
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [dark, setDark] = useState(false);
  const [compactText, setCompactText] = useState(false);
  const [showRouteHeader, setShowRouteHeader] = useState(true);
  const [pickUpAll, setPickUpAll] = useState(false);
  const [expandedSettings, setExpandedSettings] = useState<SettingsSection>('delivery');
  const [tabsWidth, setTabsWidth] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [collected, setCollected] = useState(0);
  const [deliveryCounts, setDeliveryCounts] = useState<Record<string, number>>({});
  const [celebrating, setCelebrating] = useState(false);
  const [profileName, setProfileName] = useState(admin?.name || '');
  const [profilePhone, setProfilePhone] = useState(admin?.phone || '');
  const [profilePhoto, setProfilePhoto] = useState(admin?.photo || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const pushTokenRef = useRef<string | null>(null);
  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const ordersRef = useRef<RiderOrder[]>([]);
  const selectedRef = useRef<RiderStop | null>(null);
  const celebrationScale = useRef(new Animated.Value(0.65)).current;
  const tabIndicatorPosition = useRef(new Animated.Value(0)).current;
  const fallbackWatcherRef = useRef<Location.LocationSubscription | null>(null);

  const palette = useMemo(() => dark ? {
    bg: '#06171D', surface: '#0C252E', surfaceRaised: '#14343D', ink: '#F3FBFC', muted: '#9EBAC1',
    border: '#22444D', primary: '#39C1D5', primaryDark: '#78DDEA', success: '#4BD39A', warning: '#FFC45E',
    danger: '#FF9478', shadow: '#000000', tab: '#081E26', overlay: 'rgba(0, 10, 18, .74)',
    hero: '#092F3C', heroText: '#F7FCFD', heroMuted: '#A9C9D0', heroAccent: '#63E3D8',
  } : {
    bg: '#F2F6F7', surface: '#FFFFFF', surfaceRaised: '#EAF2F4', ink: '#082A36', muted: '#607B84',
    border: '#D6E3E6', primary: '#087F9D', primaryDark: '#075E75', success: '#168D63', warning: '#D99018',
    danger: '#C8523B', shadow: '#183F4B', tab: '#FFFFFF', overlay: 'rgba(3, 24, 34, .58)',
    hero: '#082F3E', heroText: '#F7FCFD', heroMuted: '#B2CED5', heroAccent: '#62DDD3',
  }, [dark]);
  const styles = useMemo(() => makeStyles(palette, compactText), [compactText, palette]);

  const activeStops = useMemo(() => groupRiderStops(orders), [orders]);
  const historyOrders = useMemo(() => orders
    .filter((order) => order.tracking_status === 'delivered')
    .sort((left, right) => +new Date(right.delivered_at || right.created_at) - +new Date(left.delivered_at || left.created_at)), [orders]);
  const selectedStop = activeStops.find((stop) => stop.orderIds.includes(selectedId)) || activeStops[0] || null;
  const selected = selectedStop?.primaryOrder || null;
  const historyOrder = historyOrders.find((order) => order.id === historyId) || null;
  selectedRef.current = selectedStop;
  ordersRef.current = orders;

  const mergeOrder = useCallback((row: RiderOrder) => {
    setOrders((current) => {
      const existing = current.find((order) => order.id === row.id);
      if (!existing) return [row, ...current];
      return current.map((order) => (
        order.id === row.id
          ? { ...order, ...row, customers: row.customers ?? order.customers }
          : order
      ));
    });
  }, []);

  const fetchOrder = useCallback(async (orderId: string) => {
    const { data, error } = await supabase
      .from('customer_orders')
      .select(RIDER_ORDER_SELECT)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data as RiderOrder | null;
  }, []);

  const loadActive = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    const { data, error } = await supabase
      .from('customer_orders')
      .select(RIDER_ORDER_SELECT)
      .in('tracking_status', ACTIVE_STATUS_VALUES)
      .order('assigned_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) {
      setErrorMessage(error.message);
    } else {
      const next = (data || []) as unknown as RiderOrder[];
      const nextActive = sortActiveOrders(next);
      const nextIds = new Set(nextActive.map((order) => order.id));
      const known = knownOrderIdsRef.current;
      const newOrder = known ? nextActive.find((order) => !known.has(order.id)) : null;
      knownOrderIdsRef.current = nextIds;
      setOrders((current) => [
        ...next,
        ...current.filter((order) => order.tracking_status === 'delivered'),
      ]);
      setSelectedId((current) => {
        if (newOrder) return newOrder.id;
        return nextActive.some((order) => order.id === current) ? current : nextActive[0]?.id || '';
      });
      if (newOrder) {
        setTab('route');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadHistory = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setHistoryLoading(true);
    const { data, error } = await supabase
      .from('customer_orders')
      .select(RIDER_ORDER_SELECT)
      .eq('tracking_status', 'delivered')
      .order('delivered_at', { ascending: false, nullsFirst: false })
      .limit(30);
    if (error) {
      setErrorMessage(error.message);
    } else {
      const next = (data || []) as unknown as RiderOrder[];
      setOrders((current) => [
        ...current.filter((order) => order.tracking_status !== 'delivered'),
        ...next,
      ]);
      setHistoryId((current) => (next.some((order) => order.id === current) ? current : ''));
      setHistoryLoaded(true);
    }
    setHistoryLoading(false);
    setRefreshing(false);
  }, []);

  const updateQueueCount = useCallback(async () => {
    setQueued(await queuedDeliveryCount());
  }, []);

  const saveMobileSettings = useCallback(async (
    nextAvailable: boolean,
    nextTone: NotificationTone,
    token: string | null = pushTokenRef.current,
    nextNotificationsEnabled = true,
    nextVibrationEnabled = true,
    nextLocationMode: RiderLocationMode = 'balanced',
    nextReducedMotion = false,
  ) => {
    const modern = await supabase.rpc('update_rider_mobile_settings', {
      p_available: nextAvailable,
      p_notification_tone: nextTone,
      p_expo_push_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      p_notifications_enabled: nextNotificationsEnabled,
      p_vibration_enabled: nextVibrationEnabled,
      p_location_mode: nextLocationMode,
      p_reduced_motion: nextReducedMotion,
    });
    if (!modern.error) return modern.data as { available?: boolean; notificationTone?: NotificationTone };
    if (!isMissingRpc(modern.error, 'update_rider_mobile_settings')) throw modern.error;

    const legacy = await supabase.rpc('update_rider_mobile_settings', {
      p_available: nextAvailable,
      p_notification_tone: nextTone,
      p_expo_push_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (legacy.error) throw legacy.error;
    return legacy.data as { available?: boolean; notificationTone?: NotificationTone };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [
        themeValue,
        compactTextValue,
        repeatAlertsValue,
        showRouteHeaderValue,
        pickUpAllValue,
        mobileConfig,
      ] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY).catch(() => null),
        AsyncStorage.getItem(COMPACT_TEXT_KEY).catch(() => null),
        AsyncStorage.getItem(REPEAT_ALERTS_KEY).catch(() => null),
        AsyncStorage.getItem(SHOW_ROUTE_HEADER_KEY).catch(() => null),
        AsyncStorage.getItem(PICK_UP_ALL_KEY).catch(() => null),
        supabase.rpc('get_rider_mobile_config'),
      ]);
      if (!active) return;
      const configValue = (mobileConfig.data || {}) as RiderMobileConfig;
      const configuredTone = configValue.notificationTone || 'water_drop';
      const configuredNotifications = configValue.notificationsEnabled !== false;
      const configuredVibration = configValue.vibrationEnabled !== false;
      const configuredLocationMode = configValue.locationMode === 'data_saver' ? 'data_saver' : 'balanced';
      const configuredReducedMotion = configValue.reducedMotion === true;
      setDark(themeValue === 'dark' || (!themeValue && admin?.preferences?.theme === 'dark'));
      setCompactText(compactTextValue === 'true');
      setRepeatOrderAlerts(repeatAlertsValue === 'true');
      setShowRouteHeader(showRouteHeaderValue !== 'false');
      setPickUpAll(pickUpAllValue === 'true');
      setConfig(configValue);
      setAvailable(Boolean(configValue.available));
      setTone(configuredTone);
      setNotificationsEnabled(configuredNotifications);
      setVibrationEnabled(configuredVibration);
      setLocationMode(configuredLocationMode);
      setReducedMotion(configuredReducedMotion);
      await setNotificationRepeatPreference(
        repeatAlertsValue === 'true',
        configuredTone,
        configuredVibration,
      );
      await cancelRepeatingOrderAlerts();
      if (mobileConfig.error) setErrorMessage(mobileConfig.error.message);
      try {
        const registration = configuredNotifications
          ? await registerRiderPushToken()
          : { token: null, state: 'disabled' as const };
        if (!active) return;
        setPushState(registration.state);
        pushTokenRef.current = registration.token;
        await saveMobileSettings(
          Boolean(configValue.available),
          configuredTone,
          registration.token,
          configuredNotifications,
          configuredVibration,
          configuredLocationMode,
          configuredReducedMotion,
        );
      } catch (error) {
        if (active) {
          setPushState('failed');
          setErrorMessage(`Order alerts need attention: ${errorText(error)}`);
        }
      }
      await loadActive();
      await updateQueueCount();
    })();
    return () => { active = false; };
  }, [admin?.preferences?.theme, loadActive, saveMobileSettings, updateQueueCount]);

  useEffect(() => {
    if (!admin?.id) return undefined;
    const handleChange = async (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      new: Record<string, unknown>;
      old: Record<string, unknown>;
    }) => {
      const row = payload.new as unknown as RiderOrder;
      const orderId = String(row?.id || payload.old?.id || '');
      if (!orderId) return;
      if (payload.eventType === 'DELETE') {
        setOrders((current) => current.filter((order) => order.id !== orderId));
        return;
      }

      const existing = ordersRef.current.find((order) => order.id === orderId);
      if (existing) {
        mergeOrder(row);
        return;
      }

      try {
        const order = await fetchOrder(orderId);
        if (!order) return;
        mergeOrder(order);
        if (ACTIVE_TRACKING_STATUSES.has(order.tracking_status)) {
          knownOrderIdsRef.current?.add(order.id);
          setSelectedId(order.id);
          setTab('route');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } catch (error) {
        setErrorMessage(errorText(error));
      }
    };

    const filter = `assigned_rider_id=eq.${admin.id}`;
    const channel = supabase.channel(`native-rider-orders-${admin?.id || 'current'}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'customer_orders',
        filter,
        select: RIDER_REALTIME_COLUMNS,
      }, handleChange)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter,
        select: RIDER_REALTIME_COLUMNS,
      }, handleChange)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [admin?.id, fetchOrder, mergeOrder]);

  const focusOrder = useCallback(async (orderId: string) => {
    if (!orderId) return;
    const existing = ordersRef.current.find((order) => order.id === orderId);
    if (!existing) {
      try {
        const order = await fetchOrder(orderId);
        if (order) mergeOrder(order);
      } catch (error) {
        setErrorMessage(errorText(error));
      }
    }
    setSelectedId(orderId);
    setTab('route');
  }, [fetchOrder, mergeOrder]);

  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      cancelRepeatingOrderAlerts().catch(() => {});
      focusOrder(notificationOrderId(response));
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const orderId = notificationOrderId(response);
      if (orderId) focusOrder(orderId);
    }).catch(() => {});
    return () => responseListener.remove();
  }, [focusOrder]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(connected);
      if (connected) {
        Promise.all([
          flushDeliveryQueue(),
          flushPendingRiderLocation().catch(() => false),
        ])
          .then(([remaining]) => { setQueued(remaining); return loadActive(); })
          .catch((error) => setErrorMessage(errorText(error)));
      } else {
        updateQueueCount();
      }
    });
    const appState = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        cancelRepeatingOrderAlerts().catch(() => {});
        flushDeliveryQueue().then(setQueued).catch(() => {});
        flushPendingRiderLocation().catch(() => {});
        loadActive();
        if (tab === 'history') loadHistory();
      }
    });
    return () => { unsubscribe(); appState.remove(); };
  }, [loadActive, loadHistory, tab, updateQueueCount]);

  useEffect(() => {
    const target = ({ route: 0, orders: 1, history: 2, profile: 3 } as Record<Tab, number>)[tab];
    if (reducedMotion) {
      tabIndicatorPosition.setValue(target);
      return;
    }
    Animated.spring(tabIndicatorPosition, {
      toValue: target,
      damping: 19,
      stiffness: 190,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [reducedMotion, tab, tabIndicatorPosition]);

  useEffect(() => {
    if (tab === 'history' && !historyLoaded && !historyLoading) loadHistory();
  }, [historyLoaded, historyLoading, loadHistory, tab]);

  useEffect(() => {
    setActiveLocationStop(selectedStop, available, locationMode).catch(() => {});
  }, [available, locationMode, selectedStop]);

  useEffect(() => {
    let cancelled = false;
    fallbackWatcherRef.current?.remove();
    fallbackWatcherRef.current = null;
    if (!available || !selectedStop || !LIVE_LOCATION_STATUSES.has(selectedStop.trackingStatus)) {
      setGps('off');
      stopRiderLocationUpdates().catch(() => {});
      return undefined;
    }
    setGps('starting');
    (async () => {
      try {
        const permission = await startRiderLocationUpdates(locationMode);
        if (cancelled) return;
        if (!permission.started) { setGps('blocked'); return; }
        setGps(permission.background ? 'live' : 'foreground');
        const current = selectedRef.current;
        if (current) {
          await publishCurrentRiderLocation(current, locationMode);
        }
        if (!permission.background) {
          const policy = RIDER_LOCATION_POLICIES[locationMode];
          fallbackWatcherRef.current = await Location.watchPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeInterval: policy.minimumIntervalMs,
            distanceInterval: policy.minimumDistanceMeters,
          }, async (position) => {
            const stop = selectedRef.current;
            if (!stop) return;
            try {
              await submitRiderLocation(stop.orderIds, position, locationMode);
            } catch { /* Status actions show actionable errors; GPS retries continuously. */ }
          });
        }
      } catch (error) {
        if (!cancelled) {
          setGps('blocked');
          setErrorMessage(`Live location is off: ${errorText(error)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
      fallbackWatcherRef.current?.remove();
      fallbackWatcherRef.current = null;
    };
  }, [available, locationMode, selectedStop?.key, selectedStop?.trackingStatus]);

  useEffect(() => () => { stopRiderLocationUpdates().catch(() => {}); }, []);

  const toggleAvailability = async (value: boolean) => {
    const previous = available;
    setAvailable(value);
    try {
      await saveMobileSettings(
        value,
        tone,
        pushTokenRef.current,
        notificationsEnabled,
        vibrationEnabled,
        locationMode,
        reducedMotion,
      );
      setAdmin(admin ? { ...admin, rider_available: value } : admin);
      if (!value) await stopRiderLocationUpdates();
    } catch (error) {
      setAvailable(previous);
      Alert.alert('Could not change status', errorText(error));
    }
  };

  const changeTone = async (value: NotificationTone) => {
    const previous = tone;
    setTone(value);
    try {
      await saveMobileSettings(
        available,
        value,
        pushTokenRef.current,
        notificationsEnabled,
        vibrationEnabled,
        locationMode,
        reducedMotion,
      );
      await setNotificationRepeatPreference(repeatOrderAlerts, value, vibrationEnabled);
      await previewNotificationTone(value, vibrationEnabled);
    } catch (error) {
      setTone(previous);
      Alert.alert('Could not save sound', errorText(error));
    }
  };

  const toggleNotifications = async (value: boolean) => {
    const previous = notificationsEnabled;
    setNotificationsEnabled(value);
    try {
      let token = pushTokenRef.current;
      if (value && !token) {
        const registration = await registerRiderPushToken();
        setPushState(registration.state);
        token = registration.token;
        pushTokenRef.current = token;
        if (!token) throw new Error('Allow notifications in Android settings to receive new orders.');
      }
      await saveMobileSettings(
        available,
        tone,
        token,
        value,
        vibrationEnabled,
        locationMode,
        reducedMotion,
      );
      setPushState(value ? 'registered' : 'disabled');
      if (!value) await cancelRepeatingOrderAlerts();
    } catch (error) {
      setNotificationsEnabled(previous);
      Alert.alert('Could not change alerts', errorText(error));
    }
  };

  const toggleVibration = async (value: boolean) => {
    const previous = vibrationEnabled;
    setVibrationEnabled(value);
    try {
      await saveMobileSettings(
        available,
        tone,
        pushTokenRef.current,
        notificationsEnabled,
        value,
        locationMode,
        reducedMotion,
      );
      await setNotificationRepeatPreference(repeatOrderAlerts, tone, value);
      if (notificationsEnabled) await previewNotificationTone(tone, value);
    } catch (error) {
      setVibrationEnabled(previous);
      Alert.alert('Could not change vibration', errorText(error));
    }
  };

  const toggleRepeatOrderAlerts = async (value: boolean) => {
    setRepeatOrderAlerts(value);
    try {
      await setNotificationRepeatPreference(value, tone, vibrationEnabled);
    } catch (error) {
      setRepeatOrderAlerts(!value);
      Alert.alert('Could not change repeat alerts', errorText(error));
    }
  };

  const toggleShowRouteHeader = async (value: boolean) => {
    setShowRouteHeader(value);
    await AsyncStorage.setItem(SHOW_ROUTE_HEADER_KEY, value ? 'true' : 'false');
  };

  const togglePickUpAll = async (value: boolean) => {
    setPickUpAll(value);
    await AsyncStorage.setItem(PICK_UP_ALL_KEY, value ? 'true' : 'false');
  };

  const toggleDataSaver = async (value: boolean) => {
    const previous = locationMode;
    const next: RiderLocationMode = value ? 'data_saver' : 'balanced';
    setLocationMode(next);
    try {
      await saveMobileSettings(
        available,
        tone,
        pushTokenRef.current,
        notificationsEnabled,
        vibrationEnabled,
        next,
        reducedMotion,
      );
    } catch (error) {
      setLocationMode(previous);
      Alert.alert('Could not change location mode', errorText(error));
    }
  };

  const toggleReducedMotion = async (value: boolean) => {
    const previous = reducedMotion;
    setReducedMotion(value);
    try {
      await saveMobileSettings(
        available,
        tone,
        pushTokenRef.current,
        notificationsEnabled,
        vibrationEnabled,
        locationMode,
        value,
      );
    } catch (error) {
      setReducedMotion(previous);
      Alert.alert('Could not change motion setting', errorText(error));
    }
  };

  const openMaps = async (address: string) => {
    if (!address) { Alert.alert('Address missing', 'Ask the admin to add the customer delivery address.'); return; }
    const encoded = encodeURIComponent(address);
    const nativeUrl = Platform.OS === 'android' ? `geo:0,0?q=${encoded}` : `maps:0,0?q=${encoded}`;
    try {
      await Linking.openURL(nativeUrl);
    } catch {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
    }
  };

  const updateStatus = async (
    status: string,
    emptyBottles?: number,
    deliveredItems?: BottleItem[],
    targetStopParam?: RiderStop,
  ) => {
    const currentStop = targetStopParam || selectedStop;
    if (!currentStop || !currentStop.primaryOrder || saving) return;
    const defaultCollected = emptyBottles !== undefined ? emptyBottles : (currentStop.bottlesCollected || 0);
    setSaving(true);
    try {
      const targetStops = status === 'picked_up' && pickUpAll
        ? activeStops.filter((stop) => stop.trackingStatus === 'assigned')
        : [currentStop];
      let queuedUpdate = false;
      for (const targetStop of targetStops) {
        const targetOrder = targetStop.primaryOrder;
        const targetCollected = targetStop.key === currentStop.key
          ? defaultCollected
          : targetStop.bottlesCollected;
        const targetDeliveredItems = targetStop.key === currentStop.key ? deliveredItems : undefined;
        const result = await submitDeliveryUpdate({
          orderIds: targetStop.orderIds,
          orderItems: targetStop.orders.map((order) => ({
            orderId: order.id,
            items: normalizeItems(order),
          })),
          trackingStatus: status,
          bottlesCollected: targetCollected,
          deliveredItems: targetDeliveredItems ?? null,
          riderLat: targetOrder.rider_lat ?? null,
          riderLng: targetOrder.rider_lng ?? null,
          riderHeading: targetOrder.rider_heading ?? null,
        });
        const changedOrders = result.orders.length
          ? result.orders
          : optimisticStopUpdate(targetStop, status, targetCollected, targetDeliveredItems);
        changedOrders.forEach(mergeOrder);
        queuedUpdate = queuedUpdate || result.queued;
      }
      if (queuedUpdate) await updateQueueCount();
      if (status === 'picked_up') {
        await cancelRepeatingOrderAlerts(targetStops.flatMap((stop) => stop.orderIds));
      }
      Haptics.notificationAsync(status === 'delivered'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (status === 'delivered') {
        setConfirming(false);
        setCelebrating(true);
        celebrationScale.setValue(reducedMotion ? 1 : 0.65);
        if (!reducedMotion) {
          Animated.spring(celebrationScale, {
            toValue: 1,
            friction: 5,
            tension: 90,
            useNativeDriver: true,
          }).start();
        }
        setTimeout(() => { setCelebrating(false); }, reducedMotion ? 800 : 1700);
      }
    } catch (error) {
      Alert.alert('Update not saved', errorText(error));
    } finally {
      setSaving(false);
    }
  };

  const openDeliveryConfirmation = (stopTarget?: RiderStop) => {
    const target = stopTarget || selectedStop;
    if (!target) return;
    setSelectedId(target.primaryOrder.id);
    setDeliveryCounts(Object.fromEntries(target.items.map((item) => [item.bottleType, item.quantity])));
    setCollected(Number(target.bottlesCollected || 0));
    setConfirming(true);
  };

  const toggleTheme = async () => {
    const next = !dark;
    setDark(next);
    await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    if (admin) {
      supabase.rpc('update_rider_profile', {
        p_name: admin.name,
        p_phone: profilePhone,
        p_photo: profilePhoto,
        p_theme: next ? 'dark' : 'light',
      }).then(({ data }) => { if (data) setAdmin({ ...admin, ...(data as typeof admin) }); });
    }
  };

  const toggleCompactText = async (value: boolean) => {
    setCompactText(value);
    await AsyncStorage.setItem(COMPACT_TEXT_KEY, value ? 'true' : 'false');
  };

  const saveProfile = async (photo = profilePhoto) => {
    setProfileSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_rider_profile', {
        p_name: profileName.trim(),
        p_phone: profilePhone.trim(),
        p_photo: photo,
        p_theme: dark ? 'dark' : 'light',
      });
      if (error) throw error;
      const next = data as typeof admin;
      setAdmin(admin ? { ...admin, ...next } : next);
      setProfilePhoto(next?.photo || photo);
      Alert.alert('Profile saved', 'Your rider profile is up to date.');
    } catch (error) {
      Alert.alert('Could not save profile', errorText(error));
    } finally {
      setProfileSaving(false);
    }
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo permission needed', 'Allow photo access to choose a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.25,
      base64: true,
    });
    const asset = !result.canceled ? result.assets[0] : null;
    if (!asset?.base64) return;
    const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType || '') ? asset.mimeType : 'image/jpeg';
    const value = `data:${mime};base64,${asset.base64}`;
    if (value.length > 390000) { Alert.alert('Photo is too large', 'Choose a smaller photo and try again.'); return; }
    setProfilePhoto(value);
    await saveProfile(value);
  };

  const openBatterySettings = async () => {
    try {
      if (Platform.OS === 'android') await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      else await Linking.openSettings();
    } catch { await Linking.openSettings(); }
  };

  const openSystemSettings = async () => {
    await Linking.openSettings();
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <View style={styles.loadingMark}><Ionicons name="bicycle" size={28} color="#FFFFFF" /></View>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingTitle}>Preparing your deliveries</Text>
        <Text style={styles.muted}>Your route will open as soon as orders are ready.</Text>
      </View>
    );
  }

  const action = selectedStop ? nextAction(selectedStop.trackingStatus) : null;
  const customer = selectedStop?.customer || {};
  const address = selectedStop?.deliveryAddress || '';
  const deliveredTotal = Object.values(deliveryCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const activeBottleTotal = activeStops.reduce((sum, stop) => sum + stop.totalQuantity, 0);
  const selectedStopNumber = selectedStop ? activeStops.findIndex((stop) => stop.key === selectedStop.key) + 1 : 0;
  const tabSlotWidth = Math.max(0, (tabsWidth - 8) / 4);
  const tabIndicatorTranslate = tabIndicatorPosition.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, tabSlotWidth, tabSlotWidth * 2, tabSlotWidth * 3],
  });
  const settingsGroup = (
    id: SettingsSection,
    title: string,
    description: string,
    icon: React.ComponentProps<typeof Ionicons>['name'],
    children: React.ReactNode,
    status?: string,
  ) => {
    const expanded = expandedSettings === id;
    return (
      <View style={styles.settingsGroup}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}. ${description}`}
          style={({ pressed }) => [styles.settingsGroupHeader, pressed && styles.pressed]}
          onPress={() => setExpandedSettings((current) => current === id ? 'delivery' : id)}
        >
          <View style={styles.settingsGroupIcon}><Ionicons name={icon} size={21} color={palette.primary} /></View>
          <View style={styles.settingsGroupCopy}>
            <Text style={styles.settingsGroupTitle}>{title}</Text>
            <Text numberOfLines={1} style={styles.settingsGroupHelp}>{description}</Text>
          </View>
          {status ? <Text style={styles.settingsGroupStatus}>{status}</Text> : null}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={palette.muted} />
        </Pressable>
        {expanded ? <View style={styles.settingsSection}>{children}</View> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      {!online && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color={palette.warning} />
          <Text style={styles.offlineText}>No internet. Your updates will send automatically.</Text>
        </View>
      )}
      {queued > 0 && online && (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={styles.syncText}>Sending {queued} saved update{queued === 1 ? '' : 's'}...</Text>
        </View>
      )}
      {errorMessage ? (
        <Pressable style={styles.errorBanner} onPress={() => setErrorMessage('')}>
          <Ionicons name="warning-outline" size={18} color={palette.danger} />
          <Text numberOfLines={2} style={styles.errorText}>{errorMessage}</Text>
          <Ionicons name="close" size={18} color={palette.muted} />
        </Pressable>
      ) : null}

      {tab === 'route' && (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadActive(true)} tintColor={palette.primary} />}
        >
          {showRouteHeader && <View style={styles.routeHero}>
            <View style={styles.routeHeroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeHeroEyebrow}>TODAY&apos;S ROUTE</Text>
                <Text style={styles.routeHeroTitle}>
                  {activeStops.length ? `${activeStops.length} stop${activeStops.length === 1 ? '' : 's'} left` : 'Route complete'}
                </Text>
              </View>
              <View style={styles.livePill}>
                <View style={[styles.liveDot, gps === 'blocked' && styles.gpsDotError]} />
                <Text style={styles.livePillText}>
                  {gps === 'live' || gps === 'foreground' ? 'Sharing' : gps === 'blocked' ? 'GPS off' : 'Synced'}
                </Text>
              </View>
            </View>
            <View style={styles.routeStats}>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatValue}>{selectedStopNumber || '—'}</Text>
                <Text style={styles.routeStatLabel}>Current stop</Text>
              </View>
              <View style={styles.routeStatDivider} />
              <View style={styles.routeStat}>
                <Text style={styles.routeStatValue}>{activeBottleTotal}</Text>
                <Text style={styles.routeStatLabel}>Bottles left</Text>
              </View>
              <View style={styles.routeStatDivider} />
              <View style={styles.routeStat}>
                <Text style={styles.routeStatValue}>{online ? 'Live' : 'Saved'}</Text>
                <Text style={styles.routeStatLabel}>Updates</Text>
              </View>
            </View>
          </View>}

          {activeStops.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${available ? palette.success : palette.muted}18` }]}>
                <Ionicons name={available ? 'checkmark-circle' : 'power-outline'} size={58} color={available ? palette.success : palette.muted} />
              </View>
              <Text style={styles.emptyTitle}>{available ? 'Ready for a new order' : 'You are offline'}</Text>
              <Text style={styles.muted}>{available ? 'New assigned deliveries appear here automatically.' : 'Go online when you are ready to receive deliveries.'}</Text>
            </View>
          ) : (
            activeStops.map((stopItem, stopIndex) => {
              const isSelected = selectedStop?.key === stopItem.key;
              const isRepeatCustomer = stopItem.orders.length > 1;
              const stopCustomer = stopItem.customer || {};
              const stopAddress = stopItem.deliveryAddress || '';
              const stopAction = nextAction(stopItem.trackingStatus);
              return (
                <Pressable
                  key={stopItem.key}
                  onPress={() => setSelectedId(stopItem.primaryOrder.id)}
                  style={[
                    styles.missionCard,
                    isRepeatCustomer && styles.missionCardRepeat,
                    isSelected && styles.missionCardSelected,
                  ]}
                >
                  <View style={styles.missionTop}>
                    <View style={[styles.stopNumber, isRepeatCustomer && styles.stopNumberRepeat]}>
                      <Text style={styles.stopNumberText}>{stopIndex + 1}</Text>
                    </View>
                    <View style={styles.missionCopy}>
                      <Text style={[styles.missionLabel, isRepeatCustomer && { color: '#D97706' }]}>
                        {stopIndex === 0 ? 'NEXT DELIVERY' : `STOP #${stopIndex + 1}`}
                      </Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.orderCustomer}>
                        {stopCustomer.name || 'Customer'}
                      </Text>
                      {isRepeatCustomer && (
                        <View style={styles.repeatBadge}>
                          <Ionicons name="sparkles" size={12} color={dark ? '#FBBF24' : '#B45309'} />
                          <Text style={styles.repeatBadgeText}>
                            REPEAT CUSTOMER ({stopItem.orders.length}x ORDERS)
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.statusPill, isRepeatCustomer && { backgroundColor: '#FDE68A' }]}>
                      <View style={[styles.statusDot, isRepeatCustomer && { backgroundColor: '#D97706' }]} />
                      <Text style={[styles.statusPillText, isRepeatCustomer && { color: '#B45309' }]}>
                        {trackingStatusName(stopItem.trackingStatus)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.deliverSection}>
                    <Text style={styles.addressLabel}>DELIVER TO</Text>
                    <View style={styles.addressBlock}>
                      <Pressable
                        accessibilityLabel="Open address in maps"
                        accessibilityHint="Opens default maps"
                        disabled={!stopAddress}
                        style={[styles.addressPin, !stopAddress && styles.disabled]}
                        onPress={() => openMaps(stopAddress)}
                      >
                        <Ionicons name="navigate" size={22} color={isRepeatCustomer ? '#D97706' : palette.primary} />
                      </Pressable>
                      <Text selectable style={styles.addressText}>{stopAddress || 'Address missing'}</Text>
                    </View>
                  </View>

                  {isRepeatCustomer && (
                    <View style={styles.subOrderContainer}>
                      <Text style={[styles.cardLabel, { color: dark ? '#FBBF24' : '#B45309' }]}>GROUPED ORDERS</Text>
                      {stopItem.orders.map((subOrder, subIdx) => (
                        <View key={subOrder.id || subIdx} style={styles.subOrderRow}>
                          <Ionicons name="cube-outline" size={14} color={dark ? '#FBBF24' : '#D97706'} />
                          <Text style={styles.subOrderText}>
                            Order #{String(subOrder.id || '').slice(-6).toUpperCase()}: {itemSummary(subOrder)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.bottleSection}>
                    <View style={styles.bottleSectionHeading}>
                      <Text style={styles.cardLabel}>ITEMS</Text>
                      <Text style={[styles.itemsTotal, isRepeatCustomer && { color: '#D97706' }]}>
                        {stopItem.totalQuantity} total
                      </Text>
                    </View>
                    <View style={styles.bottleGrid}>
                      {stopItem.items.map((item) => {
                        const code = bottleAcronym(item.bottleType);
                        return (
                          <View
                            key={item.bottleType}
                            accessible
                            accessibilityLabel={`${item.quantity} ${bottleName(item.bottleType)}`}
                            style={[
                              styles.bottleTile,
                              code === 'S' && styles.bottleTileSmall,
                              code === 'M' && styles.bottleTileMedium,
                              code === 'L' && styles.bottleTileLarge,
                              code === '19L' && styles.bottleTileGallon,
                            ]}
                          >
                            <Text style={styles.bottleCode}>{code}</Text>
                            <Text style={styles.bottleQuantity}>×{item.quantity}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {stopItem.notes.length > 0 && (
                    <View style={styles.noteCard}>
                      <Ionicons name="document-text-outline" size={22} color={palette.warning} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardLabel}>CUSTOMER NOTE</Text>
                        <Text style={styles.noteText}>{stopItem.notes.join('\n')}</Text>
                      </View>
                    </View>
                  )}

                  {stopAction && (
                    <View style={[styles.actionDock, { marginTop: 12 }]}>
                      {!available && <Text style={styles.goOnlineHint}>Go online before updating this delivery.</Text>}
                      <View style={styles.actionRow}>
                        <View style={styles.quickActions}>
                          <Pressable
                            accessibilityLabel="Call customer"
                            disabled={!stopCustomer.phone}
                            style={[styles.iconAction, !stopCustomer.phone && styles.disabled]}
                            onPress={() => stopCustomer.phone && Linking.openURL(`tel:${stopCustomer.phone}`)}
                          >
                            <Ionicons name="call-outline" size={20} color={palette.primary} />
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Text customer"
                            disabled={!stopCustomer.phone}
                            style={[styles.iconAction, !stopCustomer.phone && styles.disabled]}
                            onPress={() => stopCustomer.phone && Linking.openURL(`sms:${stopCustomer.phone}`)}
                          >
                            <Ionicons name="chatbubble-outline" size={19} color={palette.primary} />
                          </Pressable>
                          <Pressable
                            accessibilityLabel="WhatsApp customer"
                            disabled={!stopCustomer.phone}
                            style={[styles.iconAction, styles.iconActionWa, !stopCustomer.phone && styles.disabled]}
                            onPress={() => stopCustomer.phone && Linking.openURL(`https://wa.me/${String(stopCustomer.phone).replace(/[^0-9]/g, '')}`)}
                          >
                            <Ionicons name="logo-whatsapp" size={19} color="#25D366" />
                          </Pressable>
                        </View>
                        <Pressable
                          disabled={saving || !available}
                          style={[styles.primaryAction, (saving || !available) && styles.disabled]}
                          onPress={() => {
                            setSelectedId(stopItem.primaryOrder.id);
                            if (stopAction.status === 'delivered') {
                              openDeliveryConfirmation(stopItem);
                            } else {
                              updateStatus(stopAction.status, undefined, undefined, stopItem);
                            }
                          }}
                        >
                          <LinearGradient
                            colors={isRepeatCustomer ? ['#FDE68A', '#F59E0B', '#D97706'] : ['#C5FAFF', '#69E7F7', '#5A9CFF']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.primaryActionGradient}
                          >
                            <Text numberOfLines={1} style={[styles.primaryActionText, isRepeatCustomer && { color: '#3A1A00' }]}>
                              {saving && selectedStop?.key === stopItem.key ? 'Saving...' : stopAction.label}
                            </Text>
                            <View style={styles.primaryActionOrb}>
                              {saving && selectedStop?.key === stopItem.key
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <Ionicons name={stopAction.icon} size={22} color="#FFFFFF" />}
                            </View>
                          </LinearGradient>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {tab === 'orders' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadActive(true)} tintColor={palette.primary} />}>
          <Text style={styles.eyebrow}>TODAY</Text>
          <Text style={styles.pageTitle}>My deliveries</Text>
          <Text style={styles.pageIntro}>Oldest assigned stop is shown first.</Text>
          {activeStops.map((stop, index) => (
            <Pressable key={stop.key} style={styles.deliveryCard} onPress={() => { setSelectedId(stop.primaryOrder.id); setTab('route'); }}>
              <View style={styles.deliveryCardTop}>
                <View style={styles.stopNumber}><Text style={styles.stopNumberText}>{index + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryName}>{stop.customer.name || 'Customer'}</Text>
                  <Text style={styles.deliveryAddress} numberOfLines={2}>{stop.deliveryAddress || 'Address missing'}</Text>
                  {stop.orders.length > 1 && <Text style={styles.groupedOrderText}>{stop.orders.length} orders in one stop</Text>}
                </View>
                <Ionicons name="chevron-forward" size={24} color={palette.primary} />
              </View>
              <View style={styles.deliveryFooter}>
                <Text style={styles.deliveryItems}>{stop.items.map((item) => `${item.quantity} x ${bottleName(item.bottleType)}`).join('  +  ')}</Text>
                <Text style={styles.deliveryStatus}>{trackingStatusName(stop.trackingStatus)}</Text>
              </View>
            </Pressable>
          ))}
          {!activeStops.length && <View style={styles.emptySmall}><Ionicons name="file-tray-outline" size={48} color={palette.muted} /><Text style={styles.emptyTitle}>No assigned deliveries</Text></View>}
        </ScrollView>
      )}

      {tab === 'history' && (
        historyOrder ? (
          <ScrollView style={styles.body} contentContainerStyle={styles.content}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to delivery history" style={styles.historyBack} onPress={() => setHistoryId('')}>
              <Ionicons name="arrow-back" size={22} color={palette.primary} />
              <Text style={styles.historyBackText}>Delivery history</Text>
            </Pressable>
            <Text style={styles.eyebrow}>COMPLETED DELIVERY</Text>
            <Text style={styles.pageTitle}>{customerOf(historyOrder).name || 'Customer'}</Text>
            <Text style={styles.pageIntro}>{formatOrderDate(historyOrder.delivered_at || historyOrder.created_at)}</Text>
            <View style={styles.historyDetail}>
              <Text style={styles.cardLabel}>DELIVERED TO</Text>
              <Text style={styles.historyAddress}>{orderAddress(historyOrder) || 'No address recorded'}</Text>
              <View style={styles.historyStats}>
                <View style={styles.historyStat}><Text style={styles.historyStatValue}>{historyOrder.bottles_dropped_off || 0}</Text><Text style={styles.historyStatLabel}>Full given</Text></View>
                <View style={styles.historyStat}><Text style={styles.historyStatValue}>{historyOrder.bottles_collected || 0}</Text><Text style={styles.historyStatLabel}>Empty taken</Text></View>
              </View>
              {normalizeItems({ ...historyOrder, items: historyOrder.delivered_items?.length ? historyOrder.delivered_items : historyOrder.items }).map((item) => (
                <View key={item.bottleType} style={styles.historyItemRow}><Text style={styles.historyItemName}>{bottleName(item.bottleType)}</Text><Text style={styles.historyItemQuantity}>{item.quantity}</Text></View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} tintColor={palette.primary} />}
          >
            <Text style={styles.eyebrow}>COMPLETED</Text>
            <Text style={styles.pageTitle}>Delivery history</Text>
            <Text style={styles.pageIntro}>{historyLoading ? 'Loading recent deliveries...' : `${historyOrders.length} recent completed deliver${historyOrders.length === 1 ? 'y' : 'ies'}`}</Text>
            {historyLoading && <ActivityIndicator color={palette.primary} style={{ marginVertical: 30 }} />}
            {historyOrders.map((order) => (
              <Pressable key={order.id} style={styles.historyCard} onPress={() => setHistoryId(order.id)}>
                <View style={styles.historyCheck}><Ionicons name="checkmark" size={19} color="#FFFFFF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryName}>{customerOf(order).name || 'Customer'}</Text>
                  <Text style={styles.historyMeta}>{formatOrderDate(order.delivered_at || order.created_at)} · {itemSummary(order)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={21} color={palette.muted} />
              </Pressable>
            ))}
            {!historyLoading && !historyOrders.length && <View style={styles.emptySmall}><Ionicons name="time-outline" size={50} color={palette.muted} /><Text style={styles.emptyTitle}>No history yet</Text></View>}
          </ScrollView>
        )
      )}

      {tab === 'profile' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.profileCard}>
            <Pressable style={styles.avatarWrap} onPress={choosePhoto}>
              {profilePhoto ? <Image source={{ uri: profilePhoto }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{(profileName || 'R').charAt(0).toUpperCase()}</Text>}
              <View style={styles.cameraBadge}><Ionicons name="camera" size={16} color="#FFFFFF" /></View>
            </Pressable>
            <View style={styles.profileSummary}>
              <Text numberOfLines={1} style={styles.profileTitle}>{profileName || admin?.name}</Text>
              <Text numberOfLines={1} style={styles.profileMeta}>Rider · {admin?.email}</Text>
              <View style={styles.availabilityInline}>
                <View style={[styles.availabilityDot, available && styles.availabilityDotOn]} />
                <Text style={[styles.availabilityText, available && styles.availabilityTextOn]}>{available ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
            <Switch
              accessibilityLabel="Change rider availability"
              value={available}
              onValueChange={toggleAvailability}
              trackColor={{ false: palette.border, true: palette.success }}
              thumbColor="#FFFFFF"
            />
          </View>

          {settingsGroup('profile', 'Profile details', 'Name, phone, and profile photo', 'person-outline', (
            <>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput value={profileName} onChangeText={setProfileName} style={styles.input} placeholder="Rider name" placeholderTextColor={palette.muted} />
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput value={profilePhone} onChangeText={setProfilePhone} style={styles.input} placeholder="Phone number" placeholderTextColor={palette.muted} keyboardType="phone-pad" />
              <Pressable
                accessibilityRole="button"
                disabled={profileSaving || profileName.trim().length < 2}
                style={[styles.saveProfileButton, (profileSaving || profileName.trim().length < 2) && styles.disabled]}
                onPress={() => saveProfile()}
              >
                {profileSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                <Text style={styles.saveProfileText}>{profileSaving ? 'Saving profile' : 'Save profile'}</Text>
              </Pressable>
            </>
          ))}

          {settingsGroup('delivery', 'Delivery controls', 'Route layout and pickup workflow', 'cube-outline', (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}><Ionicons name="albums-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Show route header</Text><Text style={styles.settingHelp}>Show Today&apos;s route summary on the main screen</Text></View>
                <Switch
                  accessibilityLabel="Show route header on the main screen"
                  value={showRouteHeader}
                  onValueChange={toggleShowRouteHeader}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}><Ionicons name="checkmark-done-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Pick up the whole route</Text><Text style={styles.settingHelp}>One tap marks every ready stop as picked up</Text></View>
                <Switch
                  accessibilityLabel="Mark all ready deliveries picked up together"
                  value={pickUpAll}
                  onValueChange={togglePickUpAll}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </>
          ), pickUpAll ? 'Bulk pickup' : 'One by one')}

          {settingsGroup('appearance', 'Appearance', 'Theme, text size, and motion', 'color-palette-outline', (
            <>
              <Pressable style={styles.settingRow} onPress={toggleTheme}>
                <View style={styles.settingIcon}><Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>{dark ? 'Use light mode' : 'Use dark mode'}</Text><Text style={styles.settingHelp}>Change how the app looks</Text></View>
                <Ionicons name="chevron-forward" size={21} color={palette.muted} />
              </Pressable>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}><Ionicons name="text-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Compact text</Text><Text style={styles.settingHelp}>Smaller address and headings</Text></View>
                <Switch
                  accessibilityLabel="Use smaller address and heading text"
                  value={compactText}
                  onValueChange={toggleCompactText}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}><Ionicons name="accessibility-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Reduce motion</Text><Text style={styles.settingHelp}>Use shorter, calmer animations</Text></View>
                <Switch
                  accessibilityLabel="Reduce motion"
                  value={reducedMotion}
                  onValueChange={toggleReducedMotion}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </>
          ), dark ? 'Dark' : 'Light')}

          {settingsGroup('alerts', 'Alerts and sound', 'New-order notification behavior', 'notifications-outline', (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}><Ionicons name="notifications-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Order notifications</Text><Text style={styles.settingHelp}>Alert me when work is assigned</Text></View>
                <Switch
                  accessibilityLabel="New order notifications"
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={[styles.settingRow, !notificationsEnabled && styles.disabled]}>
                <View style={styles.settingIcon}><Ionicons name="repeat-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Repeat until answered</Text><Text style={styles.settingHelp}>Every minute until the app opens or pickup is marked</Text></View>
                <Switch
                  accessibilityLabel="Repeat the new order sound until answered"
                  disabled={!notificationsEnabled}
                  value={repeatOrderAlerts}
                  onValueChange={toggleRepeatOrderAlerts}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}><Ionicons name="phone-portrait-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Vibrate</Text><Text style={styles.settingHelp}>Vibrate with the selected sound</Text></View>
                <Switch
                  accessibilityLabel="Vibrate for new orders"
                  disabled={!notificationsEnabled}
                  value={vibrationEnabled}
                  onValueChange={toggleVibration}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Pressable style={styles.settingRow} onPress={openSystemSettings}>
                <View style={styles.settingIcon}><Ionicons name="options-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Android notification settings</Text><Text style={styles.settingHelp}>Permission, lock screen, and volume</Text></View>
                <Ionicons name="open-outline" size={20} color={palette.muted} />
              </Pressable>
              <Text style={styles.sectionHelp}>Choose a sound and tap it to hear a preview.</Text>
              {NOTIFICATION_TONES.map((item) => (
                <Pressable
                  key={item.id}
                  disabled={!notificationsEnabled}
                  style={[styles.toneRow, tone === item.id && styles.toneRowActive, !notificationsEnabled && styles.disabled]}
                  onPress={() => changeTone(item.id)}
                >
                  <View style={[styles.radio, tone === item.id && styles.radioActive]}>{tone === item.id && <View style={styles.radioDot} />}</View>
                  <View style={{ flex: 1 }}><Text style={styles.settingTitle}>{item.label}</Text><Text style={styles.settingHelp}>{item.description}</Text></View>
                  <Ionicons name="volume-medium-outline" size={22} color={palette.primary} />
                </Pressable>
              ))}
            </>
          ), repeatOrderAlerts && notificationsEnabled ? 'Repeating' : pushState === 'registered' ? 'On' : 'Off')}

          {settingsGroup('location', 'Location and maps', 'Data use, GPS, and directions', 'navigate-circle-outline', (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}><Ionicons name="leaf-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Low data mode</Text><Text style={styles.settingHelp}>Share GPS every 60s or 100m</Text></View>
                <Switch
                  accessibilityLabel="Low data location mode"
                  value={locationMode === 'data_saver'}
                  onValueChange={toggleDataSaver}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Pressable style={styles.settingRow} onPress={openBatterySettings}>
                <View style={styles.settingIcon}><Ionicons name="battery-charging-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Keep location running</Text><Text style={styles.settingHelp}>Open Android battery settings</Text></View>
                <Ionicons name="open-outline" size={20} color={palette.muted} />
              </Pressable>
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}><Ionicons name="map-outline" size={22} color={palette.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Directions app</Text><Text style={styles.settingHelp}>Use the default maps app on this phone</Text></View>
                <Text style={styles.settingValue}>Phone default</Text>
              </View>
            </>
          ), locationMode === 'data_saver' ? 'Low data' : 'Balanced')}

          {settingsGroup('help', 'Help', 'Company support and app information', 'help-buoy-outline', (
            <Pressable
              disabled={!config?.businessPhone}
              style={[styles.settingRow, !config?.businessPhone && styles.disabled]}
              onPress={() => config?.businessPhone && Linking.openURL(`tel:${config.businessPhone}`)}
            >
              <View style={styles.settingIcon}><Ionicons name="call-outline" size={22} color={palette.primary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.settingTitle}>Call the company</Text><Text style={styles.settingHelp}>{config?.businessPhone || 'Company phone is not configured'}</Text></View>
              <Ionicons name="call" size={20} color={palette.muted} />
            </Pressable>
          ))}

          <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()}>
            <Ionicons name="log-out-outline" size={23} color={palette.danger} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
          <Text style={styles.versionText}>Himaliya Rider 1.4.2 · {config?.businessName || 'Himaliya Spring Water'}</Text>
        </ScrollView>
      )}

      <View style={styles.tabs} onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}>
        {tabSlotWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabIndicator,
              {
                width: tabSlotWidth,
                transform: [{ translateX: tabIndicatorTranslate }],
              },
            ]}
          />
        )}
        {([
          ['route', 'navigate-outline', 'Route'],
          ['orders', 'cube-outline', 'Orders'],
          ['history', 'time-outline', 'History'],
          ['profile', 'person-circle-outline', 'Profile'],
        ] as const).map(([value, icon, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            style={styles.tab}
            onPress={() => {
              if (value !== 'history' || (value === 'history' && tab === 'history')) setHistoryId('');
              setTab(value);
            }}
          >
            <View style={styles.tabIcon}>
              <Ionicons name={icon} size={23} color={tab === value ? '#FFFFFF' : palette.muted} />
              {value === 'orders' && activeStops.length > 0 && <View style={styles.orderBadge}><Text style={styles.orderBadgeText}>{Math.min(99, activeStops.length)}</Text></View>}
            </View>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Modal transparent visible={confirming} animationType="slide" onRequestClose={() => setConfirming(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Finish delivery</Text>
            <Text style={styles.modalHelp}>Check what you gave, then count the empty bottles you took back.</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.cardLabel}>FULL BOTTLES DELIVERED</Text>
              {selectedStop && selectedStop.items.map((item) => (
                <Counter
                  key={item.bottleType}
                  label={bottleName(item.bottleType)}
                  value={deliveryCounts[item.bottleType] || 0}
                  max={item.quantity}
                  onChange={(value) => setDeliveryCounts((current) => ({ ...current, [item.bottleType]: value }))}
                  styles={styles}
                  palette={palette}
                />
              ))}
              <Text style={[styles.cardLabel, { marginTop: 16 }]}>EMPTY BOTTLES TAKEN BACK</Text>
              <Counter label="All empty bottles" value={collected} onChange={setCollected} styles={styles} palette={palette} />
            </ScrollView>
            <View style={styles.deliveryTotals}><Text style={styles.deliveryTotalsLabel}>Full bottles confirmed</Text><Text style={styles.deliveryTotalsValue}>{deliveredTotal}</Text></View>
            <Pressable
              disabled={saving || deliveredTotal < 1}
              style={[styles.finishButton, (saving || deliveredTotal < 1) && styles.disabled]}
               onPress={() => updateStatus('delivered', collected, selectedStop ? selectedStop.items.map((item) => ({ bottleType: item.bottleType, quantity: deliveryCounts[item.bottleType] || 0 })).filter((item) => item.quantity > 0) : [])}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle" size={25} color="#FFFFFF" />}
              <Text style={styles.finishButtonText}>{saving ? 'Saving...' : 'Confirm delivered'}</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setConfirming(false)}><Text style={styles.cancelText}>Not yet</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={celebrating} animationType="fade">
        <View style={styles.celebrationScrim}>
          <Animated.View style={[styles.celebrationCard, { transform: [{ scale: celebrationScale }] }]}>
            <View style={styles.celebrationIcon}><Ionicons name="checkmark" size={54} color="#FFFFFF" /></View>
            <Text style={styles.celebrationTitle}>Delivered!</Text>
            <Text style={styles.celebrationText}>Great work. Admin has been notified.</Text>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Counter({ label, value, max, onChange, styles, palette }: {
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: Record<string, string>;
}) {
  return (
    <View style={styles.counter}>
      <View style={{ flex: 1 }}><Text style={styles.counterLabel}>{label}</Text>{max !== undefined && <Text style={styles.counterMax}>Ordered: {max}</Text>}</View>
      <View style={styles.counterControl}>
        <Pressable accessibilityLabel={`Reduce ${label}`} style={styles.counterButton} onPress={() => onChange(Math.max(0, value - 1))}><Ionicons name="remove" size={25} color={palette.primary} /></Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable accessibilityLabel={`Increase ${label}`} style={styles.counterButton} onPress={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}><Ionicons name="add" size={25} color={palette.primary} /></Pressable>
      </View>
    </View>
  );
}

function makeStyles(c: Record<string, string>, compactText = false) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, backgroundColor: c.bg },
    loadingMark: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderRadius: 22, backgroundColor: c.primary },
    loadingTitle: { color: c.ink, fontSize: 21, fontWeight: '900' },
    muted: { color: c.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    header: { minHeight: 76, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    brandMark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: c.primary },
    headerAvatar: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden', backgroundColor: c.hero },
    headerAvatarImage: { width: 46, height: 46 },
    headerAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
    headerCopy: { flex: 1, minWidth: 0 },
    headerEyebrow: { color: c.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    eyebrow: { color: c.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
    headerTitle: { color: c.ink, fontSize: 18, fontWeight: '900', marginTop: 1 },
    availabilityControl: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    availabilityDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: c.muted },
    availabilityDotOn: { backgroundColor: c.success },
    availabilityText: { color: c.muted, fontSize: 10, fontWeight: '900' },
    availabilityTextOn: { color: c.success },
    offlineBanner: { minHeight: 42, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: `${c.warning}1A` },
    offlineText: { flex: 1, color: c.warning, fontSize: 12, fontWeight: '800' },
    syncBanner: { minHeight: 38, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: `${c.primary}14` },
    syncText: { color: c.primary, fontSize: 12, fontWeight: '800' },
    errorBanner: { minHeight: 46, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${c.danger}16`, borderBottomWidth: 1, borderBottomColor: `${c.danger}35` },
    errorText: { flex: 1, color: c.danger, fontSize: 12, fontWeight: '800' },
    body: { flex: 1 },
    content: { padding: 13, paddingBottom: 94, gap: 11 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pageTitle: { color: c.ink, fontSize: compactText ? 23 : 27, fontWeight: '900', letterSpacing: -.7, marginTop: 3 },
    pageIntro: { color: c.muted, fontSize: 13, marginTop: -6, marginBottom: 5 },
    routeHero: { minHeight: 118, padding: 14, borderRadius: 20, overflow: 'hidden', backgroundColor: c.hero, shadowColor: c.shadow, shadowOpacity: .14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
    routeHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    routeHeroEyebrow: { color: c.heroAccent, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    routeHeroTitle: { color: c.heroText, fontSize: 22, fontWeight: '900', letterSpacing: -.55, marginTop: 1 },
    livePill: { minHeight: 30, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,.1)' },
    liveDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: c.heroAccent },
    livePillText: { color: c.heroText, fontSize: 10, fontWeight: '900' },
    routeStats: { flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,.18)' },
    routeStat: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 5 },
    routeStatValue: { color: c.heroText, fontSize: 15, fontWeight: '900' },
    routeStatLabel: { color: c.heroMuted, fontSize: 8, fontWeight: '800' },
    routeStatDivider: { width: StyleSheet.hairlineWidth, height: 21, marginHorizontal: 8, backgroundColor: 'rgba(255,255,255,.18)' },
    gpsPill: { minHeight: 35, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 99, backgroundColor: c.surfaceRaised },
    gpsPillLive: { backgroundColor: `${c.success}18` },
    gpsDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: c.success },
    gpsDotError: { backgroundColor: c.danger },
    gpsText: { color: c.ink, fontSize: 11, fontWeight: '900' },
    stopSwitcher: { gap: 8, paddingVertical: 2 },
    stopChip: { width: 184, minHeight: 59, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    stopChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    stopChipNumber: { width: 34, height: 34, lineHeight: 34, textAlign: 'center', color: c.primary, fontWeight: '900', borderRadius: 11, backgroundColor: c.surfaceRaised },
    stopChipNumberActive: { color: c.primary, backgroundColor: '#FFFFFF' },
    stopChipName: { maxWidth: 120, color: c.ink, fontSize: 13, fontWeight: '900' },
    stopChipNameActive: { color: '#FFFFFF' },
    stopChipArea: { maxWidth: 120, color: c.muted, fontSize: 10, marginTop: 2 },
    empty: { minHeight: 430, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30 },
    emptySmall: { minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyIcon: { width: 94, height: 94, alignItems: 'center', justifyContent: 'center', borderRadius: 32 },
    emptyTitle: { color: c.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
    orderHeaderCard: { padding: 15, borderRadius: 19, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: c.shadow, shadowOpacity: .08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    missionCard: { padding: 12, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: c.shadow, shadowOpacity: .08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
    missionCardRepeat: { backgroundColor: c.bg === '#06171D' ? '#251A07' : '#FFF9EB', borderColor: '#F59E0B', borderWidth: 1.5, shadowColor: '#F59E0B', shadowOpacity: .15 },
    missionCardSelected: { borderColor: c.primary, borderWidth: 2 },
    missionTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    missionCopy: { flex: 1, minWidth: 0 },
    missionLabel: { color: c.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    orderHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stopNumber: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.primary },
    stopNumberRepeat: { backgroundColor: '#D97706' },
    stopNumberText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    orderCustomer: { color: c.ink, fontSize: compactText ? 15 : 17, fontWeight: '900', letterSpacing: -.2, marginTop: 1 },
    orderItemsSummary: { color: c.muted, fontSize: 10, fontWeight: '700', marginTop: 1 },
    repeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: c.bg === '#06171D' ? '#422800' : '#FEF3C7', alignSelf: 'flex-start' },
    repeatBadgeText: { color: c.bg === '#06171D' ? '#FBBF24' : '#B45309', fontSize: 9, fontWeight: '900' },
    subOrderContainer: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: c.bg === '#06171D' ? '#1D1305' : '#FFF3D6', borderWidth: 1, borderColor: '#FDE68A', gap: 6 },
    subOrderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    subOrderText: { color: c.ink, fontSize: 12, fontWeight: '800', flex: 1 },
    iconActionWa: { backgroundColor: '#E8FADF', borderColor: '#25D366' },
    statusPill: { maxWidth: 86, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, backgroundColor: `${c.primary}17` },
    statusDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: c.primary },
    statusPillText: { color: c.primaryDark, fontSize: 10, fontWeight: '900' },
    progressWrap: { marginTop: 18, paddingHorizontal: 2 },
    progressTrack: { height: 6, marginHorizontal: 5, position: 'relative', borderRadius: 99, backgroundColor: c.border },
    progressFill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 99, backgroundColor: c.success },
    progressPoint: { position: 'absolute', top: -4, width: 14, height: 14, marginLeft: -7, borderRadius: 9, borderWidth: 3, borderColor: c.border, backgroundColor: c.surface },
    progressPointDone: { borderColor: c.success, backgroundColor: c.success },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    progressLabel: { width: 60, color: c.muted, fontSize: 9, fontWeight: '700', textAlign: 'center' },
    progressLabelDone: { color: c.success, fontWeight: '900' },
    addressCard: { padding: 17, borderRadius: 21, backgroundColor: c.surface, borderWidth: 2, borderColor: `${c.primary}55` },
    deliverSection: { marginTop: 13, gap: 6 },
    addressBlock: { minHeight: 52, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, backgroundColor: c.surfaceRaised },
    addressPin: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.surface },
    addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    addressLabel: { color: c.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    addressText: { flex: 1, color: c.ink, fontSize: compactText ? 14 : 16, lineHeight: compactText ? 19 : 21, fontWeight: '900' },
    addressHelp: { color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 7 },
    quickActions: { flexDirection: 'row', gap: 7 },
    iconAction: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    bottleSection: { marginTop: 11, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    bottleSectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemsTotal: { color: c.primary, fontSize: 10, fontWeight: '900' },
    bottleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
    bottleTile: { minWidth: 74, minHeight: 42, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: `${c.primary}28`, backgroundColor: `${c.primary}10` },
    bottleTileSmall: { borderColor: `${c.success}38`, backgroundColor: `${c.success}12` },
    bottleTileMedium: { borderColor: `${c.heroAccent}40`, backgroundColor: `${c.heroAccent}12` },
    bottleTileLarge: { borderColor: `${c.primary}42`, backgroundColor: `${c.primary}14` },
    bottleTileGallon: { borderColor: `${c.primaryDark}46`, backgroundColor: `${c.primaryDark}16` },
    bottlesCard: { padding: 15, gap: 8, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    cardLabel: { color: c.muted, fontSize: 10, fontWeight: '900', letterSpacing: .9 },
    bottleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    bottleCode: { color: c.ink, fontSize: 13, fontWeight: '900' },
    bottleQuantity: { color: c.primary, fontSize: 16, fontWeight: '900', textAlign: 'right' },
    noteCard: { padding: 14, flexDirection: 'row', gap: 10, borderRadius: 16, backgroundColor: `${c.warning}12`, borderWidth: 1, borderColor: `${c.warning}35` },
    noteText: { color: c.ink, fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 4 },
    actionCard: { marginTop: 1 },
    actionDock: { padding: 8, borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: c.shadow, shadowOpacity: .1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
    actionRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 9 },
    goOnlineHint: { color: c.warning, fontSize: 12, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
    primaryAction: { minWidth: 0, minHeight: 56, flex: 1, marginLeft: 'auto', overflow: 'hidden', borderRadius: 999, shadowColor: c.primary, shadowOpacity: .24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
    primaryActionGradient: { minHeight: 56, paddingLeft: 16, paddingRight: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, borderRadius: 999 },
    primaryActionOrb: { width: 46, height: 46, flex: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: 'rgba(3,18,29,.88)' },
    primaryActionText: { flex: 1, color: '#062238', fontSize: compactText ? 14 : 15, fontWeight: '900' },
    disabled: { opacity: .5 },
    deliveryCard: { padding: 15, gap: 13, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    deliveryCardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    deliveryName: { color: c.ink, fontSize: compactText ? 14 : 16, fontWeight: '900' },
    deliveryAddress: { color: c.ink, fontSize: compactText ? 11 : 13, lineHeight: compactText ? 16 : 18, fontWeight: '700', marginTop: 4 },
    groupedOrderText: { color: c.primary, fontSize: 10, fontWeight: '900', marginTop: 5 },
    deliveryFooter: { paddingTop: 11, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    deliveryItems: { flex: 1, color: c.muted, fontSize: 11, fontWeight: '700' },
    deliveryStatus: { color: c.primary, fontSize: 10, fontWeight: '900' },
    historyCard: { minHeight: 70, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    historyBack: { minHeight: 48, alignSelf: 'flex-start', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: c.surface },
    historyBackText: { color: c.primary, fontSize: 14, fontWeight: '900' },
    historyCheck: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.success },
    historyMeta: { color: c.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
    historyDetail: { padding: 17, borderRadius: 18, backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border },
    historyTitle: { color: c.ink, fontSize: 22, fontWeight: '900', marginTop: 5 },
    historyAddress: { color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
    historyStats: { flexDirection: 'row', gap: 10, marginVertical: 14 },
    historyStat: { flex: 1, padding: 13, borderRadius: 14, backgroundColor: c.surface },
    historyStatValue: { color: c.ink, fontSize: 25, fontWeight: '900' },
    historyStatLabel: { color: c.muted, fontSize: 10, fontWeight: '800', marginTop: 2 },
    historyItemRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    historyItemName: { flex: 1, color: c.ink, fontSize: 13, fontWeight: '800' },
    historyItemQuantity: { color: c.primary, fontSize: 17, fontWeight: '900' },
    profileCard: { minHeight: 94, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    avatarWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: c.primary },
    avatarImage: { width: 64, height: 64, borderRadius: 21 },
    avatarText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
    cameraBadge: { position: 'absolute', right: -4, bottom: -4, width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: c.primaryDark, borderWidth: 3, borderColor: c.surface },
    profileSummary: { flex: 1, minWidth: 0 },
    profileTitle: { color: c.ink, fontSize: compactText ? 18 : 20, fontWeight: '900' },
    profileMeta: { color: c.muted, fontSize: 11, marginTop: 3 },
    availabilityInline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    settingsGroup: { overflow: 'hidden', borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    settingsGroupHeader: { minHeight: 66, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
    settingsGroupIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: c.surfaceRaised },
    settingsGroupCopy: { flex: 1, minWidth: 0 },
    settingsGroupTitle: { color: c.ink, fontSize: 14, fontWeight: '900' },
    settingsGroupHelp: { color: c.muted, fontSize: 10, marginTop: 2 },
    settingsGroupStatus: { maxWidth: 72, color: c.primary, fontSize: 9, fontWeight: '900', textAlign: 'right' },
    settingsSection: { paddingHorizontal: 13, paddingBottom: 13, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    pressed: { opacity: .72 },
    sectionTitle: { color: c.ink, fontSize: 17, fontWeight: '900' },
    sectionHelp: { color: c.muted, fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 3 },
    sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pushState: { color: c.primary, fontSize: 10, fontWeight: '900' },
    inputLabel: { color: c.muted, fontSize: 11, fontWeight: '900', marginTop: 3 },
    input: { minHeight: 49, paddingHorizontal: 13, color: c.ink, fontSize: 15, fontWeight: '700', borderRadius: 13, backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border },
    saveProfileButton: { minHeight: 48, marginTop: 5, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, backgroundColor: c.primary },
    saveProfileText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    settingRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    settingIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.surfaceRaised },
    settingTitle: { color: c.ink, fontSize: 14, fontWeight: '900' },
    settingHelp: { color: c.muted, fontSize: 11, marginTop: 2 },
    settingValue: { maxWidth: 94, color: c.primary, fontSize: 11, fontWeight: '900', textAlign: 'right' },
    toneRow: { minHeight: 60, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, borderWidth: 1, borderColor: c.border },
    toneRowActive: { borderColor: c.primary, backgroundColor: `${c.primary}0D` },
    radio: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 2, borderColor: c.border },
    radioActive: { borderColor: c.primary },
    radioDot: { width: 11, height: 11, borderRadius: 7, backgroundColor: c.primary },
    signOutButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, backgroundColor: `${c.danger}12`, borderWidth: 1, borderColor: `${c.danger}35` },
    signOutText: { color: c.danger, fontSize: 15, fontWeight: '900' },
    versionText: { color: c.muted, fontSize: 10, textAlign: 'center', marginTop: 4 },
    tabs: { minHeight: 56, padding: 4, marginHorizontal: 20, marginBottom: 8, position: 'relative', flexDirection: 'row', alignItems: 'center', borderRadius: 28, backgroundColor: c.tab, borderWidth: 1, borderColor: c.border, shadowColor: c.shadow, shadowOpacity: .18, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
    tabIndicator: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 24, backgroundColor: c.primary },
    tab: { minHeight: 48, flex: 1, zIndex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },
    tabIcon: { width: 40, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
    tabIconActive: { backgroundColor: 'transparent' },
    tabText: { color: c.muted, fontSize: 9, fontWeight: '800' },
    tabTextActive: { color: '#FFFFFF' },
    orderBadge: { position: 'absolute', top: -5, right: -7, minWidth: 19, height: 19, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.danger, borderWidth: 2, borderColor: c.tab },
    orderBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
    modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
    modalCard: { maxHeight: '90%', padding: 20, paddingBottom: 28, gap: 11, backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    modalHandle: { width: 42, height: 5, alignSelf: 'center', marginBottom: 2, borderRadius: 99, backgroundColor: c.border },
    modalTitle: { color: c.ink, fontSize: 25, fontWeight: '900' },
    modalHelp: { color: c.muted, fontSize: 13, lineHeight: 18 },
    modalScroll: { maxHeight: 405 },
    counter: { minHeight: 70, padding: 10, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, backgroundColor: c.surfaceRaised },
    counterLabel: { color: c.ink, fontSize: 14, fontWeight: '900' },
    counterMax: { color: c.muted, fontSize: 10, marginTop: 2 },
    counterControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    counterButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: c.surface },
    counterValue: { minWidth: 28, color: c.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' },
    deliveryTotals: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, backgroundColor: `${c.primary}12` },
    deliveryTotalsLabel: { color: c.ink, fontSize: 13, fontWeight: '800' },
    deliveryTotalsValue: { color: c.primary, fontSize: 23, fontWeight: '900' },
    finishButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, backgroundColor: c.success },
    finishButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
    cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    cancelText: { color: c.muted, fontWeight: '900' },
    celebrationScrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: c.overlay },
    celebrationCard: { width: '100%', maxWidth: 330, minHeight: 270, alignItems: 'center', justifyContent: 'center', padding: 28, borderRadius: 28, backgroundColor: c.surface },
    celebrationIcon: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 36, backgroundColor: c.success },
    celebrationTitle: { color: c.ink, fontSize: 32, fontWeight: '900', marginTop: 19 },
    celebrationText: { color: c.muted, fontSize: 14, textAlign: 'center', marginTop: 6 },
  });
}
