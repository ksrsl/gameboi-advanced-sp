import { createGameContext, safeDelta, smoothToward } from '../../js/render-utils.js?v=3.0.0';

const WIDTH = 320, HEIGHT = 240;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const UPGRADES = [
  { name: 'RAPID CORE', copy: 'FASTER AUTO FIRE', apply: stats => { stats.fireRate *= .82; } },
  { name: 'POWER CELL', copy: 'MORE DAMAGE', apply: stats => { stats.damage += 1; } },
  { name: 'VECTOR BOOTS', copy: 'MOVE FASTER', apply: stats => { stats.speed += 13; } },
  { name: 'ARMOR PLATE', copy: '+30 MAX HEALTH', apply: stats => { stats.maxHealth += 30; stats.health += 30; } },
  { name: 'TWIN SHOT', copy: 'EXTRA PROJECTILE', apply: stats => { stats.shots = Math.min(4, stats.shots + 1); } },
  { name: 'MAGNET FIELD', copy: 'WIDER PICKUP RANGE', apply: stats => { stats.magnet += 22; } }
];

export default {
  id: 'survivor-byte', title: 'Neon Onslaught', version: '1.0.0',
  create() {
    let root, canvas, ctx, services, frame = 0, previousTime = 0;
    let state = 'title', player, enemies = [], shots = [], orbs = [], particles = [];
    let stats, score = 0, high = 0, elapsed = 0, bestTime = 0, spawnTimer = 0;
    let level = 1, xp = 0, nextXp = 7, choiceIndex = 0, choices = [], bossClock = 0;
    let held = { left:false, right:false, up:false, down:false }, touchVector = null;

    const markup = () => `<div class="survivor-game">
      <canvas width="640" height="480" aria-label="Neon Onslaught arena"></canvas>
      <div class="survivor-hud"><span>LV <b id="survivor-level">01</b></span><span>KO <b id="survivor-score">000000</b></span><span>TIME <b id="survivor-time">00:00</b></span><span>HI <b id="survivor-hi">000000</b></span></div>
      <div class="survivor-bars"><i id="survivor-health"></i><i id="survivor-xp"></i></div>
      <div class="survivor-charge">PULSE <b id="survivor-charge">000</b></div>
      <div class="survivor-overlay" id="survivor-overlay"><strong>NEON ONSLAUGHT</strong><small>OUTLAST THE SWARM<br>WEAPONS FIRE AUTOMATICALLY</small><button data-survivor="start">DEPLOY</button><em>D-PAD MOVE - A DASH - B PULSE</em></div>
      <div class="survivor-pause" id="survivor-pause" hidden>PAUSED</div>
      <button class="survivor-exit" data-survivor="exit" aria-label="Exit game">X</button>
    </div>`;

    function reset() {
      player = { x:160, y:132, vx:0, vy:0, radius:7, invuln:0, dash:0, fire:0, charge:0 };
      stats = { health:100, maxHealth:100, speed:86, damage:1, fireRate:.48, shots:1, magnet:42 };
      enemies=[]; shots=[]; orbs=[]; particles=[]; score=0; elapsed=0; spawnTimer=.5; bossClock=0;
      level=1; xp=0; nextXp=7; choiceIndex=0; choices=[]; held={left:false,right:false,up:false,down:false}; touchVector=null;
    }

    function timeText(value) { return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(Math.floor(value%60)).padStart(2,'0')}`; }
    function updateHud() {
      if (!root) return;
      root.querySelector('#survivor-level').textContent=String(level).padStart(2,'0');
      root.querySelector('#survivor-score').textContent=String(score).padStart(6,'0');
      root.querySelector('#survivor-time').textContent=timeText(elapsed);
      root.querySelector('#survivor-hi').textContent=String(high).padStart(6,'0');
      root.querySelector('#survivor-health').style.width=`${100*stats.health/stats.maxHealth}%`;
      root.querySelector('#survivor-xp').style.width=`${100*xp/nextXp}%`;
      root.querySelector('#survivor-charge').textContent=String(Math.floor(player.charge)).padStart(3,'0');
    }

    function showOverlay(title, copy, button) {
      const overlay=root.querySelector('#survivor-overlay'); overlay.hidden=false;
      overlay.innerHTML=`<strong>${title}</strong><small>${copy}</small><button data-survivor="start">${button}</button><em>D-PAD MOVE - A DASH - B PULSE</em>`;
    }
    function renderUi() {
      root.querySelector('#survivor-pause').hidden=state!=='pause';
      if(state==='title') showOverlay('NEON ONSLAUGHT',`BEST ${timeText(bestTime)}<br>WEAPONS FIRE AUTOMATICALLY`,'DEPLOY');
      else if(state==='over') showOverlay('SIGNAL LOST',`${timeText(elapsed)} SURVIVED<br>${score} KNOCKOUT POINTS`,'REDEPLOY');
      else if(state==='level') renderUpgrade();
      else root.querySelector('#survivor-overlay').hidden=true;
      updateHud();
    }

    function start(){reset();state='play';services.tone(310,.07,'sawtooth');renderUi();}
    function chooseUpgrades(){
      const startAt=(level*2)%UPGRADES.length;
      choices=[UPGRADES[startAt],UPGRADES[(startAt+1)%UPGRADES.length],UPGRADES[(startAt+3)%UPGRADES.length]];
      choiceIndex=0;state='level';services.tone(780,.1,'triangle');renderUi();
    }
    function renderUpgrade(){
      const overlay=root.querySelector('#survivor-overlay');overlay.hidden=false;
      overlay.innerHTML=`<strong>SYSTEM UPGRADE</strong><small>${choices.map((choice,index)=>`${index===choiceIndex?'&gt;':'&nbsp;'} ${choice.name}<br><i>${choice.copy}</i>`).join('')}</small><button data-survivor="choose">INSTALL</button><em>LEFT / RIGHT CHOOSE - A INSTALL</em>`;
    }
    function install(){if(state!=='level')return;choices[choiceIndex].apply(stats);state='play';services.tone(940,.09,'triangle');renderUi();}

    function spawnEnemy(){
      const edge=Math.floor(Math.random()*4);let x,y;if(edge===0){x=-10;y=35+Math.random()*190;}else if(edge===1){x=330;y=35+Math.random()*190;}else if(edge===2){x=15+Math.random()*290;y=27;}else{x=15+Math.random()*290;y=235;}
      const boss=bossClock>=42; if(boss)bossClock=0;
      const type=boss?2:(Math.random()<Math.min(.45,elapsed/150)?1:0);
      enemies.push({x,y,r:type===2?13:type===1?8:6,hp:type===2?24+level*3:type===1?5+level:2+Math.floor(level/3),speed:type===2?27:type===1?46:35+Math.min(28,elapsed*.18),type,phase:Math.random()*6.28,hit:0});
    }

    function nearestEnemy(){let best=null,dist=Infinity;enemies.forEach(enemy=>{const d=Math.hypot(enemy.x-player.x,enemy.y-player.y);if(d<dist){dist=d;best=enemy;}});return best;}
    function autoFire(){
      const target=nearestEnemy();if(!target)return;const base=Math.atan2(target.y-player.y,target.x-player.x);
      for(let i=0;i<stats.shots;i+=1){const spread=(i-(stats.shots-1)/2)*.14;shots.push({x:player.x,y:player.y,vx:Math.cos(base+spread)*185,vy:Math.sin(base+spread)*185,life:1.25,damage:stats.damage});}
      services.tone(330+stats.shots*35,.018,'square');
    }
    function burst(x,y,color,count=6){for(let i=0;i<count;i+=1)particles.push({x,y,vx:(Math.random()-.5)*70,vy:(Math.random()-.5)*70,life:.35,color});}
    function kill(enemy){score+=enemy.type===2?500:enemy.type===1?60:20;player.charge=clamp(player.charge+(enemy.type===2?40:enemy.type===1?12:5),0,100);orbs.push({x:enemy.x,y:enemy.y,value:enemy.type===2?6:enemy.type===1?2:1});burst(enemy.x,enemy.y,enemy.type===2?'#ffffff':'#86cce8',enemy.type===2?18:7);high=Math.max(high,score);services.storage.set('survivorByte:highScore',high);}

    function dash(){if(state!=='play'||player.dash>0)return;let dx=(held.right?1:0)-(held.left?1:0),dy=(held.down?1:0)-(held.up?1:0);if(touchVector){dx=touchVector.x;dy=touchVector.y;}const len=Math.hypot(dx,dy)||1;player.x=clamp(player.x+dx/len*31,14,306);player.y=clamp(player.y+dy/len*31,34,226);player.dash=1.15;player.invuln=.32;burst(player.x,player.y,'#dff7ff',12);services.tone(620,.055,'sawtooth');}
    function pulse(){if(state!=='play'||player.charge<100)return;player.charge=0;enemies.forEach(enemy=>{const d=Math.hypot(enemy.x-player.x,enemy.y-player.y);if(d<92){enemy.hp-=8;enemy.x+=(enemy.x-player.x)/(d||1)*25;enemy.y+=(enemy.y-player.y)/(d||1)*25;}});burst(player.x,player.y,'#b6ebff',28);services.tone(165,.16,'sawtooth');}

    function gameOver(){state='over';bestTime=Math.max(bestTime,elapsed);services.storage.set('survivorByte:bestTime',bestTime);services.tone(95,.2,'sawtooth');renderUi();}
    function update(dt){
      particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);
      if(state!=='play')return;elapsed+=dt;bossClock+=dt;player.invuln=Math.max(0,player.invuln-dt);player.dash=Math.max(0,player.dash-dt);player.fire-=dt;
      let dx=(held.right?1:0)-(held.left?1:0),dy=(held.down?1:0)-(held.up?1:0);if(touchVector){dx=touchVector.x;dy=touchVector.y;}const len=Math.hypot(dx,dy);if(len){dx/=len;dy/=len;}
      player.vx=smoothToward(player.vx,dx*stats.speed,13,dt);player.vy=smoothToward(player.vy,dy*stats.speed,13,dt);player.x=clamp(player.x+player.vx*dt,12,308);player.y=clamp(player.y+player.vy*dt,32,228);
      spawnTimer-=dt;if(spawnTimer<=0){spawnEnemy();if(elapsed>25&&Math.random()<.28)spawnEnemy();spawnTimer=Math.max(.16,.72-elapsed*.006);}
      if(player.fire<=0){autoFire();player.fire=stats.fireRate;}
      shots.forEach(shot=>{shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;enemies.forEach(enemy=>{if(shot.life>0&&enemy.hp>0&&Math.hypot(shot.x-enemy.x,shot.y-enemy.y)<enemy.r+3){enemy.hp-=shot.damage;enemy.hit=.09;shot.life=0;if(enemy.hp<=0)kill(enemy);}});});shots=shots.filter(shot=>shot.life>0&&shot.x>-5&&shot.x<325&&shot.y>25&&shot.y<245);enemies=enemies.filter(enemy=>enemy.hp>0);
      enemies.forEach(enemy=>{enemy.phase+=dt;enemy.hit=Math.max(0,enemy.hit-dt);const angle=Math.atan2(player.y-enemy.y,player.x-enemy.x)+Math.sin(enemy.phase*2)*.08;enemy.x+=Math.cos(angle)*enemy.speed*dt;enemy.y+=Math.sin(angle)*enemy.speed*dt;if(Math.hypot(enemy.x-player.x,enemy.y-player.y)<enemy.r+player.radius&&player.invuln<=0){stats.health-=enemy.type===2?24:enemy.type===1?16:10;player.invuln=.7;enemy.x-=Math.cos(angle)*18;enemy.y-=Math.sin(angle)*18;services.tone(105,.08,'square');if(stats.health<=0)gameOver();}});
      orbs.forEach(orb=>{const d=Math.hypot(orb.x-player.x,orb.y-player.y);if(d<stats.magnet){orb.x+=(player.x-orb.x)*dt*7;orb.y+=(player.y-orb.y)*dt*7;}if(d<10){xp+=orb.value;orb.taken=true;}});orbs=orbs.filter(orb=>!orb.taken);
      if(xp>=nextXp){xp-=nextXp;level+=1;nextXp=Math.floor(nextXp*1.32+3);chooseUpgrades();}
      updateHud();
    }

    function draw(){
      const bg=ctx.createLinearGradient(0,28,0,240);bg.addColorStop(0,'#18232b');bg.addColorStop(1,'#070a0d');ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.strokeStyle='#ffffff0b';ctx.lineWidth=1;for(let x=0;x<WIDTH;x+=20){ctx.beginPath();ctx.moveTo(x,28);ctx.lineTo(x,240);ctx.stroke();}for(let y=32;y<HEIGHT;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(320,y);ctx.stroke();}
      orbs.forEach(orb=>{ctx.fillStyle='#9fe7ff';ctx.beginPath();ctx.arc(orb.x,orb.y,2+orb.value*.25,0,Math.PI*2);ctx.fill();});
      shots.forEach(shot=>{ctx.fillStyle='#f7fbff';ctx.shadowColor='#9fe7ff';ctx.shadowBlur=5;ctx.beginPath();ctx.arc(shot.x,shot.y,2.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;});
      enemies.forEach(enemy=>{ctx.save();ctx.translate(enemy.x,enemy.y);ctx.rotate(enemy.phase*.25);ctx.fillStyle=enemy.hit?'#fff':enemy.type===2?'#d8c7e8':enemy.type===1?'#7996a8':'#394c59';ctx.beginPath();const sides=enemy.type===2?8:6;for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides;(i?ctx.lineTo.bind(ctx):ctx.moveTo.bind(ctx))(Math.cos(a)*enemy.r,Math.sin(a)*enemy.r);}ctx.closePath();ctx.fill();ctx.fillStyle='#080a0c';ctx.fillRect(-2,-2,4,4);ctx.restore();});
      particles.forEach(p=>{ctx.globalAlpha=clamp(p.life*3,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,2,2);});ctx.globalAlpha=1;
      ctx.save();ctx.translate(player.x,player.y);ctx.rotate(performance.now()*.001);ctx.fillStyle=player.invuln>0&&Math.floor(performance.now()/70)%2?'#73808a':'#f5f7f8';ctx.fillRect(-6,-6,12,12);ctx.fillStyle='#10151a';ctx.fillRect(-2,-2,4,4);ctx.restore();
    }
    function loop(time){const dt=safeDelta(time,previousTime,.034);previousTime=time;update(dt);draw();frame=requestAnimationFrame(loop);}

    return {async mount(host,provided){services=provided;high=services.storage.get('survivorByte:highScore',0);bestTime=services.storage.get('survivorByte:bestTime',0);host.innerHTML=markup();root=host.firstElementChild;canvas=root.querySelector('canvas');ctx=createGameContext(canvas,WIDTH,HEIGHT);reset();state='title';renderUi();previousTime=performance.now();frame=requestAnimationFrame(loop);root.addEventListener('click',event=>{const action=event.target.closest?.('[data-survivor]')?.dataset.survivor;if(action==='start')start();if(action==='choose')install();if(action==='exit')services.exit();});canvas.addEventListener('pointerdown',event=>{const rect=canvas.getBoundingClientRect();const x=(event.clientX-rect.left)*WIDTH/rect.width-player.x,y=(event.clientY-rect.top)*HEIGHT/rect.height-player.y,l=Math.hypot(x,y)||1;touchVector={x:x/l,y:y/l};});canvas.addEventListener('pointerup',()=>{touchVector=null;});canvas.addEventListener('pointercancel',()=>{touchVector=null;});},input(key,down){if(['left','right','up','down'].includes(key))held[key]=down;if(!down)return;if((key==='a'||key==='start')&&(state==='title'||state==='over'))start();else if(state==='level'){if(key==='left')choiceIndex=(choiceIndex+choices.length-1)%choices.length;if(key==='right')choiceIndex=(choiceIndex+1)%choices.length;if(key==='a'||key==='start')install();else renderUi();}else if(key==='start'){state=state==='pause'?'play':'pause';renderUi();}else if(state==='play'){if(key==='a')dash();if(key==='b')pulse();}if(key==='select')services.exit();},setAuthority(){},unmount(){cancelAnimationFrame(frame);}};
  }
};
