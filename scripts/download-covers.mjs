import fs from 'fs';
import path from 'path';

const coversDir = path.resolve('public/covers');

// Precise query per game — reflects actual mechanic
const GAME_QUERIES = {
  'quick-tap': 'finger pressing button',
  'rapid-tap': 'finger tapping fast button',
  'tug-of-war': 'tug of war rope',
  'pattern-memory': 'color pattern lights memory game',
  'coin-rush': 'gold coins pile treasure',
  'color-clash': 'colorful paint palette splash',
  'bomb-pass': 'bomb fuse dynamite',
  'memory-match': 'memory card matching game',
  'perfect-timing': 'archery target bullseye',
  'dodge-arena': 'meteor asteroid space falling',
  'quick-math': 'math calculation chalkboard numbers',
  'target-shoot': 'target shooting archery',
  'color-memory': 'colorful lights sequence memory',
  'balance': 'balance scale weighing',
  'fastest-finger': 'finger buzzer button press',
  'whack-it': 'whack a mole arcade hammer',
  'stop-the-bar': 'gauge meter bar indicator',
  'number-rush': 'numbers digits scattered',
  'safe-tile': 'stone bridge tiles maze path',
  'balloon-pop': 'colorful balloons sky party',
  'follow-the-arrow': 'arrow direction signs',
  'dont-press-it': 'giant red button dont press',
  'treasure-dig': 'treasure chest gold digging',
  'race-to-100': 'running sprint track race',
  'shape-snap': 'geometric shapes pattern',
  'lane-switch': 'racing car highway lane',
  'color-conveyor': 'factory conveyor belt colorful',
  'tiny-bowling': 'bowling pins ball alley',
  'memory-sequence-duel': 'brain memory game lights',
  'reaction-grid': 'grid lights reaction game',
  'tiny-golf': 'mini golf course putter',
  'word-scramble': 'scrambled letters word puzzle',
  'catch-the-fruit': 'fruit basket harvest apples',
  'sum-sprint': 'addition math numbers calculation',
  'perfect-landing': 'spacecraft moon landing',
  'maze-escape': 'maze labyrinth puzzle',
  'paper-plane-flight': 'paper airplane flying sky',
  'shape-sort-factory': 'shape sorting geometric blocks',
  'ice-slide': 'ice slide frozen winter snow',
  'mini-curling': 'curling stone ice sport',
  'word-chain': 'word chain letters alphabet',
  'safecracker': 'safe vault combination lock',
  'fishing-frenzy': 'fishing rod catch fish lake',
  'bridge-builder': 'wooden bridge river building',
  'light-trail-duel': 'neon light trail tron motorcycle',
  'find-the-change': 'spot the difference puzzle',
  'territory-battle': 'territory map color tiles',
  'balloon-pump': 'balloon inflating pump air',
  'number-puzzle': 'number puzzle sudoku math',
  'find-the-odd-one': 'find odd one out puzzle eyes',
  'connect-the-dots': 'connect dots drawing line puzzle',
  'color-logic': 'color logic stroop test',
  'dice-battle': 'dice rolling game casino',
  'higher-or-lower': 'playing cards poker higher lower',
  'copy-the-shape': 'drawing circle star hand sketch',
};

// Fallback curated Unsplash photo IDs (guaranteed to exist, non-premium prefer) — used if search fails
const FALLBACK_IDS = {
  'quick-tap': 'photo-1555421689-d68471e189f2', // finger press
  'rapid-tap': 'photo-1516321318423-f06f85e504b3',
};

async function searchUnsplash(query) {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=5`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  if (!res.ok) throw new Error(`search ${res.status} for "${query}"`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error(`no results for "${query}"`);
  // Prefer non-premium if available
  let pick = data.results.find(r => !r.premium) || data.results[0];
  return pick;
}

async function downloadImage(gameId, query) {
  let photoId;
  let sourceUrl;
  try {
    const photo = await searchUnsplash(query);
    photoId = photo.id;
    // Build 640x360 url — use images.unsplash.com with photoId
    // photo.urls.raw already contains host; we reconstruct to force size
    const host = photo.urls.raw.includes('plus.unsplash.com') ? 'https://plus.unsplash.com' : 'https://images.unsplash.com';
    // raw id part: extract photo id prefix
    // photo.id is like 'PbNEE4DKrkQ' but raw url uses premium_photo-... need to use raw url base
    // Simpler: take photo.urls.raw and append w/h params
    const rawBase = photo.urls.raw.split('?')[0];
    sourceUrl = `${rawBase}?w=640&h=360&fit=crop&auto=format&q=80`;
    console.log(`[${gameId}] query="${query}" -> photo ${photoId} (${photo.premium?'premium':'free'})`);
  } catch (e) {
    console.warn(`[${gameId}] search failed: ${e.message} — fallback to picsum seed`);
    // fallback: picsum with seed = gameId (still real photo, not random)
    sourceUrl = `https://picsum.photos/seed/${gameId}-cover/640/360`;
    photoId = `picsum-${gameId}`;
  }

  const dest = path.join(coversDir, `${gameId}.jpg`);
  // download
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(sourceUrl, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('image')) throw new Error(`not image: ${ct} status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10240) throw new Error(`too small ${buf.length} bytes`);
      // validate JPEG header
      if (buf[0] !== 0xFF || buf[1] !== 0xD8) {
        // could be PNG/webp — still accept if >10KB but log
        console.warn(`[${gameId}] not JPEG header ${buf[0].toString(16)} ${buf[1].toString(16)} type ${ct}`);
      }
      await fs.promises.writeFile(dest, buf);
      console.log(`  ✓ saved ${buf.length} bytes -> ${gameId}.jpg`);
      return { gameId, query, photoId, sourceUrl, size: buf.length, status: 'ok' };
    } catch (e) {
      lastErr = e;
      console.warn(`  attempt ${attempt} failed: ${e.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt));
    }
  }
  throw new Error(`[${gameId}] failed after 3 attempts: ${lastErr.message} url=${sourceUrl}`);
}

async function main() {
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
  const ids = Object.keys(GAME_QUERIES);
  console.log(`Downloading ${ids.length} covers to ${coversDir}`);
  const results = [];
  const failures = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const q = GAME_QUERIES[id];
    try {
      const r = await downloadImage(id, q);
      results.push(r);
    } catch (e) {
      console.error(`✗ ${id} FAILED: ${e.message}`);
      failures.push({ id, error: e.message });
    }
    // throttle to avoid rate limit
    if (i < ids.length - 1) await new Promise(r => setTimeout(r, 500));
  }
  console.log('\n=== SUMMARY ===');
  console.log(`Success: ${results.length}/${ids.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length) console.log(failures);
  // write manifest
  const manifest = { generatedAt: new Date().toISOString(), total: ids.length, results, failures };
  fs.writeFileSync(path.join(coversDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
  // size check
  console.log('\n=== SIZE CHECK (>10KB) ===');
  for (const id of ids) {
    const p = path.join(coversDir, `${id}.jpg`);
    if (!fs.existsSync(p)) { console.log(`MISSING ${id}`); continue; }
    const sz = fs.statSync(p).size;
    const ok = sz > 10240 ? 'OK' : 'TOO_SMALL';
    console.log(`${ok} ${String(sz).padStart(6)} ${id}.jpg`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
