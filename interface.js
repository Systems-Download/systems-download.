/* Navigation responds to scroll; keyboard/focus stays inside the mobile menu. */
(() => {
  const root=document.documentElement;
  function start(){
    const nav=document.querySelector('nav');let frame=0,compact=false;
    function sync(){
      frame=0;const glass=root.classList.contains('liquid-glass');
      if(!glass)compact=false;else if(scrollY>96)compact=true;else if(scrollY<32)compact=false;
      nav?.classList.toggle('cc-nav-compact',compact);
    }
    window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(sync);},{passive:true});
    window.addEventListener('cc:theme-change',sync);sync();
    // Replace noisy distortion with a smooth lens concentrated around the rim.
    const image=document.createElement('canvas');image.width=256;image.height=96;
    const context=image.getContext('2d'),pixels=context.createImageData(256,96);
    for(let y=0;y<96;y++)for(let x=0;x<256;x++){
      const cx=Math.max(48,Math.min(208,x)),dx=x-cx,dy=y-48,d=Math.hypot(dx,dy),depth=48-d;
      const strength=depth>=0?Math.exp(-depth/9)*Math.min(1,depth/3):0;
      const index=(y*256+x)*4;pixels.data[index]=128+(d?dx/d:0)*95*strength;pixels.data[index+1]=128+(d?dy/d:0)*95*strength;pixels.data[index+2]=128;pixels.data[index+3]=255;
    }
    context.putImageData(pixels,0,0);
    const filter=document.getElementById('cc-glass-refraction');
    if(filter){const lens=document.createElementNS('http://www.w3.org/2000/svg','feImage');lens.setAttribute('href',image.toDataURL());lens.setAttribute('x','0%');lens.setAttribute('y','0%');lens.setAttribute('width','100%');lens.setAttribute('height','100%');lens.setAttribute('preserveAspectRatio','none');lens.setAttribute('result','lens');filter.querySelector('feTurbulence')?.replaceWith(lens);}
    const drawer=document.getElementById('drawer'),burger=document.getElementById('burger-btn');
    if(!drawer||!burger)return;
    drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label',window.CC_I18N?.t('menu')||'Menu');drawer.tabIndex=-1;
    burger.setAttribute('aria-controls','drawer');burger.setAttribute('aria-expanded','false');
    const background=[...document.body.children].filter(el=>![drawer,document.getElementById('drawer-overlay')].includes(el)&&!['SCRIPT','STYLE'].includes(el.tagName));
    let wasOpen=false,originalInert=new Map(),focusBefore;
    function drawerState(){
      const open=drawer.classList.contains('open');burger.setAttribute('aria-expanded',String(open));drawer.inert=!open;
      if(open&&!wasOpen){
        focusBefore=document.activeElement;originalInert=new Map(background.map(el=>[el,el.inert]));background.forEach(el=>el.inert=true);
        const menu=drawer.querySelector('.drawer-nav');if(menu)menu.scrollTop=0;
        drawer.querySelector('.drawer-close')?.focus({preventScroll:true});
      }else if(!open&&wasOpen){originalInert.forEach((value,el)=>el.inert=value);focusBefore?.focus({preventScroll:true});}
      wasOpen=open;
    }
    new MutationObserver(drawerState).observe(drawer,{attributes:true,attributeFilter:['class']});drawerState();
    document.addEventListener('keydown',event=>{
      if(!drawer.classList.contains('open'))return;
      if(event.key==='Escape'){event.preventDefault();window.closeDrawer?.();}
      else if(event.key==='Tab'){
        const focusable=[...drawer.querySelectorAll('a[href],button,input,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
        const first=focusable[0],last=focusable.at(-1);if(!first){event.preventDefault();drawer.focus();}
        else if(event.shiftKey&&[first,drawer].includes(document.activeElement)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    drawer.querySelectorAll('a:not([href])').forEach(el=>{el.setAttribute('role','button');el.tabIndex=0;el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();el.click();}});});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
