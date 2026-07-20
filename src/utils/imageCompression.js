const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_DIMENSION = 1280;
const OUTPUT_TYPE = 'image/jpeg';

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image.'));
    };
    image.src = objectUrl;
  });
}

function scaleDimensions(width, height, maxDimension) {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not compress this image.'));
      },
      type,
      quality,
    );
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not prepare this image.'));
    reader.readAsDataURL(blob);
  });
}

async function compressCanvas(canvas, maxBytes) {
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
  let smallest = null;

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, OUTPUT_TYPE, quality);
    if (!smallest || blob.size < smallest.size) smallest = blob;
    if (blob.size <= maxBytes) return blob;
  }

  return smallest;
}

export async function compressImageFile(
  file,
  { maxBytes = DEFAULT_MAX_BYTES, maxDimension = DEFAULT_MAX_DIMENSION } = {},
) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Choose a valid image file.');
  }

  if (file.size <= maxBytes) {
    const image = await loadImage(file);
    if (Math.max(image.width, image.height) <= maxDimension) {
      return blobToDataUrl(file);
    }
  }

  let image = await loadImage(file);
  let dimension = maxDimension;
  let blob = null;

  while (dimension >= 320) {
    const { width, height } = scaleDimensions(image.width, image.height, dimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
    blob = await compressCanvas(canvas, maxBytes);
    if (blob.size <= maxBytes) break;
    dimension = Math.round(dimension * 0.75);
  }

  if (!blob || blob.size > maxBytes) {
    throw new Error('Could not compress this image enough. Try a different photo.');
  }

  return blobToDataUrl(blob);
}
