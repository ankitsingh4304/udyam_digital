// Generates PWA icons from the brand mark (original design, not any operator's logo).
import sharp from "sharp";
const mark = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#E40000"/>
  <g transform="translate(256 270) scale(${pad ? 9 : 11}) translate(-12 -14)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">
    <path d="M5 16a9 9 0 0 1 14 0"/><path d="M8.5 18.5a5 5 0 0 1 7 0"/><circle cx="12" cy="20.5" r="0.9" fill="#fff" stroke="none"/>
  </g></svg>`;
for (const [file, size, maskable] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["maskable-512.png", 512, true], ["apple-touch-icon.png", 180, true]]) {
  await sharp(Buffer.from(mark(maskable))).resize(size, size).png().toFile(`public/icons/${file}`);
}
console.log("icons done");
