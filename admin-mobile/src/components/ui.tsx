import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing } from '../theme';

export function Screen({ children, refreshing, onRefresh }: React.PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void }>) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, damping: 18, stiffness: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, translate]);
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.screen}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
      <Animated.View style={{ opacity, transform: [{ translateY: translate }] }}>{children}</Animated.View>
    </ScrollView>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={s.heading}><Text style={s.h1}>{title}</Text>{subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}</View>;
}

export function Card({ children, title, action }: React.PropsWithChildren<{ title?: string; action?: React.ReactNode }>) {
  return <View style={s.card}>{title ? <View style={s.cardHead}><Text style={s.cardTitle}>{title}</Text>{action}</View> : null}{children}</View>;
}

export function Stat({ icon, label, value, tone = colors.primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; tone?: string }) {
  return <View style={s.stat}><View style={[s.statIcon, { backgroundColor: `${tone}18` }]}><Ionicons name={icon} color={tone} size={22} /></View><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>;
}

export function Field(props: React.ComponentProps<typeof TextInput> & { label: string; error?: string }) {
  const { label, error, style, ...inputProps } = props;
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput placeholderTextColor="#9AA5B7" style={[s.input, error && s.inputError, style]} {...inputProps} />{error ? <Text style={s.error}>{error}</Text> : null}</View>;
}

export function Button({ label, onPress, icon, tone = 'primary', disabled, loading, compact }: {
  label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; tone?: 'primary' | 'secondary' | 'danger' | 'success'; disabled?: boolean; loading?: boolean; compact?: boolean;
}) {
  const background = tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.surface;
  const foreground = tone === 'secondary' ? colors.ink : colors.white;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => [s.button, compact && s.buttonCompact, { backgroundColor: background }, tone === 'secondary' && s.buttonSecondary, (disabled || loading) && s.disabled, pressed && s.pressed]}>
    {loading ? <ActivityIndicator color={foreground} /> : <>{icon ? <Ionicons name={icon} size={19} color={foreground} /> : null}<Text style={[s.buttonText, { color: foreground }]}>{label}</Text></>}
  </Pressable>;
}

export function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const map = { default: colors.primary, success: colors.success, warning: '#A86B00', danger: colors.danger };
  return <View style={[s.badge, { backgroundColor: `${map[tone]}16` }]}><Text style={[s.badgeText, { color: map[tone] }]}>{label}</Text></View>;
}

export function Empty({ icon = 'water-outline', title, detail }: { icon?: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  return <View style={s.empty}><Ionicons name={icon} size={34} color={colors.primary} /><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyDetail}>{detail}</Text></View>;
}

export function Row({ title, subtitle, right, onPress }: { title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void }) {
  const content = <><View style={s.rowText}><Text style={s.rowTitle}>{title}</Text>{subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}</View>{right}</>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && s.rowPressed]}>{content}</Pressable> : <View style={s.row}>{content}</View>;
}

const s = StyleSheet.create({
  screen: { padding: spacing.md, paddingBottom: 52, backgroundColor: colors.background, flexGrow: 1 },
  heading: { marginBottom: spacing.lg }, h1: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  stat: { width: '48%', backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.lg, borderColor: colors.border, borderWidth: 1, marginBottom: spacing.sm },
  statIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  statValue: { fontSize: 22, color: colors.ink, fontWeight: '800' }, statLabel: { color: colors.muted, marginTop: 3, fontSize: 13 },
  field: { marginBottom: spacing.md }, label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, color: colors.ink, backgroundColor: '#FBFCFE', fontSize: 16 },
  inputError: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 12, marginTop: 5 },
  button: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginVertical: 4 },
  buttonCompact: { minHeight: 42, paddingHorizontal: 12 }, buttonSecondary: { borderWidth: 1, borderColor: colors.border }, buttonText: { fontSize: 15, fontWeight: '700' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' }, badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }, emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: spacing.sm }, emptyDetail: { color: colors.muted, lineHeight: 20, textAlign: 'center', marginTop: spacing.xs },
  row: { minHeight: 64, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.sm }, rowPressed: { backgroundColor: '#F5F8FD' }, rowText: { flex: 1 }, rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, rowSub: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
});
