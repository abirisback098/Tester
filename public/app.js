import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.__SUPABASE_CONFIG__ || {};
const supabase = cfg.url && cfg.key ? createClient(cfg.url, cfg.key) : null;
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
let selectedDay = 1;
let routines = {};
let session = null;
let authMode = 'signin';
let deferredInstall = null;
let timers = new Map();

const $ = (id) => document.getElementById(id);
const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const minsToTime = (mins) => { mins = ((Number(mins)||0)%1440+1440)%1440; const h=Math.floor(mins/60), m=mins%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; };
const displayTime = (mins) => { const h=Math.floor(mins/60)%24,m=mins%60, ap=h>=12?'PM':'AM', hh=(h%12)||12; return `${hh}:${String(m).padStart(2,'0')} ${ap}`; };
const parseTime = (value) => { const [h,m]=String(value).split(':').map(Number); return Number.isFinite(h)&&Number.isFinite(m)&&h>=0&&h<24&&m>=0&&m<60 ? h*60+m : 360; };
const durationText = (n) => { const h=Math.floor(n/60),m=n%60; return `${h?`${h}h`:''}${h&&m?' ':''}${m?`${m}m`:''}` || '0m'; };
const uid = () => crypto.randomUUID();

function toast(text){ const el=$('toast'); el.textContent=text; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2200); }
function currentBlocks(){ return routines[selectedDay]?.blocks || []; }
function ensureLocalDay(day){ if(!routines[day]) routines[day]={id:null,blocks:[]}; return routines[day]; }
function makeBlock(start=360){ return {id:uid(),position:0,start_minutes:start,duration_minutes:60,activity:'',notes:'',notification_enabled:false,notification_offset_minutes:0}; }
function renderDays(){ $('days').innerHTML=DAYS.map((name,i)=>{const count=(routines[i]?.blocks||[]).length;return `<button class="day-button ${i===selectedDay?'active':''}" data-day="${i}"><span class="day-name">${name.slice(0,3)}</span><span class="day-count">${count} ${count===1?'block':'blocks'}</span></button>`}).join(''); }
function render(){
  renderDays();
  const day=ensureLocalDay(selectedDay), blocks=day.blocks;
  $('day-title').textContent=DAYS[selectedDay];
  $('day-subtitle').textContent=blocks.length?`${blocks.length} ${blocks.length===1?'time block':'time blocks'} · Changes save automatically.`:'Empty routine. Start at 6:00 AM.';
  $('blocks').innerHTML=blocks.map((b,i)=>`<tr data-id="${b.id}">
    <td><input class="time-input" type="time" value="${minsToTime(b.start_minutes)}" data-field="start_minutes" aria-label="Start time"></td>
    <td><input class="duration-input" type="text" inputmode="numeric" value="${esc(durationText(b.duration_minutes))}" data-field="duration" aria-label="Duration" placeholder="1h 30m"></td>
    <td><input class="cell-input" value="${esc(b.activity)}" data-field="activity" aria-label="Activity" placeholder="What are you doing?"></td>
    <td><textarea class="cell-textarea" data-field="notes" aria-label="Notes" placeholder="Optional notes">${esc(b.notes)}</textarea></td>
    <td><div class="reminder-wrap"><input class="reminder-toggle" type="checkbox" ${b.notification_enabled?'checked':''} data-field="notification_enabled" aria-label="Enable reminder"><select class="reminder-select" data-field="notification_offset_minutes" ${b.notification_enabled?'':'disabled'} aria-label="Reminder time"><option value="0" ${b.notification_offset_minutes===0?'selected':''}>At start</option><option value="5" ${b.notification_offset_minutes===5?'selected':''}>5 min before</option><option value="10" ${b.notification_offset_minutes===10?'selected':''}>10 min before</option><option value="15" ${b.notification_offset_minutes===15?'selected':''}>15 min before</option><option value="30" ${b.notification_offset_minutes===30?'selected':''}>30 min before</option></select></div></td>
    <td><button class="delete-button" data-action="delete" aria-label="Delete block">×</button></td>
  </tr>`).join('');
  $('empty-state').style.display=blocks.length?'none':'flex'; $('add-block').disabled=!session; $('empty-add').disabled=!session; $('copy-day').disabled=!session || !blocks.length;
  scheduleNotifications();
}
function parseDuration(value){ const s=String(value).trim().toLowerCase(); if(/^\d+$/.test(s)) return Math.max(1,Number(s)*60); let h=0,m=0, mh=s.match(/(\d+(?:\.\d+)?)\s*h/), mm=s.match(/(\d+)\s*m/); if(mh)h=Number(mh[1]); if(mm)m=Number(mm[1]); if(!mh&&!mm){const n=Number(s);return Number.isFinite(n)&&n>0?Math.round(n):60} return Math.max(1,Math.round(h*60+m)); }
function findBlock(id){return currentBlocks().find(b=>b.id===id)}
async function saveBlock(block){
  if(!session || !supabase) return;
  const day=ensureLocalDay(selectedDay);
  let routineId=day.id;
  if(!routineId){ const {data,error}=await supabase.from('routines').insert({user_id:session.user.id,day_of_week:selectedDay,title:''}).select('id').single(); if(error){toast(error.message);return} routineId=day.id=data.id; }
  const payload={routine_id:routineId,position:block.position,start_minutes:block.start_minutes,duration_minutes:block.duration_minutes,activity:block.activity,notes:block.notes,notification_enabled:block.notification_enabled,notification_offset_minutes:block.notification_offset_minutes};
  const {data,error}=await supabase.from('blocks').upsert({...payload,id:block.id}, {onConflict:'id'}).select('id').single();
  if(error){toast(error.message);return} block.id=data.id; block._dirty=false; $('save-state').textContent='Saved';
}
async function saveRoutineOrder(){ const blocks=currentBlocks(); blocks.forEach((b,i)=>b.position=i); for(const b of blocks) await saveBlock(b); }
function nextBlockUpdate(index){ const blocks=currentBlocks(); if(index<blocks.length-1){ blocks[index+1].start_minutes=Math.min(1439,blocks[index].start_minutes+blocks[index].duration_minutes); }
}
async function mutateBlock(id,field,value){ const blocks=currentBlocks(), i=blocks.findIndex(b=>b.id===id); if(i<0)return; const b=blocks[i];
  if(field==='start_minutes') b.start_minutes=parseTime(value); else if(field==='duration') b.duration_minutes=parseDuration(value); else if(field==='notification_enabled') b.notification_enabled=Boolean(value); else if(field==='notification_offset_minutes') b.notification_offset_minutes=Number(value)||0; else b[field]=value;
  if(field==='start_minutes'||field==='duration') nextBlockUpdate(i);
  b._dirty=true; render(); const row=document.querySelector(`tr[data-id="${CSS.escape(id)}"]`); if(row){row.classList.add('updated');setTimeout(()=>row.classList.remove('updated'),700)}
  await saveBlock(b); if((field==='start_minutes'||field==='duration') && i<blocks.length-1) await saveBlock(blocks[i+1]);
}
async function addBlock(){ const blocks=currentBlocks(); const start=blocks.length?Math.min(1439,blocks[blocks.length-1].start_minutes+blocks[blocks.length-1].duration_minutes):360; const b=makeBlock(start); b.position=blocks.length; blocks.push(b); render(); await saveBlock(b); }
async function deleteBlock(id){ const blocks=currentBlocks(), i=blocks.findIndex(b=>b.id===id); if(i<0)return; const b=blocks[i]; blocks.splice(i,1); blocks.forEach((x,n)=>x.position=n); render(); if(session&&b.id&&!String(b.id).startsWith('local-')) await supabase.from('blocks').delete().eq('id',b.id); if(session) await saveRoutineOrder(); }
async function load(){ if(!session||!supabase)return; const {data:r,error}=await supabase.from('routines').select('id,day_of_week,blocks(id,position,start_minutes,duration_minutes,activity,notes,notification_enabled,notification_offset_minutes)').eq('user_id',session.user.id).order('day_of_week'); if(error){toast(error.message);return} routines={}; for(const row of r||[]) routines[row.day_of_week]={id:row.id,blocks:(row.blocks||[]).sort((a,b)=>a.position-b.position)}; for(let i=0;i<7;i++)ensureLocalDay(i); render(); $('save-state').textContent='Saved'; }
async function copyDay(){ const target=Number($('copy-target').value); if(target===selectedDay)return; const source=currentBlocks().map((b,i)=>({...b,id:uid(),position:i})); const old=selectedDay; routines[target]={id:null,blocks:source}; selectedDay=target; render(); await saveRoutineOrder(); toast(`Copied ${DAYS[old]} to ${DAYS[target]}`); }
function openAuth(mode='signin'){authMode=mode;$('auth-title').textContent=mode==='signin'?'Sign in':'Create account';$('auth-submit').textContent=mode==='signin'?'Sign in':'Create account';$('auth-switch').textContent=mode==='signin'?'Create an account':'I already have an account';$('auth-reset').style.display=mode==='signin'?'block':'none';$('auth-message').textContent=mode==='signin'?'Use an email and password to save routines across devices.':'Create an account to keep your routines synced.';$('auth-dialog').showModal()}
async function authSubmit(e){e.preventDefault(); if(!supabase){toast('Supabase is not configured on the server.');return} const email=$('email').value.trim(),password=$('password').value; const result=authMode==='signin'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password}); if(result.error){toast(result.error.message);return} if(authMode==='signup'&&!result.data.session){toast('Check your email to confirm your account.');$('auth-dialog').close();return} $('auth-dialog').close(); }
async function signOut(){await supabase?.auth.signOut();}
async function resetPassword(){if(!supabase)return; const email=$('email').value.trim();if(!email){toast('Enter your email first.');return}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin});toast(error?error.message:'Password reset email sent.');}
function scheduleNotifications(){ for(const t of timers.values())clearTimeout(t);timers.clear(); if(!session)return; for(const b of currentBlocks()){if(!b.notification_enabled)continue; const now=new Date(), target=new Date(); target.setHours(Math.floor(b.start_minutes/60),b.start_minutes%60,0,0); target.setMinutes(target.getMinutes()-b.notification_offset_minutes); if(target<=now)continue; const ms=target-now; if(ms<2147483647){const t=setTimeout(()=>{if(Notification?.permission==='granted')new Notification(b.activity||'Routine reminder',{body:`Starts at ${displayTime(b.start_minutes)}.`});},ms);timers.set(b.id,t)}} }
async function enableNotifications(){ if(!('Notification' in window)){toast('Notifications are not supported here.');return false} if(Notification.permission==='granted')return true; const p=await Notification.requestPermission(); if(p!=='granted')toast('Notification permission was not granted.'); return p==='granted'; }

