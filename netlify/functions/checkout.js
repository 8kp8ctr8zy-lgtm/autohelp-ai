// Verified checkout: associate a paid subscription with the authenticated Supabase user.
const SUPABASE_URL='https://qhhccricgwdkpnlmazed.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_Ntim2FW-MYjti8HiaCtWEg_su1qeDpj';
const DEFAULT_CHECKOUT_URL='https://autohelp-ai.lemonsqueezy.com/checkout/buy/8baac202-95f1-4b01-abb5-e3050d83f4bd';
export const handler=async(event)=>{
 if(event.httpMethod!=='POST')return {statusCode:405,body:JSON.stringify({error:'Method not allowed'})};
 const token=(event.headers.authorization||event.headers.Authorization||'').match(/^Bearer (.+)$/i)?.[1];
 if(!token)return {statusCode:401,body:JSON.stringify({error:'Войди в аккаунт'})};
 try{
  const response=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token}});
  if(!response.ok)return {statusCode:401,body:JSON.stringify({error:'Сессия истекла. Войди заново'})};
  const user=await response.json();
  if(!/^[0-9a-f-]{36}$/i.test(user.id||''))return {statusCode:401,body:JSON.stringify({error:'Invalid user'})};
  const url=new URL(process.env.LEMONSQUEEZY_CHECKOUT_URL||DEFAULT_CHECKOUT_URL);
  if(url.protocol!=='https:'||!(url.hostname==='lemonsqueezy.com'||url.hostname.endsWith('.lemonsqueezy.com')))throw new Error('Invalid checkout host');
  url.searchParams.set('checkout[custom][user_id]',user.id);
  return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({url:url.toString()})};
 }catch(e){return {statusCode:500,body:JSON.stringify({error:'Не удалось создать оплату'})}}
};
