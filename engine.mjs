/**
 * Race Lab demonstration engine.
 * The model and its parameters are illustrative, NOT calibrated against real races.
 * Independent of rendering, DOM, network and external data providers.
 */
export const STYLES = ['逃げ', '先行', '差し', '追込'];
export const SCENARIOS = {normal: '標準', high: 'ハイペース', low: 'スローペース'};
export const COLORS = ['#f6f7fa','#34373f','#e6575e','#4b83dd','#ecc858','#52a86d','#f18b44','#e285ae','#a5a5a5','#9c7a45','#7b70c7','#31a9b1','#bf576e','#aad85d','#427b83','#d4aa82','#6662a9','#c4c8d1'];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function exampleHorses() {
  return Array.from({length: 18}, (_, index) => {
    const id = index + 1;
    const style = index % 9 < 2 ? '逃げ' : index % 9 < 5 ? '先行' : index % 9 < 7 ? '差し' : '追込';
    return {id, name: `サンプル${String(id).padStart(2, '0')}`, style,
      speed: 66 + (id * 7) % 19, stamina: 62 + (id * 11) % 24, kick: 62 + (id * 13) % 25};
  });
}
function random(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6D2B79F5;
    let z = n;
    z = Math.imul(z ^ z >>> 15, z | 1);
    z ^= z + Math.imul(z ^ z >>> 7, z | 61);
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}
function normal(rng) {
  return Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
}
export function validateHorses(horses) {
  if (!Array.isArray(horses) || horses.length !== 18) throw new Error('出走馬は18頭必要です。');
  const ids = new Set();
  for (const h of horses) {
    if (!Number.isInteger(h.id) || h.id < 1 || h.id > 18 || ids.has(h.id)) throw new Error('馬番は1〜18の重複しない整数が必要です。');
    ids.add(h.id);
    if (!String(h.name ?? '').trim()) throw new Error(`${h.id}番の馬名が空です。`);
    if (!STYLES.includes(h.style)) throw new Error(`${h.id}番の脚質が正しくありません。`);
    for (const k of ['speed', 'stamina', 'kick']) {
      if (!Number.isFinite(Number(h[k])) || Number(h[k]) < 40 || Number(h[k]) > 100) throw new Error(`${h.id}番の${k}は40〜100にしてください。`);
    }
  }
}

