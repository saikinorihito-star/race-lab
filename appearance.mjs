// Shared, stable visual palette. This does not change the race prediction model.
// Both cap and jacket follow the JRA-style frame palette as a simulator convention.
const coats=['#7b4b31','#383333','#b46a3d','#c1bdb4','#62402b','#262b31',
 '#9e6948','#e3dfd5','#4e352b','#8c5b40','#343130','#bd8b5e',
 '#653f2e','#c8c4bb','#885f47','#39302c','#a2734a','#d4cfc2'];
// JRA 日本中央競馬会競馬施行規程 別表(4), 第159条:
// https://www.jra.go.jp/company/about/law/pdf/07.pdf (PDF p.80)
// Array entries are the number of horses in frames 1 through 8.
// For 18 runners, the 17-runner allocation is extended to 3 in frame 8.
// Two-runner races are a Race Lab-only configuration (one horse per frame).
export const FRAME_COLORS=Object.freeze([
 '#f9f9f9','#16181e','#dc293d','#246cde',
 '#f4d444','#2aa365','#f18421','#e87ca6'
]);
export const FRAME_SIZES=Object.freeze({
 2:[1,1],3:[1,1,1],4:[1,1,1,1],5:[1,1,1,1,1],
 6:[1,1,1,1,1,1],7:[1,1,1,1,1,1,1],8:[1,1,1,1,1,1,1,1],
 9:[1,1,1,1,1,1,1,2],10:[1,1,1,1,1,1,2,2],
 11:[1,1,1,1,1,2,2,2],12:[1,1,1,1,2,2,2,2],
 13:[1,1,1,2,2,2,2,2],14:[1,1,2,2,2,2,2,2],
 15:[2,2,2,2,2,2,2,1],16:[2,2,2,2,2,2,2,2],
 17:[2,2,2,2,2,2,3,2],18:[2,2,2,2,2,2,3,3]
});
for(const sizes of Object.values(FRAME_SIZES))Object.freeze(sizes);
export function getFrameNumber(id,fieldSize=18){
 const total=Math.max(2,Math.min(18,Math.trunc(Number(fieldSize)||18)));
 const n=Math.max(1,Math.min(total,Math.trunc(Number(id)||1)));
 const sizes=FRAME_SIZES[total];
 let last=0;
 for(let i=0;i<sizes.length;i++){
   last+=sizes[i];
   if(n<=last)return i+1;
 }
 return sizes.length;
}
const darkText=(hex)=> {
 const value=hex.replace('#','');
 const r=parseInt(value.slice(0,2),16),g=parseInt(value.slice(2,4),16),b=parseInt(value.slice(4,6),16);
 return (r*.299+g*.587+b*.114)>155;
};
export function getHorseAppearance(id,fieldSize=18){
 const i=((Number(id)-1)%18+18)%18;
 const frame=getFrameNumber(i+1,fieldSize);
 const helmet=FRAME_COLORS[frame-1];
 return Object.freeze({
  coat:coats[i],frame,helmet,
  // The user-selected demonstration uniform is the SAME color as the frame cap.
  // This is not an official representation of an owner's registered racing silks.
  silk:helmet,
  silkAccent:helmet, // Jacket/sleeve stripes match the helmet exactly.
  saddleBase:'#20314c',saddleBorder:helmet,
  numberColor:'#ffffff',outline:'#27201d',leather:'#29201d',
  helmetNumberColor:darkText(helmet)?'#172331':'#ffffff'
 });
}
export const HORSE_APPEARANCES=Object.freeze(Array.from({length:18},(_,i)=>getHorseAppearance(i+1)));
