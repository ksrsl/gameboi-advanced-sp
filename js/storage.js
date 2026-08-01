const PREFIX='gba-sp:';
const listeners=new Set();

function notify(key,value){
  listeners.forEach(listener=>{
    try{listener(key,value)}catch{}
  });
}

export const storage={
  get(key,fallback=null){try{const value=localStorage.getItem(PREFIX+key);return value===null?fallback:JSON.parse(value)}catch{return fallback}},
  set(key,value){
    try{
      const serialized=JSON.stringify(value);
      if(localStorage.getItem(PREFIX+key)===serialized)return true;
      localStorage.setItem(PREFIX+key,serialized);
      notify(key,value);
      return true;
    }catch{return false}
  },
  remove(key){
    try{
      if(localStorage.getItem(PREFIX+key)===null)return;
      localStorage.removeItem(PREFIX+key);
      notify(key,null);
    }catch{}
  },
  subscribe(listener){
    if(typeof listener!=='function')return()=>{};
    listeners.add(listener);
    return()=>listeners.delete(listener);
  }
};
