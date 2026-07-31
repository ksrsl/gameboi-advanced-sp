import{storage}from'./storage.js';
import{registerCartridge,loadCartridge}from'./game-loader.js';
import snakeCartridge from'../games/snake/snake.js';

registerCartridge(snakeCartridge);
const $=s=>document.querySelector(s);
const screens=[...document.querySelectorAll('.screen')];
const home=$('#home'),host=$('#game-host'),menuButtons=[...document.querySelectorAll('#main-menu button')];
let menuIndex=0,currentGame=null,currentScreen='boot',currentPanel='';
let muted=storage.get('muted',false),audio;
let powerTimer=null;

function fitConsole(){
  const scaleX=window.innerWidth/320;
  const scaleY=window.innerHeight/240;
  $('#console').style.transform=`scale(${scaleX},${scaleY})`;
}
window.addEventListener('resize',fitConsole);
fitConsole();

function show(id){screens.forEach(s=>s.hidden=s.id!==id);currentScreen=id}
function tone(freq=440,duration=.06,type='square'){
  if(muted)return;
  try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}
}
function setMuted(value){muted=value;storage.set('muted',muted);$('#mute').textContent=muted?'×':'♪';$('#mute').setAttribute('aria-pressed',String(muted))}
function selectMenu(delta){menuIndex=(menuIndex+delta+menuButtons.length)%menuButtons.length;menuButtons.forEach((b,i)=>b.classList.toggle('selected',i===menuIndex));tone(210,.025)}
async function startGame(){show('loading');$('#loading-name').textContent='SNAKE BYTE';await new Promise(r=>setTimeout(r,350));try{currentGame=await loadCartridge('snake',host,{storage,tone,exit:exitGame});show('game-host')}catch(error){$('#error-message').textContent=error.message;show('error')}}
function exitGame(){currentGame?.unmount?.();currentGame=null;show('home')}
function powerOff(){
  if(currentScreen==='power-off'||currentScreen==='powering-off')return;
  const visible=screens.find(screen=>!screen.hidden);
  if(!visible)return;
  currentScreen='powering-off';
  $('#mute').hidden=true;
  visible.classList.remove('tv-off');
  void visible.offsetWidth;
  visible.classList.add('tv-off');
  tone(150,.18,'sawtooth');
  clearTimeout(powerTimer);
  powerTimer=setTimeout(()=>{show('power-off');visible.classList.remove('tv-off')},700);
}
function powerOn(){
  clearTimeout(powerTimer);
  $('#mute').hidden=false;
  home.classList.remove('tv-on');
  void home.offsetWidth;
  home.classList.add('tv-on');
  show('home');
  tone(420,.06);
  setTimeout(()=>tone(720,.08),80);
  setTimeout(()=>home.classList.remove('tv-on'),500);
}
function panel(title,html){currentPanel=title;$('#panel-title').textContent=title;$('#panel-content').innerHTML=html;show('panel')}
function action(name){
  tone(540,.04);
  if(name==='play')startGame();
  if(name==='scores')panel('HIGH SCORES',`<h2>SNAKE BYTE</h2><div class="big-score">${String(storage.get('snake:highScore',0)).padStart(5,'0')}</div><p>Best local score</p>`);
  if(name==='settings')panel('SETTINGS',`<div class="setting-row"><span>SOUND</span><button class="toggle" id="sound-setting">${muted?'OFF':'ON'}</button></div><div class="setting-row"><span>SAVE DATA</span><button class="toggle" id="clear-save">CLEAR</button></div><p>A TOGGLE SOUND • B BACK</p>`);
  if(name==='about')panel('ABOUT','<h2>KSR GAMEBOI SP</h2><p>KSR SYSTEM SOFTWARE v1.0</p><p>A tiny console built for Second Life Media on a Prim.</p><p>FIRST CARTRIDGE: SNAKE BYTE</p>');
  if(name==='power')powerOff();
}
function input(key,pressed=true){
  if(!pressed){currentGame?.input?.(key,false);return}
  if(currentScreen==='power-off'){
    if(key==='start'||key==='a')powerOn();
    return;
  }
  if(currentScreen==='powering-off')return;
  if(currentScreen==='home'){
    if(key==='up')selectMenu(-1);else if(key==='down')selectMenu(1);else if(key==='a'||key==='start')action(menuButtons[menuIndex].dataset.action);
  }else if(currentScreen==='panel'){
    if(key==='b'||key==='select')show('home');
    else if(key==='a'&&currentPanel==='SETTINGS'){setMuted(!muted);const soundButton=$('#sound-setting');if(soundButton)soundButton.textContent=muted?'OFF':'ON'}
  }
  else currentGame?.input?.(key,true);
}
const keyMap={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',z:'a',Z:'a',x:'b',X:'b',Enter:'start',Shift:'select'};
const validInputs=new Set(['up','down','left','right','a','b','start','select']);
function pressExternal(key){if(!validInputs.has(key))return;input(key,true);setTimeout(()=>input(key,false),35)}
function readHashInput(){const key=new URLSearchParams(location.hash.slice(1)).get('input');if(key)pressExternal(key.toLowerCase())}
window.GameBoiSP=Object.freeze({press:pressExternal});
window.addEventListener('hashchange',readHashInput);
document.addEventListener('gameboi-input',event=>pressExternal(String(event.detail?.key||'').toLowerCase()));
document.addEventListener('keydown',e=>{const key=keyMap[e.key];if(!key||e.repeat)return;e.preventDefault();input(key);document.querySelector(`[data-key="${key}"]`)?.classList.add('pressed')});
document.addEventListener('keyup',e=>{const key=keyMap[e.key];if(!key)return;e.preventDefault();input(key,false);document.querySelector(`[data-key="${key}"]`)?.classList.remove('pressed')});
document.querySelectorAll('[data-key]').forEach(button=>{const down=e=>{e.preventDefault();input(button.dataset.key);button.classList.add('pressed')};const up=e=>{e.preventDefault();input(button.dataset.key,false);button.classList.remove('pressed')};button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up)});
menuButtons.forEach((button,i)=>button.addEventListener('click',()=>{menuIndex=i;action(button.dataset.action)}));
$('#panel-back').addEventListener('click',()=>show('home'));$('#error-back').addEventListener('click',()=>show('home'));
$('#mute').addEventListener('click',()=>setMuted(!muted));
$('#panel-content').addEventListener('click',e=>{if(e.target.id==='sound-setting'){setMuted(!muted);e.target.textContent=muted?'OFF':'ON'}if(e.target.id==='clear-save'&&confirm('Clear all GameBoi save data?')){storage.remove('snake:highScore');e.target.textContent='CLEARED'}});
setMuted(muted);setTimeout(()=>{show('home');tone(660,.08);setTimeout(()=>tone(880,.1),90)},1900);
