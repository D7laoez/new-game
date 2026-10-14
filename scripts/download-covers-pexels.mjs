import fs from 'fs';
import path from 'path';

const coversDir = path.resolve('public/covers');

// Curated Pexels photo IDs matching each game's actual mechanic
// Verified via HEAD 200 OK + image/jpeg
const PEXELS_MAP = {
  'quick-tap': '27742642',          // finger touching tablet/button
  'rapid-tap': '28993080',          // fingers typing/keyboard fast tap
  'tug-of-war': '20417700',         // men tug of war
  'pattern-memory': '9834375',      // neon lights pattern
  'coin-rush': '19704271',          // pile of golden coins
  'color-clash': '2539159',         // colorful paint splatter
  'bomb-pass': '35982176',          // explosion/bomb fire
  'memory-match': '7594824',        // memory cards playing cards
  'perfect-timing': '6540714',      // archery target bullseye
  'dodge-arena': '34180947',        // night sky stars shooting star / space
  'quick-math': '39190846',         // chalkboard math equation
  'target-shoot': '6669448',        // arrow on target
  'color-memory': '16485668',       // neon abstract lights (alt from 9834375)
  'balance': '5668882',             // balance scale justice
  'fastest-finger': '31470430',     // red button press
  'whack-it': '16205460',           // hand holding hammer
  'stop-the-bar': '39264485',       // gauge/speedometer meter
  'number-rush': '27639885',        // numbers digits
  'safe-tile': '9775410',           // stone bridge
  'balloon-pop': '28921536',        // colorful balloons party
  'follow-the-arrow': '28079332',   // arrow direction sign
  'dont-press-it': '5052053',       // red warning button
  'treasure-dig': '12860984',       // dusty treasure chests
  'race-to-100': '37719399',        // running sprint track
  'shape-snap': '33386712',         // geometric shapes abstract
  'lane-switch': '29360730',        // racing car highway
  'color-conveyor': '13974251',     // factory conveyor belt
  'tiny-bowling': '12789438',       // bowling pins ball
  'memory-sequence-duel': '17483867', // brain / neural AI illustration
  'reaction-grid': '13859617',      // grid lights
  'tiny-golf': '6370064',           // mini golf course
  'word-scramble': '19825345',      // scrabble letters word
  'catch-the-fruit': '38990501',    // fruit basket
  'sum-sprint': '209224',           // calculator math
  'perfect-landing': '586112',      // spacecraft/rocket launch
  'maze-escape': '20797717',        // maze labyrinth puzzle
  'paper-plane-flight': '7956728',  // white paper on surface / plane
  'shape-sort-factory': '8762345',  // toy wooden blocks shapes
  'ice-slide': '7099647',           // ice snow winter
  'mini-curling': '7544432',        // curling stone ice sport
  'word-chain': '1337375',          // alphabet letters word
  'safecracker': '37991788',        // school lockers combination locks
  'fishing-frenzy': '14339527',     // fishing rod fish lake
  'bridge-builder': '9160242',      // wooden bridge river
  'light-trail-duel': '26384108',   // galaxy stars light trail / neon galaxy
  'find-the-change': '5484739',     // jigsaw puzzle
  'territory-battle': '933329',     // keep: check alternative if fail else fallback
  'balloon-pump': '38220564',       // balloons pump air
  'number-puzzle': '8899562',       // sudoku / newspaper writing
  'find-the-odd-one': '4494496',    // eye peeking hole
  'connect-the-dots': '12453596',   // person sketching drawing
  'color-logic': '11105660',        // colorful paint mixture close-up
  'dice-battle': '269630',          // dice poker chips casino
  'higher-or-lower': '34148826',    // playing card game
  'copy-the-shape': '20535621',     // hand drawing picture
};

// Overrides for tricky IDs — validated
const OVERRIDES = {
  'territory-battle': '8159115', // map territory — check; if fails will fallback to picsum seed
};

for (const [k,v] of Object.entries(OVERRIDES)) PEXELS_MAP[k]=v;

// Final fallback for any ID that fails: picsum seed by game id

function pexelsUrl(photoId) {
  return `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop`;
}

