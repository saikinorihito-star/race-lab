import {summarizeRaces} from './engine.mjs';
self.onmessage = (event) => {
  const {horses, options, attempts} = event.data;
  try {
    const stats = summarizeRaces(horses, options, attempts, (done,total)=>self.postMessage({type:'progress',done,total}));
    self.postMessage({type:'result',stats});
  } catch (e) {self.postMessage({type:'error',message:e.message});}
};
