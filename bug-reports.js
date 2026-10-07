/* Bug report persistence and page UI. Translated interface strings live in i18n.js. */
(function(){
  const sessionKey='cc_bugs_session',receiptKey='cc_bug_receipts';
  const t=(key,...args)=>window.CC_I18N.t(key,...args);
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  let ignoreQuestions=false;
  function session(){
    const own=read(sessionKey);
    if(own?.token&&Date.parse(own.expires_at)>Date.now())return own;
    return ignoreQuestions?null:window.CC_QUESTIONS?.saved()||null;
  }
  async function request(action,data={},token=session()?.token||null){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const c=window.CC_CONFIG;
      const response=await fetch(c.SB_URL+'/rest/v1/rpc/cc_bug_reports_api',{
        method:'POST',signal:controller.signal,
        headers:{apikey:c.SB_KEY,Authorization:'Bearer '+c.SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_action:action,p_token:token,p_data:data})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok||body.error){
        const code=body.code||String(response.status);
        const key=code==='PGRST202'||response.status===404?'bug_setup_needed':code==='40001'?'bug_conflict':code==='54000'?'bug_rate_limit':code==='42501'?'bug_signin_error':'bug_request_failed';
        throw Object.assign(new Error(t(key)),{code});
      }
      return body;
    }catch(e){if(e.name==='AbortError')throw new Error(t('bug_timeout'));throw e;}
    finally{clearTimeout(timer);}
  }
  async function login(username,password){
    const result=await request('login',{username,password},null);
    if(!write(sessionKey,result))throw new Error(t('bug_storage_failed'));
    ignoreQuestions=false;return result;
  }
  async function logout(){
    const own=read(sessionKey);try{localStorage.removeItem(sessionKey);}catch{}
    ignoreQuestions=true;
    if(own?.token)await request('logout',{},own.token).catch(()=>{});
  }
  window.CC_BUG_REPORTS={request,login,logout,session};

  if(document.documentElement.dataset.ccPage!=='bugreport')return;
  const $=id=>document.getElementById(id);
  const statusKeys={'open':'bug_status_open','in-progress':'bug_status_progress','fixed':'bug_status_fixed','closed':'bug_status_closed'};
  let verifiedUser=null,rows=[],total=0,offset=0,listVersion=0,detailVersion=0;
  let pending=null,submitting=false,detail=null,currentReceipt=null;
  function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
  function label(tag,key,className){const el=node(tag,t(key),className);el.dataset.t=key;return el;}
  function message(id,text,error=false){const el=$(id);el.textContent=text;el.hidden=!text;el.classList.toggle('is-error',error);}
  function date(value){return new Date(value).toLocaleString(CC_I18N.language,{dateStyle:'medium',timeStyle:'short'});}
  function receiptURL(id,receipt){const url=new URL(location.href);url.hash=new URLSearchParams({report:id,key:receipt}).toString();return url.href;}
  function receipts(){const saved=read(receiptKey);return Array.isArray(saved)?saved.filter(r=>/^[0-9a-f-]{36}$/i.test(r.id)&&/^[0-9a-f]{64}$/.test(r.receipt)).slice(0,50):[];}
  function renderReceipts(){
    const box=$('local-reports');box.replaceChildren();
    for(const r of receipts()){
      const button=node('button',r.title||r.id,'report-receipt');button.type='button';
      button.onclick=()=>openDetail(r.id,r.receipt);box.append(button);
    }
    $('local-reports-wrap').hidden=!box.children.length;
  }
  function renderList(){
    const list=$('reports-list');list.replaceChildren();
    for(const report of rows){
      const button=node('button',undefined,'report-row');button.type='button';
      button.append(node('strong',report.title),node('span',report.tool==='website'?t('bug_tool_website'):report.tool==='other'?t('bug_tool_other'):report.tool[0].toUpperCase()+report.tool.slice(1),'report-tool'));
      const badge=label('span',statusKeys[report.status],'report-status');badge.dataset.status=report.status;
      button.append(badge,node('small',date(report.updated_at)));button.onclick=()=>openDetail(report.id);list.append(button);
    }
    $('reports-empty').hidden=rows.length>0;
    $('reports-prev').disabled=offset===0;$('reports-next').disabled=offset+20>=total;
    $('reports-count').textContent=t('bug_report_count',total);
    CC_I18N.apply(list);
  }
  async function loadReports(){
    if(!verifiedUser)return;
    const version=++listVersion;message('reports-message',t('loading'));
    try{
      const result=await request('list',{status:$('reports-filter').value,offset});
      if(version!==listVersion)return;
      rows=result.items;total=result.total;renderList();message('reports-message','');
    }catch(e){if(version===listVersion)message('reports-message',e.message,true);}
  }
  async function refreshIdentity(){
    try{
      const result=await request('bootstrap');if(verifiedUser?.id!==result.user?.id)offset=0;verifiedUser=result.user;
      $('report-login').hidden=!!verifiedUser;$('report-account').hidden=!verifiedUser;
      $('account-report-list').hidden=!verifiedUser;$('auth-notice').hidden=!!verifiedUser;
      $('reports-heading').dataset.t=verifiedUser?.owner?'bug_manage_reports':'bug_my_reports';
      $('info-user').textContent=verifiedUser?.name||t('bug_anonymous');
      $('report-account-name').textContent=verifiedUser?.name||'';
      CC_I18N.apply();if(verifiedUser)await loadReports();
    }catch(e){
      verifiedUser=null;message('reports-message',e.message,true);
      $('report-login').hidden=false;$('account-report-list').hidden=true;
      $('report-account').hidden=true;$('reports-heading').dataset.t='bug_my_reports';
      $('info-user').textContent=t('bug_anonymous');
      $('report-dialog').close();detail=null;rows=[];
      $('auth-notice').hidden=false;
      if(e.code==='42501'){try{localStorage.removeItem(sessionKey);}catch{}ignoreQuestions=true;}
    }
  }
  $('report-login').addEventListener('submit',async event=>{
    event.preventDefault();const button=$('report-login-button');button.disabled=true;
    try{await login($('report-username').value.trim(),$('report-password').value);$('report-password').value='';await refreshIdentity();}
    catch(e){message('reports-message',e.message,true);}
    finally{button.disabled=false;}
  });
  $('report-logout').onclick=async()=>{await logout();rows=[];verifiedUser=null;await refreshIdentity();};
  $('reports-filter').onchange=()=>{offset=0;void loadReports();};
  $('reports-refresh').onclick=()=>loadReports();
  $('reports-prev').onclick=()=>{offset=Math.max(0,offset-20);void loadReports();};
  $('reports-next').onclick=()=>{offset+=20;void loadReports();};

  async function openDetail(id,receipt=null){
    const version=++detailVersion;currentReceipt=receipt;message('reports-message',t('loading'));
    try{
      const result=await request('detail',{id,receipt});if(version!==detailVersion)return;
      detail=result;renderDetail();message('reports-message','');
      if(!$('report-dialog').open)$('report-dialog').showModal();
    }catch(e){if(version===detailVersion)message('reports-message',e.message,true);}
  }
  function renderDetail(){
    const report=detail.report,body=$('report-detail');body.replaceChildren();
    const badge=label('span',statusKeys[report.status],'report-status');badge.dataset.status=report.status;
    body.append(node('h2',report.title),node('small',report.id+' · '+date(report.created_at)),badge);
    for(const [key,value] of [['bug_tool',report.tool],['bug_version',report.version],['bugreport_desc',report.description],['bug_error_message',report.error_message],['bug_steps',report.steps_to_reproduce],['bug_owner_note',report.owner_note]]){
      if(!value)continue;body.append(label('h3',key),node('p',value,'report-text'));
    }
    if(report.screenshot_url){const link=label('a','bug_screenshot');link.href=report.screenshot_url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);}
    body.append(label('h3','bug_history'));
    for(const entry of detail.history){const item=node('div',undefined,'report-history');item.append(label('strong',statusKeys[entry.status]),node('small',date(entry.changed_at)));if(entry.note)item.append(node('p',entry.note,'report-text'));body.append(item);}
    $('owner-status-form').hidden=!detail.can_manage;
    $('owner-status').value=report.status;$('owner-note').value=report.owner_note||'';
    message('detail-message','');CC_I18N.apply($('report-dialog'));
  }
  $('report-close').onclick=()=>$('report-dialog').close();
  $('owner-status-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!detail?.can_manage)return;
    const button=$('owner-status-save');button.disabled=true;message('detail-message',t('loading'));
    try{
      detail=await request('status',{id:detail.report.id,status:$('owner-status').value,note:$('owner-note').value,revision:detail.report.revision});
      renderDetail();message('detail-message',t('bug_status_saved'));await loadReports();
    }catch(e){message('detail-message',e.message,true);}
    finally{button.disabled=false;}
  });
  $('report-dialog').addEventListener('close',()=>{detailVersion++;});

  function updateCounter(input){const counter=$(input.dataset.counter);if(counter)counter.textContent=input.value.length+' / '+input.maxLength;}
  document.querySelectorAll('[data-counter]').forEach(input=>input.addEventListener('input',()=>updateCounter(input)));
  $('f-no-error').onchange=()=>{$('f-error').disabled=$('f-no-error').checked;$('f-error').required=!$('f-no-error').checked;};
  function formData(){return {
    tool:$('f-tool').value,version:$('f-version').value.trim(),title:$('f-title').value.trim(),description:$('f-desc').value.trim(),
    error_message:$('f-no-error').checked?t('bug_no_error'):$('f-error').value.trim(),steps_to_reproduce:$('f-steps').value.trim(),
    category:$('f-category').value,severity:$('f-severity').value,screenshot_url:$('f-screenshot').value.trim()||null,
    browser:navigator.userAgent,page:location.href.split('#')[0]
  };}
  function createReceipt(){return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');}
  async function notifyDiscord(data,result){
    if(result.duplicate)return;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    const fields=[['Tool',data.tool],['Version',data.version],['Reporter',verifiedUser?.name||'Anonymous'],['Category',data.category],['Severity',data.severity],['Status','Open'],['Report ID',result.id],['Description',data.description],['Error message',data.error_message],['Steps to reproduce',data.steps_to_reproduce]];
    try{
      const response=await fetch(CC_CONFIG.DISCORD_WEBHOOK,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Bug Report Bot',allowed_mentions:{parse:[]},embeds:[{title:'🐛 '+data.title,color:0xff4f5e,fields:fields.map(([name,value])=>({name,value:String(value).slice(0,1024),inline:false})),footer:{text:'Systems Download • '+result.id}}]})});
      if(!response.ok)throw new Error('Discord');
    }catch{message('success-warning',t('bug_discord_pending'));}
    finally{clearTimeout(timer);}
  }
  $('bug-form').addEventListener('submit',async event=>{
    event.preventDefault();if(submitting)return;
    const data=formData(),fingerprint=JSON.stringify(data);
    if(data.title.length<5||data.description.length<20||data.steps_to_reproduce.length<5||!data.version||!data.error_message){message('form-err',t('bug_required'),true);return;}
    if(data.screenshot_url){try{const url=new URL(data.screenshot_url);if(!['http:','https:'].includes(url.protocol)||data.screenshot_url.length>1000)throw new Error();}catch{message('form-err',t('bug_invalid_url'),true);return;}}
    if(!pending||pending.fingerprint!==fingerprint)pending={id:crypto.randomUUID(),receipt:createReceipt(),fingerprint};
    submitting=true;$('submit-btn').disabled=true;$('submit-btn').textContent=t('bug_sending');message('form-err','');
    try{
      const result=await request('create',{...data,id:pending.id,receipt:pending.receipt});
      const saved=receipts().filter(r=>r.id!==result.id);saved.unshift({id:result.id,receipt:pending.receipt,title:data.title});
      if(!write(receiptKey,saved.slice(0,50)))message('success-warning',t('bug_storage_failed'));
      const link=receiptURL(result.id,pending.receipt);$('success-link').value=link;$('success-track').onclick=()=>openDetail(result.id,pending.receipt);
      $('success-id').textContent=result.id;$('form-card').hidden=true;$('success-card').hidden=false;
      $('success-card').classList.add('vis');renderReceipts();await loadReports();
      // Supabase is authoritative. A Discord failure cannot turn a saved report into a failed submission.
      void notifyDiscord(data,result);window.scrollTo({top:0,behavior:CC_THEME.state().motion?'smooth':'auto'});
    }catch(e){message('form-err',e.message,true);}
    finally{submitting=false;$('submit-btn').disabled=false;$('submit-btn').textContent=t('bugreport_send');}
  });
  $('success-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('success-link').value);$('success-copy').textContent=t('copied');}catch{$('success-link').focus();$('success-link').select();}};
  $('success-new').onclick=()=>{pending=null;$('bug-form').reset();$('f-error').disabled=false;$('f-error').required=true;document.querySelectorAll('[data-counter]').forEach(updateCounter);$('form-card').hidden=false;$('success-card').hidden=true;$('success-card').classList.remove('vis');message('success-warning','');};
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!$('report-dialog').open&&!$('form-card').hidden){event.preventDefault();$('bug-form').requestSubmit();}});
  window.addEventListener('cc:language-change',()=>{renderList();$('info-user').textContent=verifiedUser?.name||t('bug_anonymous');renderReceipts();});
  window.addEventListener('storage',event=>{
    if(event.key===receiptKey)renderReceipts();
    if(event.key==='cc_auth'||event.key===sessionKey||event.key===null){if(event.key==='cc_auth'){try{localStorage.removeItem(sessionKey);}catch{}}void refreshIdentity();}
  });
  $('info-browser').textContent=navigator.userAgent.replace(/^Mozilla\/5\.0\s*/,'').slice(0,90);
  $('info-page').textContent=location.pathname.split('/').pop();
  try{const account=read('cc_auth');$('report-username').value=account?.rawUsername||account?.username||'';}catch{}
  renderReceipts();void refreshIdentity().then(()=>{
    const fragment=new URLSearchParams(location.hash.slice(1)),id=fragment.get('report'),receipt=fragment.get('key');
    if(/^[0-9a-f-]{36}$/i.test(id||'')&&/^[0-9a-f]{64}$/.test(receipt||''))void openDetail(id,receipt);
    if(location.hash==='#reports')$('reports').scrollIntoView();
  });
})();
