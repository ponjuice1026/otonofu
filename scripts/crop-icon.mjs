import sharp from "sharp";
import { copyFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(
  root,
  "public/brand/otonofu-icon-cropped.png",
);

const DARK_THRESHOLD = 90;

async function detectDarkBounds(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < DARK_THRESHOLD && g < DARK_THRESHOLD && b < DARK_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error("Could not detect dark square in icon image.");
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function writeSquareIcon(input, output, size) {
  const bounds = await detectDarkBounds(input);
  await sharp(input)
    .extract(bounds)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(output);
}

const originalAsset =
  "C:/Users/ryoyu/.cursor/projects/c-Users-ryoyu-Desktop-rym-jp/assets/c__Users_ryoyu_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-9cb82433-aa83-401b-a068-350b2e76cd4a.png";

let input = originalAsset;
try {
  await sharp(input).metadata();
} catch {
  input = source;
}

const cropped = join(root, "public/brand/otonofu-icon-cropped.png");
await writeSquareIcon(input, cropped, 512);

const targets = [
  join(root, "public/brand/otonofu-icon.png"),
  join(root, "app/icon.png"),
  join(root, "app/apple-icon.png"),
];

for (const target of targets) {
  copyFileSync(cropped, target);
}

const faviconIco = join(root, "app/favicon.ico");
try {
  unlinkSync(faviconIco);
  console.log("Removed legacy app/favicon.ico");
} catch {
  // already removed
}

console.log("Updated cropped icon assets (512x512, dark square only).");