async function downloadOne(gameId, photoId) {
  const dest = path.join(coversDir, `${gameId}.jpg`);
  const url = pexelsUrl(photoId);
  const fallbackUrl = `https://picsum.photos/seed/${gameId}-v2/640/360`;

  for (const attemptUrl of [url, fallbackUrl]) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(attemptUrl, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('image')) throw new Error(`not image ${ct}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 10240) throw new Error(`too small ${buf.length}`);
        // Basic JPEG check
        if (buf[0] !== 0xFF || buf[1] !== 0xD8) {
          // pexels always JPEG, so warn
          console.warn(`[${gameId}] not JPEG header ${buf[0].toString(16)} ${ct}`);
        }
        await fs.promises.writeFile(dest, buf);
        const via = attemptUrl.includes('pexels') ? `pexels:${photoId}` : `picsum-fallback:${gameId}`;
        console.log(`✓ ${gameId} ${via} ${buf.length} bytes`);
        return { gameId, via, size: buf.length, status: 'ok' };
      } catch (e) {
        if (attemptUrl.includes('picsum') || attempt === 2) {
          if (attemptUrl.includes('pexels')) {
            console.warn(`  pexels failed for ${gameId} (${photoId}): ${e.message} — trying picsum fallback`);
            break; // go to fallback URL
          } else {
            throw new Error(`[${gameId}] both sources failed: ${e.message}`);
          }
        } else {
          await new Promise(r => setTimeout(r, 600));
        }
      }
    }
  }
  throw new Error(`[${gameId}] unreachable`);
}

async function main() {
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
  const ids = Object.keys(PEXELS_MAP);
  console.log(`Downloading ${ids.length} covers from Pexels (640x360) -> ${coversDir}`);

  // Validate all pexels IDs quickly via HEAD before bulk download
  console.log('Pre-validating Pexels IDs...');
  const bad = [];
  for (const [gid, pid] of Object.entries(PEXELS_MAP)) {
    try {
      const head = await fetch(pexelsUrl(pid), { method: 'HEAD' });
      if (!head.ok || !String(head.headers.get('content-type')||'').includes('image')) {
        console.warn(`  HEAD FAIL ${gid} pexels:${pid} status=${head.status} ct=${head.headers.get('content-type')}`);
        bad.push(gid);
      }
    } catch (e) {
      console.warn(`  HEAD ERR ${gid} ${e.message}`);
      bad.push(gid);
    }
    await new Promise(r => setTimeout(r, 80));
  }
  if (bad.length) console.log(`Bad IDs (will use picsum fallback): ${bad.join(', ')}`);

  const results = [];
  const failures = [];
  for (let i = 0; i < ids.length; i++) {
    const gid = ids[i];
    try {
      const r = await downloadOne(gid, PEXELS_MAP[gid]);
      results.push(r);
    } catch (e) {
      console.error(`✗ ${gid} FAILED: ${e.message}`);
      failures.push({ id: gid, error: e.message });
    }
    if (i < ids.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n=== SUMMARY success ${results.length}/${ids.length} failed ${failures.length} ===`);
  if (failures.length) console.log(failures);

  console.log('\n=== SIZE CHECK >10KB ===');
  let tooSmall = [];
  for (const gid of ids) {
    const p = path.join(coversDir, `${gid}.jpg`);
    if (!fs.existsSync(p)) { console.log(`MISSING ${gid}`); tooSmall.push(gid); continue; }
    const sz = fs.statSync(p).size;
    const ok = sz > 10240;
    if (!ok) tooSmall.push(gid);
    console.log(`${ok?'OK':'TOO_SMALL'} ${String(sz).padStart(6)} ${gid}.jpg`);
  }
  if (tooSmall.length) {
    console.error(`Too small/missing: ${tooSmall.join(', ')}`);
    process.exit(1);
  }

  // Verify via localhost if server running
  console.log('\n=== CURL VERIFY via localhost:3000 ===');
  for (const gid of ids) {
    try {
      const res = await fetch(`http://localhost:3000/covers/${gid}.jpg`, { method: 'HEAD' });
      const len = res.headers.get('content-length') || '?';
      console.log(`${res.ok?'OK':'FAIL'} ${res.status} len=${len} ${gid}.jpg`);
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch (e) {
      console.warn(`curl verify fail ${gid}: ${e.message}`);
    }
  }

  fs.writeFileSync(path.join(coversDir,'_pexels_manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), map: PEXELS_MAP, results, failures }, null, 2));
  console.log('\nDone. Manifest written to _pexels_manifest.json');
}

main().catch(e=>{ console.error(e); process.exit(1); });
