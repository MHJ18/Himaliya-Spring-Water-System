import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import { configured, message, supabase } from '../lib/supabase';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const signIn = async () => {
    if (!email.trim() || !password) return setError('Enter your admin email and password.');
    if (!configured) return setError('Add the Supabase URL and publishable key to admin-mobile/.env first.');
    setBusy(true); setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (authError) throw authError;
      const { data: profile, error: profileError } = await supabase.from('admin_profiles').select('*').eq('auth_user_id', data.user.id).eq('active', true).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) { await supabase.auth.signOut(); throw new Error('This account is not allowed to use the admin app.'); }
      navigation.replace('Admin');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return <LinearGradient colors={[colors.navy, '#123875', colors.primary]} style={styles.root}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
      <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>HS</Text></View><View><Text style={styles.brandTitle}>Himaliya Spring Water</Text><Text style={styles.brandSub}>Admin mobile</Text></View></View>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name="water" size={28} color={colors.primary} /></View>
        <Text style={styles.title}>Welcome back</Text><Text style={styles.copy}>Manage deliveries across Sialkot Cantt.</Text>
        {error ? <View accessibilityLiveRegion="assertive" style={styles.alert}><Ionicons name="alert-circle" color={colors.danger} size={20} /><Text style={styles.alertText}>{error}</Text></View> : null}
        <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="admin@himaliya.com" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="Enter password" onSubmitEditing={signIn} />
        <Button label="Sign in to dashboard" onPress={signIn} icon="arrow-forward" loading={busy} />
        <Text style={styles.note}>Only active administrator accounts can sign in.</Text>
      </View>
    </KeyboardAvoidingView>
  </LinearGradient>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, center: { flex: 1, justifyContent: 'center', padding: spacing.lg }, brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.lg },
  logo: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, logoText: { color: colors.primary, fontWeight: '900', fontSize: 18 },
  brandTitle: { color: colors.white, fontSize: 17, fontWeight: '800' }, brandSub: { color: '#BFD5FB', fontSize: 13, marginTop: 2 },
  card: { borderRadius: 26, padding: spacing.lg, backgroundColor: colors.white }, icon: { width: 54, height: 54, borderRadius: radius.lg, backgroundColor: '#EAF3FF', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800' }, copy: { color: colors.muted, marginTop: 5, marginBottom: spacing.lg }, alert: { flexDirection: 'row', gap: 8, borderRadius: radius.md, padding: 12, backgroundColor: '#FFF0F0', marginBottom: spacing.md }, alertText: { color: '#9D2727', flex: 1, lineHeight: 19 }, note: { color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
});
