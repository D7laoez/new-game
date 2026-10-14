// Lightweight professional graphics helpers — Canvas2D only, no deps, 60fps safe
export interface Vec2 { x:number; y:number }

export interface Particle { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; r:number; color:string; alpha:number; rot:number; vr:number; }

export function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v));}

export function createOverlayCanvas(parent: HTMLElement, id: string, zIndex = 1, alpha = true): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.id = id;
  c.className = 'gfx-overlay-canvas';
  c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${zIndex};display:block;`;
  // ensure parent is relative
  const cs = getComputedStyle(parent);
  if (cs.position === 'static') parent.style.position = 'relative';
  parent.prepend(c);
  const ctx = c.getContext('2d', { alpha })!;
  (c as any)._ctx = ctx;
  return c;
}
export function resizeCanvasToParent(canvas: HTMLCanvasElement): void {
  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }
}

export function drawAnimatedGradient(ctx: CanvasRenderingContext2D, t: number, w:number, h:number, palette: string[]): void {
  const g = ctx.createLinearGradient(0,0, w, h*Math.sin(t*0.00025)+h);
  const n = palette.length;
  palette.forEach((col,i)=>{
    const off = (i/(n-1) + Math.sin(t*0.0006+i)*0.02) % 1;
    g.addColorStop(clamp(off,0,1), col);
  });
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);
}
export function drawStars(ctx:CanvasRenderingContext2D, t:number, w:number,h:number, count=44, dpr=1): void {
  ctx.save();
  for(let i=0;i<count;i++){
    const x = (Math.sin(i*12.9898)*43758.5453 % 1 +1)%1 * w;
    const baseY = (Math.cos(i*78.233)*43758.5453 %1+1)%1 * h;
    const y = (baseY + t*0.02*(0.4+(i%3)*0.3)) % h;
    const tw = 0.55+0.45*Math.sin(t*0.003 + i*1.7);
    const r = (0.9 + (i%3)*0.7)*dpr * tw;
    ctx.globalAlpha = 0.35+0.45*tw;
    ctx.fillStyle = i%7===0 ? '#ffd86b' : '#ffffff';
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    if(i%9===0){ ctx.globalAlpha=0.12; ctx.beginPath(); ctx.arc(x,y,r*3.2,0,Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
}
export function spawnBurst(particles: Particle[], x:number, y:number, color:string, n=14, speed=180, dpr=1): void {
  for(let i=0;i<n;i++){
    const a = Math.PI*2*i/n + Math.random()*0.35;
    const s = speed*(0.6+Math.random()*0.9);
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - Math.random()*40, life:0, maxLife:0.55+Math.random()*0.35, r:(3+Math.random()*5)*dpr, color, alpha:1, rot:Math.random()*Math.PI*2, vr:(Math.random()-0.5)*10 });
  }
  if(particles.length>80) particles.splice(0, particles.length-80);
}
export function updateParticles(particles:Particle[], dt:number, g=620): void {
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.life+=dt;
    if(p.life>=p.maxLife){ particles.splice(i,1); continue; }
    p.x += p.vx*dt; p.y += p.vy*dt; p.vy += g*dt; p.rot += p.vr*dt;
    p.alpha = 1 - p.life/p.maxLife;
  }
}
export function drawParticles(ctx:CanvasRenderingContext2D, particles:Particle[], dpr=1): void {
  for(const p of particles){
    ctx.save();
    ctx.globalAlpha = p.alpha*0.95;
    ctx.translate(p.x,p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10*dpr;
    const s = p.r * (1 - p.life/p.maxLife*0.2);
    // diamond sparkle
    ctx.beginPath();
    ctx.moveTo(0,-s); ctx.lineTo(s*0.55,0); ctx.lineTo(0,s); ctx.lineTo(-s*0.55,0); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowBlur=0;
}
// Vector icons - pure Canvas path, no emoji
export function drawVectorBalloon(ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, color:string, highlight=true, dpr=1): void {
  // balloon body
  const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.4, r*0.2, cx, cy, r*1.15);
  grad.addColorStop(0,'#ffffff'); grad.addColorStop(0.18,color); grad.addColorStop(1, shade(color,-34));
  ctx.fillStyle = grad;
  ctx.beginPath();
  // teardrop ellipse
  ctx.ellipse(cx, cy, r*0.92, r*1.18, 0, 0, Math.PI*2);
  // bottom tip
  ctx.moveTo(cx - r*0.18, cy + r*1.12); ctx.lineTo(cx + r*0.18, cy + r*1.12); ctx.lineTo(cx, cy + r*1.38); ctx.closePath();
  ctx.fill();
  // string
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2*dpr;
  ctx.beginPath(); ctx.moveTo(cx, cy + r*1.38); ctx.bezierCurveTo(cx - r*0.12, cy + r*1.68, cx + r*0.18, cy + r*2.0, cx - r*0.05, cy + r*2.45); ctx.stroke();
  if(highlight){ ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.ellipse(cx - r*0.32, cy - r*0.38, r*0.22, r*0.31, -0.3, 0, Math.PI*2); ctx.fill(); }
}
export function drawVectorCoin(ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, inner='#FFD700', edge='#b8860b', dpr=1): void {
  ctx.save();
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx, cy + r*0.78, r*0.85, r*0.28, 0,0,Math.PI*2); ctx.fill();
  // edge
  const g = ctx.createRadialGradient(cx - r*0.25, cy - r*0.35, r*0.2, cx, cy, r);
  g.addColorStop(0,'#fff7cc'); g.addColorStop(0.22, inner); g.addColorStop(1, edge);
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=1.2*dpr; ctx.stroke();
  // inner ring
  ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1*dpr; ctx.beginPath(); ctx.arc(cx, cy, r*0.68, 0, Math.PI*2); ctx.stroke();
  // $ glyph
  ctx.fillStyle='#7a4a00'; ctx.font=`700 ${Math.round(r*0.95)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('$', cx, cy+1);
  ctx.restore();
}
export function drawVectorGem(ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, col='#00e5ff', dpr=1): void {
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = 14*dpr;
  const pts: [number,number][] = [[0,-r],[r*0.78,-r*0.18],[r*0.58,r*0.72],[0,r],[ -r*0.58,r*0.72],[ -r*0.78,-r*0.18]];
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0,'#ffffff'); g.addColorStop(0.25, col); g.addColorStop(1, shade(col,-28));
  ctx.fillStyle=g;
  ctx.beginPath(); pts.forEach(([x,y],i)=> i?ctx.lineTo(cx+x,cy+y):ctx.moveTo(cx+x,cy+y)); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.beginPath();
  ctx.moveTo(cx, cy - r*0.72); ctx.lineTo(cx + r*0.32, cy - r*0.08); ctx.lineTo(cx, cy + r*0.08); ctx.lineTo(cx - r*0.32, cy - r*0.08); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.shadowBlur=0;
}
export function drawVectorBomb(ctx:CanvasRenderingContext2D, cx:number, cy:number, r:number, dpr=1): void {
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx, cy + r*0.78, r*0.82, r*0.26, 0,0,Math.PI*2); ctx.fill();
  const g = ctx.createRadialGradient(cx - r*0.28, cy - r*0.28, r*0.18, cx, cy, r);
  g.addColorStop(0,'#6b7280'); g.addColorStop(0.5,'#1f2937'); g.addColorStop(1,'#030712');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx, cy, r*0.92, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#f59e0b'; ctx.beginPath(); ctx.arc(cx + r*0.42, cy - r*0.62, r*0.18, 0, Math.PI*2); ctx.fill();
  // fuse
  ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=2.2*dpr; ctx.beginPath(); ctx.moveTo(cx + r*0.46, cy - r*0.66); ctx.quadraticCurveTo(cx + r*0.78, cy - r*0.92, cx + r*0.82, cy - r*0.38); ctx.stroke();
  // spark
  ctx.fillStyle='#fef08a'; ctx.shadowColor='#facc15'; ctx.shadowBlur=8*dpr; ctx.beginPath(); ctx.arc(cx + r*0.84, cy - r*0.36, r*0.14, 0, Math.PI*2); ctx.fill();
  ctx.restore(); ctx.shadowBlur=0;
}
export function shade(hex:string, amt:number): string {
  let c = hex.replace('#','');
  if(c.length===3) c=c.split('').map(ch=>ch+ch).join('');
  const n = parseInt(c,16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return `rgb(${r},${g},${b})`;
}
export function domBurst(container: HTMLElement, x:number, y:number, text:string, color:string): void {
  for(let i=0;i<6;i++){
    const s=document.createElement('span');
    s.className='gfx-dom-particle';
    s.textContent=text;
    s.style.left=x+'px'; s.style.top=y+'px';
    s.style.setProperty('--tx', `${(Math.random()-0.5)*140}px`);
    s.style.setProperty('--ty', `${-50 - Math.random()*90}px`);
    s.style.color=color;
    container.appendChild(s);
    setTimeout(()=>s.remove(), 700);
  }
}
