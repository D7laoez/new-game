
import sharp from 'sharp';
await sharp({create:{width:1080,height:1920,channels:4,background:{r:10,g:12,b:22,alpha:1}}}).png().toFile('public/screenshots/narrow.png');
await sharp({create:{width:1920,height:1080,channels:4,background:{r:10,g:12,b:22,alpha:1}}}).png().toFile('public/screenshots/wide.png');
console.log('screenshots done');
