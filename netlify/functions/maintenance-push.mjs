import webpush from 'web-push';
export const config={schedule:'0 8 * * *'};
export default async ()=>{
 const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY,publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,contact=process.env.VAPID_SUBJECT;
 if(!url||!secret||!publicKey||!privateKey||!contact){console.error('Maintenance push: missing server environment variables');return}
 webpush.setVapidDetails(contact,publicKey,privateKey);
 const headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 const get=async(path)=>{const r=await fetch(url+'/rest/v1/'+path,{headers});if(!r.ok)throw Error('Supabase '+r.status);return r.json()};
 try{
 const [vehicles,records,subscriptions,logs]=await Promise.all([
 get('vehicles?select=id,user_id,name,current_odometer_km&limit=1000'),
 get('maintenance_records?select=vehicle_id,user_id,next_service_km,service_date&next_service_km=not.is.null&order=service_date.desc&limit=5000'),
 get('push_subscriptions?select=endpoint,p256dh,auth_secret,user_id&limit=5000'),
 get('push_delivery_log?select=user_id,vehicle_id,service_km&limit=5000')
 ]);
 const sent=new Set(logs.map(x=>x.user_id+'|'+x.vehicle_id+'|'+x.service_km)),latest=new Map();
 for(const r of records)if(!latest.has(r.vehicle_id))latest.set(r.vehicle_id,r);
 for(const v of vehicles){
 const r=latest.get(v.id);if(!r||r.user_id!==v.user_id||!Number.isInteger(v.current_odometer_km)||v.current_odometer_km<r.next_service_km-500)continue;
 const key=v.user_id+'|'+v.id+'|'+r.next_service_km;if(sent.has(key))continue;
 const recipients=subscriptions.filter(s=>s.user_id===v.user_id);if(!recipients.length)continue;
 const payload=JSON.stringify({title:'AutoHelp AI — пора проверить ТО',body:v.name+': '+(v.current_odometer_km>=r.next_service_km?'плановый пробег ТО достигнут':'до ТО осталось '+(r.next_service_km-v.current_odometer_km)+' км')});
 let delivered=false;
 for(const sub of recipients){try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},payload,{TTL:86400});delivered=true}catch(e){console.warn('Push delivery failed',e.statusCode||e.message)}}
 if(delivered){const res=await fetch(url+'/rest/v1/push_delivery_log',{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({user_id:v.user_id,vehicle_id:v.id,service_km:r.next_service_km})});if(!res.ok)console.warn('Push log error',res.status)}
 }
 }catch(e){console.error('Maintenance push failed',e.message)}
};
