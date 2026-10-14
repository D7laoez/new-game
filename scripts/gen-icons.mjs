
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = 'public/icon.svg';
const svgBuf = fs.readFileSync(svgPath);

// Helper
async function gen(size, out, opts={}) {
  let pipeline = sharp(svgBuf, {density: 512}).resize(size, size, {fit: 'contain', background: {r:10,g:12,b:22,alpha:1}});
  // For maskable we add 20% safe padding: render at 80% centered
  if (opts.maskable) {
    // Create 512 with safe zone: paste resized at 80%
    const inner = Math.round(size * 0.7);
    const innerBuf = await sharp(svgBuf, {density:512}).resize(inner,inner,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    const base = await sharp({create:{width:size,height:size,channels:4,background:{r:15,g:23,b:42,alpha:1}}}).png().toBuffer();
    await sharp(base).composite([{input: innerBuf, gravity:'centre'}]).png().toFile(out);
    console.log('maskable', out);
    return;
  }
  await pipeline.png().toFile(out);
  console.log('gen', out, size);
}

await gen(192, 'public/icon-192.png');
await gen(512, 'public/icon-512.png');
await gen(512, 'public/icon-512-maskable.png', {maskable:true});
await gen(180, 'public/apple-touch-icon.png');
// also favicon style 32?
await gen(32, 'public/favicon-32.png');
console.log('done');