/** @returns {{frames: Array, results: Array, elapsed: number, distance: number, scenario: string, seed: number}} */
export function runRace(horses, options = {}) {
  validateHorses(horses);
  const distance = options.distance || 2200;
  if (!(distance >= 1000 && distance <= 3600)) throw new Error('距離は1000〜3600mで指定してください。');
  const scenario = SCENARIOS[options.scenario] ? options.scenario : 'normal';
  const seed = (options.seed ?? 20261115) >>> 0;
  const record = options.record !== false;
  const rng = random(seed);
  const dt = 0.5;
  const states = horses.map((horse, index) => ({
    ...horse, x: -Math.max(0, rng() < .07 ? rng() * 7 : rng() * 2),
    lane: (index % 6) + 0.25 * ((index / 6) | 0),
    form: clamp(normal(rng) * .11, -.32, .32),
    sway: rng() * 6.28,
    finishTime: null,
    speedNow: 0,
  }));
  const frames = [];
  const maxT = distance / 12 + 55;
  let t = 0;
  const packFrame = () => ({
    t: Number(t.toFixed(1)),
    horses: states.map(s => ({id: s.id, x: Math.max(0, Math.min(distance, s.x)), lane: s.lane, speed: s.speedNow, finished: s.finishTime !== null}))
  });
  if (record) frames.push(packFrame());
  for (let step = 0; step < maxT / dt; step++) {
    if (states.every(h => h.finishTime !== null)) break;
    const previous = states.map(h => ({id:h.id,x:h.x,lane:h.lane, finished: h.finishTime!==null}));
    for (const h of states) {
      if (h.finishTime !== null) continue;
      const p = clamp(h.x / distance, 0, 1);
      const early = clamp(1 - p / .38, 0, 1);
      const late = clamp((p - .61) / .39, 0, 1);
      const earlyStyle = {逃げ:.51, 先行:.25, 差し:-.17, 追込:-.36}[h.style];
      const lateStyle = {逃げ:-.24, 先行:.08, 差し:.30, 追込:.46}[h.style];
      const paceEarly = scenario === 'high' ? .41 : scenario === 'low' ? -.43 : 0;
      const paceLate = scenario === 'high' ? -.36 : scenario === 'low' ? .22 : 0;
      const energyCost = scenario === 'high' ? .13 : scenario === 'low' ? -.07 : 0;
      const fatigue = late * (Math.max(0, 70 - Number(h.stamina)) * .004 + energyCost * (.35 + Math.max(0, earlyStyle)));
      const exertion = late * ((Number(h.stamina) - 70) * .008 + (Number(h.kick) - 70) * .013);
      const dynamic = .028 * Math.sin(t / 8 + h.sway);
      // A deliberately simple synthetic velocity model, not a prediction of real-world times.
      let velocity = 16.52 + (Number(h.speed) - 70) * .009 + h.form +
        earlyStyle * early + lateStyle * late + paceEarly * early + paceLate * late +
        exertion - fatigue + dynamic;
      const blocked = previous.some(other =>
        other.id !== h.id && !other.finished && other.x > h.x && other.x - h.x < 2.6 &&
        Math.abs(other.lane - h.lane) < .32);
      if (blocked) velocity -= .10;
      velocity = clamp(velocity, 12.1, 19.6);
      h.speedNow = velocity;
      h.lane = clamp((h.id - 1) % 6 + .25 * Math.floor((h.id - 1) / 6) +
        Math.sin(t / 14 + h.sway) * .13 + (h.style === '追込' ? late*.65 : h.style === '差し' ? late*.30 : 0), 0, 6.45);
      const before = h.x;
      h.x += velocity * dt;
      if (h.x >= distance) h.finishTime = t + (distance - before) / velocity;
    }
    t += dt;
    if (record && (step % 2 === 1 || states.every(h => h.finishTime !== null))) frames.push(packFrame());
  }
  if (states.some(h => h.finishTime === null)) throw new Error('計算が規定時間内に終了しませんでした。');
  const results = [...states].sort((a,b) => a.finishTime - b.finishTime)
    .map((h,i) => ({id:h.id, name:h.name, style:h.style, rank:i+1, time:h.finishTime, gap:h.finishTime-states.reduce((acc, s)=>Math.min(acc,s.finishTime), Infinity)}));
  return {frames, results, elapsed:t, distance, scenario, seed};
}

export function summarizeRaces(horses, opts={}, attempts=1000, onProgress=null) {
  validateHorses(horses);
  const baseSeed = (opts.seed ?? 20261115) >>> 0;
  const stats = horses.map(h=>({id:h.id,name:h.name,win:0,place:0,rankTotal:0}));
  const byId = new Map(stats.map(v => [v.id,v]));
  for (let i=0;i<attempts;i++) {
    const result = runRace(horses,{...opts, seed:(baseSeed + Math.imul(i,2654435761))>>>0, record:false});
    for (const horse of result.results) {
      const x=byId.get(horse.id);
      x.rankTotal+=horse.rank;
      if (horse.rank===1) x.win++;
      if (horse.rank<=3) x.place++;
    }
    if(onProgress && (i+1)%100===0)onProgress(i+1, attempts);
  }
  return stats.map(s=>({...s, winRate:s.win/attempts*100, placeRate:s.place/attempts*100, avgRank:s.rankTotal/attempts}))
    .sort((a,b)=>b.winRate-a.winRate || a.id-b.id);
}
