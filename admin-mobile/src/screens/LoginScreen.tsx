import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { configured, message, supabase } from '../lib/supabase';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | ''>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy;

  const signIn = async () => {
    if (!email.trim() || !password) return setError('Enter your staff email and password.');
    if (!configured) return setError('The staff app is not connected. Ask the administrator for help.');
    setBusy(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      const { data: profile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .eq('active', true)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        await supabase.auth.signOut();
        throw new Error('This account is not allowed to use the staff app.');
      }
      navigation.replace('Admin');
    } catch (signInError) {
      setError(message(signInError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={['#062C3A', '#087B98', '#2CB5C8']} style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="water" size={34} color="#087F9D" />
              </View>
              <Text style={styles.brandTitle}>Himaliya Spring Water</Text>
              <Text style={styles.brandSub}>One secure sign in for administrators and riders</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.staffPill}>
                <Ionicons name="people" size={15} color="#087F9D" />
                <Text style={styles.staffPillText}>STAFF PORTAL</Text>
              </View>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.copy}>Sign in to see today&apos;s work.</Text>

              {error ? (
                <View accessibilityLiveRegion="assertive" style={styles.alert}>
                  <Ionicons name="alert-circle" color={colors.danger} size={20} />
                  <Text style={styles.alertText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={[styles.inputShell, focused === 'email' && styles.inputShellFocused]}>
                <Ionicons name="mail-outline" size={20} color={focused === 'email' ? '#087F9D' : '#69828A'} />
                <TextInput
                  accessibilityLabel="Email address"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  placeholder="name@company.com"
                  placeholderTextColor="#8DA0A5"
                  returnKeyType="next"
                />
              </View>

              <Text style={styles.label}>PASSWORD</Text>
              <View style={[styles.inputShell, focused === 'password' && styles.inputShellFocused]}>
                <Ionicons name="lock-closed-outline" size={20} color={focused === 'password' ? '#087F9D' : '#69828A'} />
                <TextInput
                  ref={passwordRef}
                  accessibilityLabel="Password"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  onSubmitEditing={signIn}
                  style={styles.input}
                  secureTextEntry={!passwordVisible}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  placeholderTextColor="#8DA0A5"
                  returnKeyType="go"
                />
                <Pressable
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  style={styles.eyeButton}
                  onPress={() => setPasswordVisible((value) => !value)}
                >
                  <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color="#526C74" />
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.signInButton,
                  !canSubmit && styles.signInButtonDisabled,
                  pressed && canSubmit && styles.signInButtonPressed,
                ]}
                onPress={signIn}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="arrow-forward-circle" size={24} color="#FFFFFF" />}
                <Text style={styles.signInText}>{busy ? 'Signing in...' : 'Sign in'}</Text>
              </Pressable>

              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#168D63" />
                <Text style={styles.securityText}>Your role is detected automatically after sign in.</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  brand: { alignItems: 'center', marginBottom: 24 },
  logo: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    shadowColor: '#001B25',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  brandTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', letterSpacing: -0.4 },
  brandSub: { maxWidth: 310, color: '#C9EDF2', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    shadowColor: '#001B25',
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  staffPill: {
    minHeight: 30,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    backgroundColor: '#E7F5F7',
  },
  staffPillText: { color: '#087F9D', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: '#082A36', fontSize: 28, fontWeight: '900', letterSpacing: -0.7, marginTop: 13 },
  copy: { color: '#607B84', fontSize: 13, marginTop: 4, marginBottom: 19 },
  alert: { padding: 11, flexDirection: 'row', gap: 8, borderRadius: 13, backgroundColor: '#FFF0EC', marginBottom: 15 },
  alertText: { flex: 1, color: '#9D3E2E', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  label: { color: '#526C74', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  inputShell: {
    minHeight: 54,
    paddingLeft: 14,
    paddingRight: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#D6E3E6',
    backgroundColor: '#F5F8F9',
    marginBottom: 13,
  },
  inputShellFocused: { borderColor: '#20A4BE', backgroundColor: '#FFFFFF' },
  input: { flex: 1, minHeight: 51, color: '#082A36', fontSize: 15, fontWeight: '700' },
  eyeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  signInButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 16,
    backgroundColor: '#087F9D',
    marginTop: 8,
  },
  signInButtonPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
  signInButtonDisabled: { opacity: 0.45 },
  signInText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 15 },
  securityText: { color: '#607B84', fontSize: 11, fontWeight: '700' },
});
