/* ══════════════════════════════════════════════════════
   CURSOR TRAIL — particles follow the mouse
══════════════════════════════════════════════════════ */
(function(){
  if(localStorage.getItem('cc_cursor_trail')!=='1')return;

  const COLORS=['#0ff4c6','#ff4f5e','#a78bfa','#ffc832'];
  const particles=[];
  const motionEnabled=()=>window.CC_THEME?.state().motion??!matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clearParticles(){particles.splice(0).forEach(p=>p.el.remove());}
  window.addEventListener('cc:theme-change',()=>{if(!motionEnabled())clearParticles();});
  let mouseX=0,mouseY=0,animRunning=false;

  document.addEventListener('mousemove',e=>{
    if(!motionEnabled())return;
    mouseX=e.clientX;mouseY=e.clientY;
    spawnParticle(mouseX,mouseY);
    if(!animRunning){animRunning=true;requestAnimationFrame(tick);}
  });

  function spawnParticle(x,y){
    const el=document.createElement('div');
    const size=Math.random()*6+3;
    const color=COLORS[Math.floor(Math.random()*COLORS.length)];
    el.style.cssText=`position:fixed;pointer-events:none;z-index:99999;border-radius:50%;width:${size}px;height:${size}px;background:${color};opacity:.75;transform:translate(-50%,-50%);left:${x}px;top:${y}px;transition:none`;
    document.body.appendChild(el);
    particles.push({el,x,y,vx:(Math.random()-.5)*1.5,vy:(Math.random()-.5)*1.5-1,life:1,decay:Math.random()*.04+.02,size});
  }

  function tick(){
    if(!motionEnabled()){clearParticles();animRunning=false;return;}
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx;p.y+=p.vy;p.vy+=.05;p.life-=p.decay;
      if(p.life<=0){p.el.remove();particles.splice(i,1);}
      else{p.el.style.left=p.x+'px';p.el.style.top=p.y+'px';p.el.style.opacity=p.life*.75;p.el.style.width=(p.size*p.life)+'px';p.el.style.height=(p.size*p.life)+'px';}
    }
    if(particles.length>0)requestAnimationFrame(tick);
    else animRunning=false;
  }
})();
