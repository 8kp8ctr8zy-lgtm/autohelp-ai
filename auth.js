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
 if (!user || !client) { updateGaragePicker([]); updateServicePicker([]); document.getElementById("service_list")?.replaceChildren(); vehicleList.replaceChildren(); historyList.replaceChildren(); accountMessage('vehicle_message','Войди, чтобы сохранять автомобили.'); accountMessage('history_message','Войди, чтобы видеть историю.'); return; }
 accountMessage('vehicle_message','Загружаем автомобили…'); accountMessage('history_message','Загружаем историю…');
 const [vehicles,history] = await Promise.all([
  client.from('vehicles').select('id,name,year,current_odometer_km').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30),
  client.from('diagnostic_history').select('id,vehicle,symptoms,answer,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
 ]);
 if(request !== accountRequest) return;
 vehicleList.replaceChildren(); historyList.replaceChildren(); updateGaragePicker(vehicles.data||[]);updateServicePicker(vehicles.data||[]);void refreshServiceRecords(user);
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
  const edit=document.createElement('button');edit.className='back';edit.textContent='Изменить';edit.onclick=()=>window.autohelpEditService(record);
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

function updateServicePicker(vehicles){
 const select=document.getElementById('service_vehicle');if(!select)return;
 const previous=select.value;select.replaceChildren();
 for(const v of vehicles){const option=document.createElement('option');option.value=v.id;option.textContent=v.name+(v.year?' · '+v.year:'');select.append(option)}
 if(vehicles.some(v=>v.id===previous))select.value=previous;
 select.onchange=()=>{const v=window.autohelpGarage?.find(x=>x.id===select.value);document.getElementById('garage_current_odometer').value=v?.current_odometer_km??''};select.onchange();
}
async function refreshServiceRecords(user){
 const list=document.getElementById('service_list'),status=document.getElementById('service_status');if(!list)return;
 if(!user){list.replaceChildren();status.textContent='Войди для просмотра истории обслуживания.';return}
 const {data,error}=await client.from('maintenance_records').select('id,vehicle_id,service_date,odometer_km,description,cost,currency,next_service_km').eq('user_id',user.id).order('service_date',{ascending:false}).limit(100);
 list.replaceChildren();if(error){status.textContent='Не удалось загрузить обслуживание: '+error.message;return}
 status.textContent=data.length?'':'Пока нет записей об обслуживании.';
 const summary=document.getElementById('service_summary'),reminders=document.getElementById('service_reminders');
 if(summary){
 summary.replaceChildren();const title=document.createElement('h3');title.textContent='💰 Расходы на обслуживание';summary.append(title);
 const totals=new Map();
 for(const record of data){if(record.cost===null)continue;const key=record.vehicle_id+'|'+record.currency;totals.set(key,(totals.get(key)||0)+Number(record.cost))}
 if(!totals.size){const p=document.createElement('p');p.textContent='Добавь стоимость ремонта, чтобы увидеть итог.';summary.append(p)}
 for(const [key,total] of totals){const [id,currency]=key.split('|');const name=window.autohelpGarage?.find(v=>v.id===id)?.name||'Автомобиль';const row=document.createElement('div');row.className='metric';const left=document.createElement('span');left.textContent=name+' · '+currency;const right=document.createElement('b');right.textContent=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(total)+' '+currency;row.append(left,right);summary.append(row)}
 const note=document.createElement('p');note.className='notice';note.textContent='Итоги по последним 100 записям. Разные валюты не суммируются и не конвертируются.';summary.append(note)
 }
 if(reminders){
 reminders.replaceChildren();
 const byVehicle=new Map();
 for(const record of data){if(!byVehicle.has(record.vehicle_id))byVehicle.set(record.vehicle_id,[]);byVehicle.get(record.vehicle_id).push(record)}
 const notices=[];
 for(const [id,records] of byVehicle){
 const saved=window.autohelpGarage?.find(v=>v.id===id)?.current_odometer_km;const current=Math.max(...records.map(x=>x.odometer_km).filter(Number.isFinite),Number.isFinite(saved)?saved:0,0);
 if(!current)continue;
 const upcoming=records.filter(x=>Number.isFinite(x.next_service_km)&&x.next_service_km>=0).sort((a,b)=>b.service_date.localeCompare(a.service_date))[0];
 if(!upcoming)continue;
 const delta=upcoming.next_service_km-current;
 const name=window.autohelpGarage?.find(v=>v.id===id)?.name||'Автомобиль';
 notices.push(name+': '+(delta<=0?'пора проверить ТО (ориентир '+upcoming.next_service_km+' км)':'до следующего ТО около '+delta+' км'));
 }
 reminders.textContent=notices.length?'🔔 Напоминания по пробегу (при открытии гаража): '+notices.join(' · '):'Напоминания появятся после указания текущего пробега и следующего ТО.';
 if(notices.length&&'Notification' in window&&Notification.permission==='granted'&&localStorage.getItem('autohelp_service_alerts')==='yes'){const message=notices.join(' · ');const key='autohelp_alert_'+user.id;const previous=localStorage.getItem(key);if(previous!==message){new Notification('AutoHelp AI: техническое обслуживание',{body:message.slice(0,200)});localStorage.setItem(key,message)}}
 }

 for(const record of data){
 const row=document.createElement('details');row.className='ai-section';
 const title=document.createElement('summary');const vehicle=window.autohelpGarage?.find(v=>v.id===record.vehicle_id);
 title.textContent=(vehicle?.name||'Автомобиль')+' · '+record.service_date+' · '+record.description;
 const details=document.createElement('p');details.textContent=[record.odometer_km!=null?'Пробег: '+record.odometer_km+' км':'',record.cost!=null?'Стоимость: '+record.cost+' '+record.currency:'',record.next_service_km!=null?'Следующее ТО: '+record.next_service_km+' км':''].filter(Boolean).join(' · ');
 const del=document.createElement('button');del.className='back';del.textContent='Удалить запись';del.onclick=async()=>{if(!confirm('Удалить запись?'))return;const {error}=await client.from('maintenance_records').delete().eq('id',record.id).eq('user_id',user.id);if(error)alert(error.message);else void refreshServiceRecords(user)};
 row.append(title,details,edit,del);list.append(row)
 }
}
window.autohelpAddService=async()=>{
 if(!client)return alert('Войди в аккаунт.');
 const {data:{user}}=await client.auth.getUser();if(!user)return alert('Войди в аккаунт.');
 const id=document.getElementById('service_vehicle').value,description=document.getElementById('service_description').value.trim(),date=document.getElementById('service_date').value;
 const numeric=(key)=>{const v=document.getElementById(key).value.trim();return v===''?null:Number(v)};
 const odometer_km=numeric('service_odometer'),cost=numeric('service_cost'),next_service_km=numeric('service_next_km');
 if(!id||!description||description.length>500)return alert('Выбери автомобиль и опиши обслуживание.');
 if([odometer_km,next_service_km].some(v=>v!==null&&(!Number.isInteger(v)||v<0||v>3000000))||cost!==null&&(!Number.isFinite(cost)||cost<0))return alert('Проверь пробег и стоимость.');
 const currency=localStorage.getItem('autohelp_currency')||'KZT';
 const payload={vehicle_id:id,description,service_date:date||new Date().toISOString().slice(0,10),odometer_km,cost,next_service_km};
 const {error}=window.autohelpEditingServiceId?await client.from('maintenance_records').update({...payload,updated_at:new Date().toISOString()}).eq('id',window.autohelpEditingServiceId).eq('user_id',user.id):await client.from('maintenance_records').insert({...payload,user_id:user.id,currency});
 const status=document.getElementById('service_status');if(error){status.textContent='Ошибка сохранения: '+error.message;return}
 status.textContent='Обслуживание сохранено.';window.autohelpCancelServiceEdit();void refreshServiceRecords(user);
};

