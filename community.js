/* Verified community actions, mention suggestions and grouped notifications. */
(() => {
  'use strict';
  const t=(key,...args)=>window.CC_I18N?.t(key,...args)||key;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const auth=()=>{try{return JSON.parse(localStorage.getItem('cc_auth')||'null');}catch{return null;}};
  let loginDialog,loginPending=null,groups=[],fetchedAt=null,refreshPromise=null,headerPanel,headerBell,headerBadge,poll;
  async function request(action,data={},token) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    const sessionToken=token===undefined?window.CC_QUESTIONS?.saved()?.token||null:token;
    try {
      const cfg=window.CC_CONFIG;
      const response=await fetch(cfg.SB_URL+'/rest/v1/rpc/cc_social_api',{
        method:'POST',signal:controller.signal,
        headers:{apikey:cfg.SB_KEY,Authorization:'Bearer '+cfg.SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_action:action,p_token:sessionToken,p_data:data})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.error){
        const error=new Error(['404','PGRST202'].includes(result.code||String(response.status))?t('community_setup'):result.error||result.message||t('community_failed'));
        error.code=result.code||String(response.status);
        if(error.code==='42501'&&sessionToken&&window.CC_QUESTIONS?.saved()?.token===sessionToken){
          try{localStorage.removeItem('cc_questions_session');}catch{}
          groups=[];fetchedAt=null;notify();
        }
        throw error;
      }
      return result;
    } catch(error){if(error.name==='AbortError')throw new Error(t('community_timeout'));throw error;}
    finally{clearTimeout(timer);}
  }
  async function ensureSession() {
    if(window.CC_QUESTIONS?.saved())return;
    if(loginPending)return loginPending;
    const account=auth();
    if(!account||account.bypassed||account._ownerTemp)throw new Error(t('community_sign_in'));
    loginPending=new Promise((resolve,reject)=>{
      loginDialog=node('dialog','cc-community-login q-compose');loginDialog.setAttribute('aria-labelledby','cc-community-title');
      const form=node('form'),heading=node('div','cc-community-heading'),title=node('h2','',t('community_confirm'));
      title.id='cc-community-title';const close=node('button','cc-theme-close','×');close.type='button';close.setAttribute('aria-label',t('close'));heading.append(title,close);
      const hint=node('p','q-muted',t('community_confirm_desc'));
      const label=node('label','cc-community-label',t('login_username')),name=node('input','q-input');name.autocomplete='username';name.required=true;name.maxLength=20;name.readOnly=!!account.rawUsername;name.value=account.rawUsername||account.username||'';label.append(name);
      const pwLabel=node('label','cc-community-label',t('login_password')),pw=node('input','q-input');pw.type='password';pw.autocomplete='current-password';pw.required=true;pw.maxLength=1024;pwLabel.append(pw);
      const error=node('p','q-alert');error.hidden=true;error.setAttribute('role','alert');
      const submit=node('button','q-button q-button-primary',t('community_continue'));submit.type='submit';
      form.append(heading,hint,label,pwLabel,error,submit);loginDialog.append(form);document.body.append(loginDialog);
      let completed=false;const trigger=document.activeElement;
      close.onclick=()=>loginDialog.close();
      loginDialog.addEventListener('close',()=>{pw.value='';loginDialog.remove();loginPending=null;if(!completed)reject(new Error(t('community_cancelled')));trigger?.focus({preventScroll:true});});
      form.onsubmit=async event=>{
        event.preventDefault();submit.disabled=true;error.hidden=true;
        try{
          const username=name.value.trim().toLowerCase();
          const session=await window.CC_QUESTIONS.login(username,pw.value);
          const identity=await window.CC_QUESTIONS.request('bootstrap',{},session.token);
          // Repair older website sessions which did not persist the database ID.
          const current=auth();
          if(!current||(current.rawUsername||current.username)!==(account.rawUsername||account.username))throw new Error(t('community_sign_in'));
          const sameAccount=String(current.id)===String(session.user_id);
          localStorage.setItem('cc_auth',JSON.stringify({...current,id:session.user_id,rawUsername:username,username:identity.user.name,isAdmin:identity.user.owner,
            role:sameAccount?current.role:identity.user.owner?'admin':'user',isBetaTester:sameAccount&&!!current.isBetaTester,isCoCreator:sameAccount&&!!current.isCoCreator,isPartner:sameAccount&&!!current.isPartner}));
          pw.value='';completed=true;loginDialog.close();window.dispatchEvent(new Event('cc:community-session'));resolve();
        }catch(e){error.textContent=e.message;error.hidden=false;}finally{submit.disabled=false;}
      };
      loginDialog.showModal();pw.focus();
    });
    return loginPending;
  }
  async function follow(userId,enabled) {await ensureSession();return request('follow',{user_id:String(userId),enabled:!!enabled});}
  async function followStats(userId) {
    try{return await request('follow_stats',{user_id:String(userId)});}
    catch(e){if(e.code==='42501')return request('follow_stats',{user_id:String(userId)},null);throw e;}
  }
  function renderBody(body) {
    const div=node('div','q-body'),pattern=/(^|[^\p{L}\p{N}_@])@([a-z0-9_-]{3,20})(?![\p{L}\p{N}_-])/giu;
    let end=0;
    for(const match of String(body).matchAll(pattern)){
      div.append(document.createTextNode(body.slice(end,match.index)+match[1]));
      const link=node('a','cc-mention','@'+match[2]);link.href='profile.html?user='+encodeURIComponent(match[2].toLowerCase());div.append(link);end=match.index+match[0].length;
    }
    div.append(document.createTextNode(body.slice(end)));return div;
  }
  function attachMentions(input) {
    if(input.dataset.mentions)return;input.dataset.mentions='1';
    const popup=node('div','cc-mention-menu');popup.hidden=true;popup.id=input.id+'-mentions';popup.setAttribute('role','listbox');popup.setAttribute('aria-label',t('mention_people'));
    input.after(popup);input.setAttribute('aria-controls',popup.id);input.setAttribute('aria-expanded','false');input.setAttribute('aria-autocomplete','list');
    let version=0,timer,items=[],selected=0,range=null;
    const close=()=>{++version;clearTimeout(timer);popup.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');items=[];range=null;};
    function current(){if(input.selectionStart!==input.selectionEnd)return null;const prefix=input.value.slice(0,input.selectionStart);const m=/(^|[^\p{L}\p{N}_@])@([a-z0-9_-]{1,20})$/iu.exec(prefix);return m?{start:input.selectionStart-m[2].length-1,end:input.selectionStart,query:m[2]}:null;}
    function select(index){selected=index;[...popup.children].forEach((el,i)=>el.setAttribute('aria-selected',String(i===index)));input.setAttribute('aria-activedescendant',popup.children[index]?.id||'');}
    function choose(index){const item=items[index];if(!item||!range)return;const cursor=range.start+item.username.length+2;input.setRangeText('@'+item.username+' ',range.start,range.end,'end');close();input.focus();input.setSelectionRange(cursor,cursor);input.dispatchEvent(new Event('input',{bubbles:true}));}
    function search(){
      clearTimeout(timer);const match=current(),sequence=++version;
      if(!match){close();return;}
      popup.hidden=true;input.setAttribute('aria-expanded','false');
      timer=setTimeout(async()=>{
        try{const result=await request('mention_search',{query:match.query});if(sequence!==version||document.activeElement!==input)return;
          items=result.users||[];range=match;popup.replaceChildren();
          items.forEach((user,i)=>{const option=node('button','cc-mention-option');option.type='button';option.id=popup.id+'-'+i;option.setAttribute('role','option');option.tabIndex=-1;option.append(node('strong','','@'+user.username),node('span','',user.name));option.onpointerdown=e=>e.preventDefault();option.onclick=()=>choose(i);popup.append(option);});
          popup.hidden=!items.length;input.setAttribute('aria-expanded',String(!!items.length));if(items.length)select(0);
        }catch{if(sequence===version)close();}
      },160);
    }
    input.addEventListener('input',search);input.addEventListener('click',search);
    input.addEventListener('blur',close);
    input.addEventListener('keydown',e=>{
      if(popup.hidden)return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();select((selected+(e.key==='ArrowDown'?1:-1)+items.length)%items.length);}
      else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();choose(selected);}
      else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
    });
    input.closest('dialog')?.addEventListener('close',close);
    const hint=node('p','q-muted cc-mention-hint',t('mention_hint'));popup.after(hint);window.addEventListener('cc:language-change',()=>{hint.textContent=t('mention_hint');popup.setAttribute('aria-label',t('mention_people'));});
  }
  function description(group) {
    const replies=group.reply_count,mentions=group.mention_count;
    if(replies&&mentions)return [t(replies===1?'notif_reply_one':'notif_reply_many',replies,group.reply_actor||group.actor),
      t(mentions===1?'notif_mention_one':'notif_mention_many',mentions,group.mention_actor||group.actor)].join(' · ');
    if(mentions)return t(mentions===1?'notif_mention_one':'notif_mention_many',mentions,group.mention_actor||group.actor);
    if(replies)return t(replies===1?'notif_reply_one':'notif_reply_many',replies,group.reply_actor||group.actor);
    return t('notif_activity_read');
  }
  async function refresh() {
    if(refreshPromise)return refreshPromise;
    if(!window.CC_QUESTIONS?.saved()){groups=[];fetchedAt=null;notify();return [];}
    const session=window.CC_QUESTIONS.saved().token;
    refreshPromise=(async()=>{
      const result=await request('notifications');
      if(window.CC_QUESTIONS?.saved()?.token!==session)return [];
      groups=result.groups||[];fetchedAt=result.fetched_at;notify();return groups;
    })().finally(()=>refreshPromise=null);
    return refreshPromise;
  }
  function notify(){renderHeader();window.dispatchEvent(new CustomEvent('cc:community-notifications',{detail:{groups:groups.slice(),fetchedAt}}));}
  async function markRead(threadId=null) {
    if(!fetchedAt)return;
    const through=fetchedAt;await request('notifications_read',{through,...(threadId?{thread_id:threadId}:{})});
    await refresh();
  }
  async function openGroup(group) {
    // Navigation still works when acknowledging the notification fails.
    try{await markRead(group.thread_id);}catch{}
    location.href='questions.html#'+group.thread_id;
  }
  function renderHeader() {
    if(!headerPanel)return;
    headerBell.hidden=!auth();
    const unread=groups.filter(g=>g.unread_count>0).length;headerBadge.hidden=!unread;headerBadge.textContent=unread>9?'9+':String(unread);
    const list=headerPanel.querySelector('.cc-social-list');list.replaceChildren();
    if(!groups.length)list.append(node('p','cc-social-empty',t('no_notifications')));
    for(const group of groups){const button=node('button','cc-social-item'+(group.unread_count?' unread':''));button.type='button';button.append(node('strong','',group.title),node('span','',description(group)),node('time','',new Date(group.created_at).toLocaleDateString(window.CC_I18N?.language||undefined)));button.onclick=()=>void openGroup(group);list.append(button);}
    const mark=headerPanel.querySelector('[data-mark]');mark.disabled=!unread;mark.textContent=t('mark_all_read');headerPanel.querySelector('h2').textContent=t('notifications');headerBell.setAttribute('aria-label',t('notifications'));
  }
  function headerNotifications() {
    if(document.getElementById('notif-bell'))return;
    const actions=document.querySelector('.q-nav-actions')||document.querySelector('nav>div');if(!actions)return;
    headerBell=node('button','q-button cc-social-bell','🔔');headerBell.type='button';headerBell.id='cc-social-bell';headerBell.setAttribute('aria-haspopup','true');headerBell.setAttribute('aria-expanded','false');
    headerBadge=node('span','cc-social-badge');headerBell.append(headerBadge);actions.prepend(headerBell);
    headerPanel=node('div','cc-social-panel');headerPanel.id='cc-social-panel';headerPanel.setAttribute('popover','auto');headerPanel.tabIndex=-1;
    const top=node('div','cc-social-heading'),title=node('h2','',t('notifications')),mark=node('button','q-button',t('mark_all_read'));mark.type='button';mark.dataset.mark='1';mark.onclick=async()=>{mark.disabled=true;try{await markRead();}catch(e){headerPanel.querySelector('[role=alert]').textContent=e.message;mark.disabled=false;}};
    top.append(title,mark);const error=node('p','cc-social-error');error.setAttribute('role','alert');headerPanel.append(top,error,node('div','cc-social-list'));document.body.append(headerPanel);
    function position(){if(!headerPanel.matches(':popover-open'))return;const rect=headerBell.getBoundingClientRect();headerPanel.style.left=Math.max(12,Math.min(rect.right-headerPanel.offsetWidth,innerWidth-headerPanel.offsetWidth-12))+'px';headerPanel.style.top=Math.min(rect.bottom+10,innerHeight-120)+'px';headerPanel.style.maxHeight=Math.max(100,innerHeight-rect.bottom-22)+'px';}
    headerBell.onclick=async()=>{
      if(headerPanel.matches(':popover-open')){headerPanel.hidePopover();return;}
      headerPanel.showPopover();position();headerPanel.focus({preventScroll:true});error.textContent='';
      try{await ensureSession();await refresh();position();}catch(e){error.textContent=e.message;}
    };
    headerPanel.addEventListener('toggle',event=>{headerBell.setAttribute('aria-expanded',String(event.newState==='open'));});
    headerPanel.addEventListener('keydown',event=>{if(event.key==='Escape'){headerPanel.hidePopover();headerBell.focus();}});
    window.addEventListener('resize',position);window.addEventListener('scroll',position,{passive:true,capture:true});renderHeader();
  }
  function start(){
    document.querySelectorAll('#q-body,#q-reply-body,#q-edited-reply').forEach(attachMentions);headerNotifications();
    void refresh().catch(()=>{});poll=setInterval(()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});},60000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});});
  }
  window.CC_SOCIAL={request,ensureSession,follow,followStats,renderBody,attachMentions,refresh,markRead,description,groups:()=>groups.slice()};
  window.addEventListener('cc:community-session',()=>void refresh().catch(()=>{}));
  window.addEventListener('cc:language-change',notify);
  window.addEventListener('storage',event=>{if(['cc_auth','cc_questions_session',null].includes(event.key)){groups=[];fetchedAt=null;notify();void refresh().catch(()=>{});}});
  window.addEventListener('pagehide',()=>clearInterval(poll));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
