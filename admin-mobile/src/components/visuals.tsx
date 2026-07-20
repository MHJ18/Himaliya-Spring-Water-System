import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { colors, radius, shadow, spacing } from '../theme';

const delivered = require('../assets/lottie/delivered.json');
const approved = require('../assets/lottie/approved.json');

export function LottieMetric({ kind, title, value, detail, tone = colors.primary }: { kind: 'delivered' | 'approved'; title: string; value: string | number; detail: string; tone?: string }) {
  return <View style={[styles.metric, { borderTopColor: tone }]}><LottieView source={kind === 'delivered' ? delivered : approved} autoPlay loop style={styles.lottie} colorFilters={[{ keypath: '**', color: tone }]} /><View style={{ flex: 1 }}><Text style={styles.metricTitle}>{title}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View></View>;
}

export function Sparkline({ values, color = colors.primary, height = 90 }: { values: number[]; color?: string; height?: number }) {
  const width = 310; const max = Math.max(...values, 1); const min = Math.min(...values, 0); const range = Math.max(1, max - min);
  const points = values.map((value, index) => ({ x: values.length === 1 ? 0 : index * width / (values.length - 1), y: height - 10 - ((value - min) / range) * (height - 24) }));
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '); const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Defs><SvgGradient id="fill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.35" /><Stop offset="1" stopColor={color} stopOpacity="0" /></SvgGradient></Defs><Path d={area} fill="url(#fill)" /><Path d={line} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

export function Donut({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const size = 92; const stroke = 10; const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const ratio = Math.min(1, value / Math.max(total, 1));
  return <View style={styles.donutWrap}><Svg width={size} height={size}><Circle cx={size / 2} cy={size / 2} r={r} stroke="#E8EDF5" strokeWidth={stroke} fill="none" /><Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * ratio} ${c}`} strokeLinecap="round" rotation="-90" origin={`${size / 2},${size / 2}`} /></Svg><View style={styles.donutLabel}><Text style={styles.donutValue}>{Math.round(ratio * 100)}%</Text><Text style={styles.donutText}>{label}</Text></View></View>;
}

export function PulseOrb() {
  const scale = useRef(new Animated.Value(0.8)).current; const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => { const loop = Animated.loop(Animated.parallel([Animated.sequence([Animated.timing(scale, { toValue: 1.18, duration: 1300, useNativeDriver: true }), Animated.timing(scale, { toValue: 0.8, duration: 1300, useNativeDriver: true })]), Animated.sequence([Animated.timing(opacity, { toValue: 0.12, duration: 1300, useNativeDriver: true }), Animated.timing(opacity, { toValue: 0.5, duration: 1300, useNativeDriver: true })]) ])); loop.start(); return () => loop.stop(); }, [opacity, scale]);
  return <View style={styles.orbWrap}><Animated.View style={[styles.orbPulse, { opacity, transform: [{ scale }] }]} /><View style={styles.orb}><Text style={styles.orbText}>HS</Text></View></View>;
}
const styles = StyleSheet.create({ metric: { width: '48%', minHeight: 178, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopWidth: 3, marginBottom: spacing.sm, ...shadow }, lottie: { width: 66, height: 52, alignSelf: 'flex-end', marginTop: -8, marginRight: -5 }, metricTitle: { color: colors.muted, fontSize: 12, fontWeight: '700' }, metricValue: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 4 }, metricDetail: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 4 }, donutWrap: { width: 110, alignItems: 'center', position: 'relative' }, donutLabel: { position: 'absolute', top: 26, alignItems: 'center' }, donutValue: { color: colors.ink, fontSize: 16, fontWeight: '900' }, donutText: { color: colors.muted, fontSize: 9 }, orbWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }, orbPulse: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#5CC8FF' }, orb: { width: 104, height: 104, borderRadius: 34, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow }, orbText: { color: colors.primary, fontWeight: '900', fontSize: 32 } });