$('days').addEventListener('click',e=>{const btn=e.target.closest('[data-day]');if(!btn)return;selectedDay=Number(btn.dataset.day);render();});
$('blocks').addEventListener('change',async e=>{const input=e.target.closest('[data-field]');const row=e.target.closest('tr');if(!input||!row)return;const field=input.dataset.field;if(field==='notification_enabled'&&input.checked)await enableNotifications();await mutateBlock(row.dataset.id,field,field==='notification_enabled'?input.checked:input.value);});
$('blocks').addEventListener('input',e=>{const input=e.target.closest('[data-field]');const row=e.target.closest('tr');if(!input||!row||['start_minutes','duration','notification_enabled','notification_offset_minutes'].includes(input.dataset.field))return; const b=findBlock(row.dataset.id); if(b)b[input.dataset.field]=input.value;});
$('blocks').addEventListener('blur',async e=>{const input=e.target.closest('[data-field]');const row=e.target.closest('tr');if(!input||!row||['start_minutes','duration','notification_enabled','notification_offset_minutes'].includes(input.dataset.field))return;await mutateBlock(row.dataset.id,input.dataset.field,input.value);},true);
$('blocks').addEventListener('click',e=>{const btn=e.target.closest('[data-action="delete"]');if(btn)deleteBlock(btn.closest('tr').dataset.id)});
$('add-block').onclick=addBlock;$('empty-add').onclick=addBlock;$('auth-btn').onclick=()=>session?signOut():openAuth();$('auth-form').addEventListener('submit',authSubmit);$('auth-switch').onclick=()=>openAuth(authMode==='signin'?'signup':'signin');$('auth-reset').onclick=resetPassword;$('close-auth').onclick=()=>$('auth-dialog').close();
$('copy-day').onclick=()=>{const sel=$('copy-target');sel.innerHTML=DAYS.map((d,i)=>`<option value="${i}" ${i===selectedDay?'disabled':''}>${d}</option>`).join('');$('copy-source').textContent=DAYS[selectedDay];$('copy-dialog').showModal()};$('copy-form').addEventListener('submit',e=>{e.preventDefault();copyDay();$('copy-dialog').close()});$('close-copy').onclick=()=>$('copy-dialog').close();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('install-btn').classList.remove('hidden')});$('install-btn').onclick=async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('install-btn').classList.add('hidden')}};
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

if(supabase){ supabase.auth.onAuthStateChange(async(_event,s)=>{session=s;$('auth-btn').textContent=s?'Sign out':'Sign in';$('add-block').disabled=!s;$('empty-add').disabled=!s;$('save-state').textContent=s?'Loading…':'Not signed in';if(s){await load()}else{routines={};for(let i=0;i<7;i++)ensureLocalDay(i);render()}}); const {data}=await supabase.auth.getSession(); session=data.session; }
if(!session){for(let i=0;i<7;i++)ensureLocalDay(i);render();}
