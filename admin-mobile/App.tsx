import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { configured, supabase } from './src/lib/supabase';
import { colors } from './src/theme';
import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CustomersScreen } from './src/screens/CustomersScreen';
import { CustomerDetailScreen } from './src/screens/CustomerDetailScreen';
import { SalesScreen } from './src/screens/SalesScreen';
import { AnalyticsScreen, InvoicesScreen, MessagesScreen, NotificationsScreen, OrdersScreen } from './src/screens/OperationsScreens';
import { UsersScreen } from './src/screens/UsersScreen';
import { UserProfileScreen } from './src/screens/UserProfileScreen';
import { InvoiceDetailScreen } from './src/screens/InvoiceDetailScreen';
import { ProfileScreen, SettingsScreen } from './src/screens/SettingsScreens';

const Drawer = createDrawerNavigator(); const Root = createNativeStackNavigator(); const Admin = createNativeStackNavigator();
const screens = [
  ['Dashboard', DashboardScreen, 'grid-outline'], ['Customers', CustomersScreen, 'people-outline'], ['Daily Sales', SalesScreen, 'water-outline'],
  ['Customer Orders', OrdersScreen, 'cube-outline'], ['Invoices', InvoicesScreen, 'document-text-outline'], ['Analytics', AnalyticsScreen, 'stats-chart-outline'],
  ['All Users', UsersScreen, 'shield-checkmark-outline'], ['Notifications', NotificationsScreen, 'notifications-outline'], ['Messages', MessagesScreen, 'chatbubble-ellipses-outline'],
  ['Settings', SettingsScreen, 'settings-outline'], ['Profile', ProfileScreen, 'person-circle-outline'],
] as const;

function DrawerContent(props: DrawerContentComponentProps) {
  const { admin } = useApp(); const signOut = async () => { await supabase.auth.signOut(); props.navigation.closeDrawer(); props.navigation.getParent()?.getParent()?.navigate('Landing' as never); };
  return <View style={styles.drawer}><View style={styles.brand}><View style={styles.mark}><Text style={styles.markText}>HS</Text></View><View style={{ flex: 1 }}><Text style={styles.brandName}>Himaliya Spring</Text><Text style={styles.brandSub}>Water administration</Text></View></View><DrawerContentScrollView {...props} contentContainerStyle={styles.drawerScroll}><DrawerItemList {...props} /></DrawerContentScrollView><View style={styles.account}><Pressable accessibilityLabel="View profile" style={styles.user} onPress={() => props.navigation.navigate('Profile')}><View style={styles.userAvatar}><Text style={styles.userAvatarText}>{(admin?.name || 'A').charAt(0)}</Text></View><View style={{ flex: 1 }}><Text style={styles.userName}>{admin?.name}</Text><Text style={styles.userRole}>{admin?.role} · View profile</Text></View><Ionicons name="chevron-forward" color="#8FA4C9" size={18} /></Pressable><Pressable accessibilityLabel="Sign out" style={styles.signOut} onPress={signOut}><Ionicons name="log-out-outline" color="#FF9A9A" size={20} /><Text style={styles.signOutText}>Sign out</Text></Pressable></View></View>;
}

function MainDrawer() {
  return <Drawer.Navigator drawerContent={p => <DrawerContent {...p} />} screenOptions={({ route }) => ({ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.ink, headerTitleStyle: { fontWeight: '800' }, drawerStyle: { backgroundColor: colors.navy, width: 300 }, drawerActiveBackgroundColor: '#1A3A76', drawerActiveTintColor: colors.white, drawerInactiveTintColor: '#BFCBE2', drawerLabelStyle: { fontWeight: '600', marginLeft: -10 }, drawerItemStyle: { borderRadius: 12, minHeight: 48 }, drawerIcon: ({ color, size }) => { const item = screens.find(([name]) => name === route.name); return <Ionicons name={(item?.[2] || 'ellipse-outline') as any} color={color} size={size} />; } })}>{screens.map(([name, component]) => <Drawer.Screen key={name} name={name} component={component} />)}</Drawer.Navigator>;
}
function AdminNavigator() { return <Admin.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}><Admin.Screen name="Drawer" component={MainDrawer} /><Admin.Screen name="CustomerDetail" component={CustomerDetailScreen} /><Admin.Screen name="InvoiceDetail" component={InvoiceDetailScreen} /><Admin.Screen name="UserProfile" component={UserProfileScreen} /></Admin.Navigator>; }
function AdminGate(props: any) { const { session, admin } = useApp(); return session && admin ? <AdminNavigator /> : <LoginScreen {...props} />; }

function RootApp() {
  const app = useApp();
  const { setLoading, setSession, setAdmin, session, admin, refresh } = app;
  useEffect(() => { let active = true; const initialize = async () => { if (!configured) { setLoading(false); return; } const { data } = await supabase.auth.getSession(); if (!active) return; setSession(data.session); if (data.session) { const { data: profile } = await supabase.from('admin_profiles').select('*').eq('auth_user_id', data.session.user.id).eq('active', true).maybeSingle(); if (!profile) await supabase.auth.signOut(); else setAdmin(profile); } setLoading(false); }; initialize(); const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); if (!nextSession) { setAdmin(null); setLoading(false); return; } setTimeout(async () => { const { data: profile } = await supabase.from('admin_profiles').select('*').eq('auth_user_id', nextSession.user.id).eq('active', true).maybeSingle(); if (!profile) await supabase.auth.signOut(); else setAdmin(profile); setLoading(false); }, 0); }); return () => { active = false; listener.subscription.unsubscribe(); }; }, [setAdmin, setLoading, setSession]);
  useEffect(() => { if (session && admin) refresh().catch(() => {}); }, [session, admin, refresh]);
  if (app.loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Preparing your water operations...</Text></View>;
  return <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }}><Root.Navigator initialRouteName="Landing" screenOptions={{ headerShown: false, animation: 'fade' }}><Root.Screen name="Landing" component={LandingScreen} /><Root.Screen name="Login" component={LoginScreen} /><Root.Screen name="Admin" component={AdminGate} /></Root.Navigator></NavigationContainer>;
}
export default function App() { return <SafeAreaProvider><AppProvider><StatusBar style="dark" /><RootApp /></AppProvider></SafeAreaProvider>; }
const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 14 }, loadingText: { color: colors.muted }, drawer: { flex: 1, backgroundColor: colors.navy, paddingTop: 48 }, brand: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12, paddingBottom: 18 }, mark: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, markText: { color: colors.white, fontWeight: '900' }, brandName: { color: colors.white, fontWeight: '800', fontSize: 16 }, brandSub: { color: '#8FA4C9', fontSize: 12, marginTop: 2 }, drawerScroll: { paddingTop: 6 }, account: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#26395E', padding: 14 }, user: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 }, userAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#1B3972', alignItems: 'center', justifyContent: 'center' }, userAvatarText: { color: colors.white, fontWeight: '900' }, userName: { color: colors.white, fontWeight: '700' }, userRole: { color: '#8FA4C9', fontSize: 11, marginTop: 2 }, signOut: { minHeight: 48, borderRadius: 13, backgroundColor: 'rgba(235,87,87,.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 7 }, signOutText: { color: '#FF9A9A', fontWeight: '800' } });
