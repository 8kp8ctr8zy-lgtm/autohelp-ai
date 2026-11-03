import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
const status = document.getElementById('auth_status');
const guest = document.getElementById('auth_guest');
const member = document.getElementById('auth_member');
const email = document.getElementById('auth_email');
let client;
function showError(message) { status.textContent = message; }
function updateUser(user) {
  guest.classList.toggle('hidden', !!user);
  member.classList.toggle('hidden', !user);
  email.textContent = user?.email || 'Авторизован';
  status.textContent = user ? 'Вы вошли в AutoHelp AI.' : 'Войди, чтобы пользоваться личным кабинетом.';
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
    const { data, error } = await client.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    updateUser(data?.user || null);
    client.auth.onAuthStateChange((_event, session) => updateUser(session?.user || null));
  } catch (error) { showError('Ошибка подключения авторизации. Проверь настройки Supabase.'); }
}
