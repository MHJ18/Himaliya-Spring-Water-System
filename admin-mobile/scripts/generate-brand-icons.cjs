const fs = require('fs');
const path = require('path');

const sharpModulePath = process.argv[2] || 'sharp';
const sharp = require(sharpModulePath);

const projectRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(projectRoot, 'assets');
const brandSource = path.join(assetsDir, 'brand-water-drop.svg');

// Keep the foreground comfortably inside Android's adaptive-icon safe zone.
// The wider lower curve also prevents launchers from making the mark feel tall.
const dropPath = 'M512 276C418 394 342 486 342 594c0 102 76 172 170 172s170-70 170-172C682 486 606 394 512 276Z';
const highlightPath = 'M410 600c11 53 49 86 103 94';

const foregroundSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="drop" x1="0.18" y1="0.08" x2="0.82" y2="0.92">
        <stop offset="0" stop-color="#72E3FF"/>
        <stop offset="0.52" stop-color="#20B9E7"/>
        <stop offset="1" stop-color="#0786C8"/>
      </linearGradient>
    </defs>
    <path d="${dropPath}" fill="url(#drop)"/>
    <path d="${highlightPath}" fill="none" stroke="#C6F6FF" stroke-linecap="round" stroke-width="28" opacity="0.82"/>
  </svg>
`;

const monochromeSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <path d="${dropPath}" fill="#FFFFFF"/>
  </svg>
`;

const splashSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <circle cx="512" cy="512" r="344" fill="#071B33"/>
    <path d="${dropPath}" fill="#20B9E7"/>
    <path d="${highlightPath}" fill="none" stroke="#C6F6FF" stroke-linecap="round" stroke-width="28" opacity="0.82"/>
  </svg>
`;

async function generate() {
  const brandSvg = fs.readFileSync(brandSource);

  await sharp(brandSvg).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon.png'));
  await sharp(Buffer.from(foregroundSvg)).png().toFile(path.join(assetsDir, 'android-icon-foreground.png'));
  await sharp(Buffer.from(monochromeSvg)).png().toFile(path.join(assetsDir, 'android-icon-monochrome.png'));
  await sharp(Buffer.from(splashSvg)).resize(1024, 1024).png().toFile(path.join(assetsDir, 'splash-icon.png'));
  await sharp(brandSvg).resize(96, 96).png().toFile(path.join(assetsDir, 'favicon.png'));
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
