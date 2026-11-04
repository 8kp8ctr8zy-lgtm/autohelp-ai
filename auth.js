import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
const status = document.getElementById('auth_status');
const guest = document.getElementById('auth_guest');
const member = document.getElementById('auth_member');
const email = document.getElementById('auth_email');
let client;
let subscriptionRequest = 0;
async function refreshProStatus(user) {
  const target = document.getElementById('pro_status');
  if (!target) return;
  const request = ++subscriptionRequest;
  if (!user || !client) { target.textContent = 'PRO: войдите, чтобы проверить подписку'; updatePlanDetails(null); return; }
  target.textContent = 'PRO: проверяем подписку…';
  const { data, error } = await client.from('pro_subscriptions').select('status,ends_at,renews_at').eq('user_id',user.id);
  if (request !== subscriptionRequest) return;
  if (error) { target.textContent = 'PRO: не удалось проверить подписку'; updatePlanDetails(null); return; }
  const active = (data || []).some(s => ['active','on_trial'].includes(s.status) && (!s.ends_at || new Date(s.ends_at).getTime() > Date.now()));
  target.textContent = active ? '⭐ PRO активен' : 'PRO не активен — доступна бесплатная версия';
  updatePlanDetails(active ? (data||[]).find(s=>['active','on_trial'].includes(s.status) && (!s.ends_at || new Date(s.ends_at).getTime()>Date.now())) : null);
}

function showError(message) { status.textContent = message; }
function updateUser(user) {
  guest.classList.toggle('hidden', !!user);
  member.classList.toggle('hidden', !user);
  email.textContent = user?.email || 'Авторизован';
  status.textContent = user ? 'Вы вошли в AutoHelp AI.' : 'Войди, чтобы пользоваться личным кабинетом.';
  void refreshProStatus(user);
  void refreshAccountData(user);
  void window.autohelpRefreshQuota?.();
}
window.autohelpSignIn = async (provider) => {
  if (!client) return showError('Вход пока не подключён. Сначала настрой Supabase.');
  if (!['google', 'apple'].includes(provider)) return;
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/' }
    });
    if (error) throw error;
  } catch (error) { showError('Не удалось войти: ' + error.message); }
};
window.autohelpSignOut = async () => {
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) showError('Не удалось выйти: ' + error.message);
};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  showError('Вход через Google и Apple готовится к подключению.');
} else {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
    });
    window.autohelpSupabase = client;
    const { data, error } = await client.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    updateUser(data?.user || null);
    client.auth.onAuthStateChange((_event, session) => updateUser(session?.user || null));
  } catch (error) { showError('Ошибка подключения авторизации. Проверь настройки Supabase.'); }
}