window.autohelpEditService=(record)=>{
 window.autohelpEditingServiceId=record.id;
 const values={service_vehicle:record.vehicle_id,service_date:record.service_date,service_odometer:record.odometer_km,service_description:record.description,service_cost:record.cost,service_next_km:record.next_service_km};
 for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el)el.value=value??''}
 document.getElementById('service_submit').textContent='Сохранить изменения';
 document.getElementById('service_cancel_edit').classList.remove('hidden');
 document.getElementById('service_description').focus();
};
window.autohelpCancelServiceEdit=()=>{
 window.autohelpEditingServiceId=null;
 for(const id of ['service_date','service_odometer','service_description','service_cost','service_next_km'])document.getElementById(id).value='';
 document.getElementById('service_submit').textContent='Сохранить обслуживание';
 document.getElementById('service_cancel_edit').classList.add('hidden');
};
window.autohelpSaveCurrentMileage=async()=>{
 const id=document.getElementById('service_vehicle').value,value=Number(document.getElementById('garage_current_odometer').value),status=document.getElementById('garage_mileage_status');
 if(!id||!document.getElementById('garage_current_odometer').value||!Number.isInteger(value)||value<0||value>3000000){status.textContent='Укажи корректный пробег и автомобиль.';return}
 const {data:{user}}=await client.auth.getUser();if(!user){status.textContent='Войди в аккаунт.';return}
 const {error}=await client.from('vehicles').update({current_odometer_km:value}).eq('id',id).eq('user_id',user.id);
 if(error){status.textContent='Ошибка сохранения: '+error.message;return}
 const vehicle=window.autohelpGarage?.find(v=>v.id===id);if(vehicle)vehicle.current_odometer_km=value;
 status.textContent='Пробег сохранён в аккаунте: '+value+' км. Доступен на других устройствах.';void refreshServiceRecords(user);
};

