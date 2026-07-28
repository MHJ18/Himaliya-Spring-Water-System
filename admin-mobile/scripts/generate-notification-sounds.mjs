import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sampleRate = 22050;
const outputDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/sounds');

function writeWave(name, duration, sampleAt) {
  const sampleCount = Math.floor(sampleRate * duration);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const value = Math.max(-1, Math.min(1, sampleAt(time, duration)));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + (index * 2));
  }
  fs.writeFileSync(path.join(outputDirectory, name), buffer);
}

fs.mkdirSync(outputDirectory, { recursive: true });

writeWave('water_drop.wav', 0.55, (time, duration) => {
  const progress = time / duration;
  const envelope = Math.exp(-7 * progress) * Math.min(1, time * 90);
  const frequency = 1050 - (620 * progress);
  return 0.72 * envelope * Math.sin(2 * Math.PI * frequency * time);
});

writeWave('bright_chime.wav', 0.85, (time) => {
  const first = Math.exp(-4.8 * time) * Math.sin(2 * Math.PI * 880 * time);
  const secondTime = Math.max(0, time - 0.16);
  const second = time >= 0.16
    ? Math.exp(-4.5 * secondTime) * Math.sin(2 * Math.PI * 1174.66 * secondTime)
    : 0;
  return 0.38 * first + 0.52 * second;
});

writeWave('soft_bell.wav', 1.05, (time) => {
  const envelope = Math.exp(-3.8 * time) * Math.min(1, time * 70);
  const fundamental = Math.sin(2 * Math.PI * 659.25 * time);
  const harmonic = 0.35 * Math.sin(2 * Math.PI * 1318.5 * time);
  return 0.42 * envelope * (fundamental + harmonic);
});