let accountRequest = 0;
function accountMessage(id, message) { const el = document.getElementById(id); if(el) el.textContent = message; }
async function refreshAccountData(user) {
 const request = ++accountRequest;
 const vehicleList = document.getElementById('vehicle_list');
 const historyList = document.getElementById('history_list');
 if (!vehicleList || !historyList) return;
 if (!user || !client) { updateGaragePicker([]); vehicleList.replaceChildren(); historyList.replaceChildren(); accountMessage('vehicle_message','Войди, чтобы сохранять автомобили.'); accountMessage('history_message','Войди, чтобы видеть историю.'); return; }
 accountMessage('vehicle_message','Загружаем автомобили…'); accountMessage('history_message','Загружаем историю…');
 const [vehicles,history] = await Promise.all([
  client.from('vehicles').select('id,name,year').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30),
  client.from('diagnostic_history').select('id,vehicle,symptoms,answer,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
 ]);
 if(request !== accountRequest) return;
 vehicleList.replaceChildren(); historyList.replaceChildren(); updateGaragePicker(vehicles.data||[]);
 accountMessage('vehicle_message',vehicles.error?'Ошибка загрузки автомобилей':vehicles.data.length?'':'Автомобилей пока нет.');
 accountMessage('history_message',history.error?'Ошибка загрузки истории':history.data.length?'':'История пока пустая.');
 for(const v of vehicles.data || []) {
  const wrap=document.createElement('div');wrap.className='metric';
  const name=document.createElement('span');name.textContent=v.name+(v.year?' · '+v.year:'');
  const del=document.createElement('button');del.textContent='Удалить';del.className='back';del.onclick=async()=>{if(!confirm('Удалить автомобиль?'))return;const {error}=await client.from('vehicles').delete().eq('id',v.id).eq('user_id',user.id);if(error)alert(error.message);else refreshAccountData(user)};
  wrap.append(name,del);vehicleList.append(wrap);
 }
 for(const h of history.data || []) {
  const item=document.createElement('details');item.className='ai-section';
  const summary=document.createElement('summary');summary.textContent=h.vehicle+' · '+new Date(h.created_at).toLocaleDateString('ru-RU');
  const symptom=document.createElement('p');symptom.textContent='Симптомы: '+h.symptoms;
  const answer=document.createElement('p');answer.style.whiteSpace='pre-wrap';answer.textContent=h.answer;
  const del=document.createElement('button');del.className='back';del.textContent='Удалить запись';del.onclick=async()=>{if(!confirm('Удалить запись диагностики?'))return;const {error}=await client.from('diagnostic_history').delete().eq('id',h.id).eq('user_id',user.id);if(error)alert(error.message);else refreshAccountData(user)};
  item.append(summary,symptom,answer,del);historyList.append(item);
 }
}
window.autohelpSaveVehicle = async () => {
 if(!client)return alert('Войди в аккаунт.');
 const {data:{user}}=await client.auth.getUser();if(!user)return alert('Войди в аккаунт.');
 const name=document.getElementById('vehicle_name').value.trim();
 const raw=document.getElementById('vehicle_year').value.trim();
 const year=raw?Number(raw):null;
 if(!name || name.length>160 || (raw&&(!Number.isInteger(year)||year<1900||year>2100)))return alert('Укажи название и корректный год.');
 const {error}=await client.from('vehicles').insert({user_id:user.id,name,year});
 if(error)return alert('Ошибка сохранения: '+error.message);
 document.getElementById('vehicle_name').value='';document.getElementById('vehicle_year').value='';
 await refreshAccountData(user);
};
window.autohelpSaveDiagnosis = async (vehicle,mileage,symptoms,answer) => {
 if(!client)return;
 const {data:{user}}=await client.auth.getUser();if(!user)return;
 const {error}=await client.from('diagnostic_history').insert({user_id:user.id,vehicle,mileage,symptoms,answer});
 if(error){console.warn('History save failed',error.message);return;}
 await refreshAccountData(user);
};

function updatePlanDetails(subscription) {
 const plan=document.getElementById('pro_plan_label'),renewal=document.getElementById('pro_renewal');
 if(plan)plan.textContent=subscription?'PRO активен':'Бесплатный';
 if(renewal)renewal.textContent=subscription?.renews_at?new Date(subscription.renews_at).toLocaleDateString('ru-RU'):'—';
}
window.autohelpChooseVehicle = (id) => {
 const selected=window.autohelpGarage?.find(v=>v.id===id);
 if(selected)document.getElementById('ai_vehicle').value=selected.name+(selected.year?', '+selected.year:'');
};
function updateGaragePicker(vehicles) {
 window.autohelpGarage=vehicles;
 const picker=document.getElementById('ai_saved_vehicle');if(!picker)return;
 const current=picker.value;picker.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Ввести автомобиль вручную';picker.append(placeholder);
 for(const v of vehicles){const opt=document.createElement('option');opt.value=v.id;opt.textContent=v.name+(v.year?' · '+v.year:'');picker.append(opt);}
 if(vehicles.some(v=>v.id===current))picker.value=current;
}