window.autohelpEnableServiceNotifications=async()=>{
 if(!('Notification' in window))return alert('На этом устройстве уведомления браузера недоступны. Напоминания останутся в гараже.');
 if(!window.isSecureContext)return alert('Для уведомлений требуется HTTPS.');
 try{
 const permission=await Notification.requestPermission();
 if(permission==='granted'){localStorage.setItem('autohelp_service_alerts','yes');alert('Разрешение получено. Уведомления могут появляться при открытии гаража. Фоновые push пока не работают.');const {data:{user}}=await client.auth.getUser();if(user)void refreshServiceRecords(user)}
 else alert('Уведомления не разрешены. Напоминания останутся в гараже.');
 }catch{alert('Браузер не разрешил включить уведомления.')}
};

window.autohelpRegisterPush=async()=>{
 if(!client)return alert('Войди в аккаунт.');
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return alert('Это устройство не поддерживает Web Push. На iPhone установи AutoHelp AI на экран «Домой» и открой его оттуда.');
 if(!window.isSecureContext)return alert('Для push требуется HTTPS.');
 try{
 const {data:{user}}=await client.auth.getUser();if(!user)return alert('Сначала войди в аккаунт.');
 const keyResponse=await fetch('/.netlify/functions/push-public-key');const keyData=await keyResponse.json();if(!keyResponse.ok||!keyData.publicKey)throw Error(keyData.error||'Серверный ключ Web Push пока не настроен.');
 const permission=await Notification.requestPermission();if(permission!=='granted')return alert('Уведомления не разрешены.');
 const registration=await navigator.serviceWorker.ready;
 const bytes=Uint8Array.from(atob(keyData.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 const json=subscription.toJSON();
 const {error}=await client.from('push_subscriptions').insert({user_id:user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth_secret:json.keys.auth});
 if(error?.code==='23505'){alert('Это устройство уже зарегистрировано для push.');return}
 if(error)throw Error(error.message);
 alert('Устройство зарегистрировано для push. Доставка напоминаний заработает после включения серверной рассылки.');
 }catch(error){alert('Не удалось подключить push: '+error.message)}
};
