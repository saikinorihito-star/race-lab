// Shared, stable visual palette. This does not change the race prediction model.
// Both cap and jacket follow the JRA-style frame palette as a simulator convention.
const coats=['#7b4b31','#383333','#b46a3d','#c1bdb4','#62402b','#262b31',
 '#9e6948','#e3dfd5','#4e352b','#8c5b40','#343130','#bd8b5e',
 '#653f2e','#c8c4bb','#885f47','#39302c','#a2734a','#d4cfc2'];
// JRA 18-runner field: 1-12 two runners per frame, 13-15 in 7, 16-18 in 8.
export const FRAME_COLORS=Object.freeze(['#f9f9f9','#16181e','#dc293d','#246cde','#f4d444','#2aa365','#f18421','#e87ca6']);
export function getFrameNumber(id){
 const n=Math.max(1,Math.min(18,Number(id)||1));
 return n<=12?Math.ceil(n/2):n<=15?7:8;
}
const darkText=(hex)=> {
 const value=hex.replace('#','');
 const r=parseInt(value.slice(0,2),16),g=parseInt(value.slice(2,4),16),b=parseInt(value.slice(4,6),16);
 return (r*.299+g*.587+b*.114)>155;
};
export function getHorseAppearance(id){
 const i=((Number(id)-1)%18+18)%18;
 const frame=getFrameNumber(i+1);
 const helmet=FRAME_COLORS[frame-1];
 return Object.freeze({
  coat:coats[i],frame,helmet,
  // The user-selected demonstration uniform is the SAME color as the frame cap.
  // This is not an official representation of an owner's registered racing silks.
  silk:helmet,
  silkAccent:darkText(helmet)?'#243042':'#f5f7fc',
  saddleBase:'#20314c',saddleBorder:helmet,
  numberColor:'#ffffff',outline:'#27201d',leather:'#29201d',
  helmetNumberColor:darkText(helmet)?'#172331':'#ffffff'
 });
}
export const HORSE_APPEARANCES=Object.freeze(Array.from({length:18},(_,i)=>getHorseAppearance(i+1)));
