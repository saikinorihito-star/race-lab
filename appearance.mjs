// Shared, stable visual palette. This does not change the race prediction model.
// The numbered silks are illustrative and do not represent real jockey uniforms.
const coats=['#7b4b31','#383333','#b46a3d','#c1bdb4','#62402b','#262b31',
 '#9e6948','#e3dfd5','#4e352b','#8c5b40','#343130','#bd8b5e',
 '#653f2e','#c8c4bb','#885f47','#39302c','#a2734a','#d4cfc2'];
const helmets=['#ffffff','#2869e6','#e53945','#efc83f','#3aa66b','#ff862f',
 '#ee6899','#6bd1ea','#9468d8','#161b24','#f0f0f0','#257ee0',
 '#db4657','#f2b733','#39aa6b','#f48d31','#e96aa1','#8d77db'];
const silks=['#e8edf3','#f4f4f4','#ffffff','#282d39','#f4f4f4','#f4f4f4',
 '#26334c','#25323d','#f7f2ec','#f8cd53','#25896a','#f5f1ec',
 '#ffffff','#222e3b','#f4e8ca','#3e4651','#f2f2f2','#ffffff'];
const darkText=(hex)=> {
 const value=hex.replace('#','');
 const r=parseInt(value.slice(0,2),16),g=parseInt(value.slice(2,4),16),b=parseInt(value.slice(4,6),16);
 return (r*.299+g*.587+b*.114)>155;
};
export function getHorseAppearance(id){
 const i=((Number(id)-1)%18+18)%18;
 const helmet=helmets[i];
 return Object.freeze({
  coat:coats[i],helmet,silk:silks[i],
  saddleBase:'#f8f4e9',saddleBorder:helmet,
  numberColor:'#162232', outline:'#27201d',
  helmetNumberColor:darkText(helmet)?'#20262c':'#ffffff'
 });
}
export const HORSE_APPEARANCES=Object.freeze(Array.from({length:18},(_,i)=>getHorseAppearance(i+1)));
