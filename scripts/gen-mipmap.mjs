
import sharp from 'sharp';
import fs from 'fs';
const src = fs.readFileSync('public/icon.svg');
// Sizes for density
const densities = {mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192};
for (const [dpi, size] of Object.entries(densities)) {
  // ic_launcher is legacy square, foreground is adaptive
  const fg = `android/app/src/main/res/mipmap-${dpi}/ic_launcher_foreground.png`;
  const launcher = `android/app/src/main/res/mipmap-${dpi}/ic_launcher.png`;
  const round = `android/app/src/main/res/mipmap-${dpi}/ic_launcher_round.png`;
  // Generate foreground: strict 108dp adaptive (foreground 72dp centered), we do size with padding
  const inner = Math.round(size * 0.65);
  const innerBuf = await sharp(src, {density:512}).resize(inner,inner,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const base = await sharp({create:{width:size,height:size,channels:4,background:{r:15,g:23,b:42,alpha:1}}}).png().toBuffer();
  await sharp(base).composite([{input: innerBuf, gravity:'centre'}]).png().toFile(fg);
  // Legacy launcher same but no adaptive margin
  await sharp(src,{density:512}).resize(size,size,{fit:'contain',background:{r:15,g:23,b:42,alpha:1}}).png().toFile(launcher);
  await sharp(src,{density:512}).resize(size,size,{fit:'contain',background:{r:15,g:23,b:42,alpha:1}}).png().toFile(round);
  console.log(dpi, size);
}
console.log('mipmap done');
