// Authentication module — splash-card style adapted from fubzlifts
import { supabase, withTimeout } from './supabase.js';
import { toast } from './utils.js';
import { BUILD_TIME as BUILD_TIME_FROM_FILE } from './version.js';

const BUILD_TIME = (typeof window !== 'undefined' && window.SEIN_BUILD_TIME && window.SEIN_BUILD_TIME !== 'BUILD_TIMESTAMP')
  ? window.SEIN_BUILD_TIME
  : BUILD_TIME_FROM_FILE;

let currentUser = null;

export function getUser() { return currentUser; }

export async function initAuth() {
  const { data: { session } } = await withTimeout(supabase.auth.getSession(), 8000, 'getSession');
  if (session) {
    currentUser = { id: session.user.id, email: session.user.email };
    return currentUser;
  }
  return null;
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      currentUser = { id: session.user.id, email: session.user.email };
    } else {
      currentUser = null;
    }
    callback(currentUser, event);
  });
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, msg: error.message };
  if (data?.user && !data?.session) {
    // Email confirmation is required by the project's auth settings.
    return { ok: true, needsConfirmation: true };
  }
  return { ok: true };
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    let msg = error.message;
    if (msg.includes('Invalid login')) msg = 'Wrong email or password.';
    return { ok: false, msg };
  }
  return { ok: true };
}

export async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
}

export function renderAuth(container) {
  let mode = 'login';

  function render() {
    const isLogin = mode === 'login';
    container.innerHTML = `
      <div class="splash-screen">
        <div class="splash-card">
          <div class="splash-logo">📅</div>
          <h1 class="splash-title">Seinfeld</h1>
          <p class="splash-sub">${isLogin ? "Welcome back. Don't break the chain." : 'Pick a habit. Show up every day. Fill the box.'}</p>

          <form id="authForm" novalidate>
            <div class="splash-field">
              <label class="splash-label" for="authEmail">Email</label>
              <input class="field" id="authEmail" name="email" type="email" placeholder="you@email.com" autocomplete="email" />
            </div>
            <div class="splash-field">
              <label class="splash-label" for="authPass">Password</label>
              <input class="field" id="authPass" name="password" type="password" placeholder="••••••••" minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
            </div>
            <div class="splash-field splash-remember">
              <input type="checkbox" id="authRemember" name="remember" />
              <label for="authRemember" class="splash-label">Remember email</label>
            </div>
            <div id="authError" class="splash-error"></div>
            <button type="submit" class="btn btn-primary splash-submit" id="authSubmit">
              ${isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          <div class="splash-toggle">
            ${isLogin
              ? 'No account? <a id="authToggle">Create one</a>'
              : 'Have an account? <a id="authToggle">Sign in</a>'}
          </div>
          <div class="splash-footer">
            <span class="splash-build">build ${new Date(BUILD_TIME).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#authToggle').addEventListener('click', () => {
      mode = isLogin ? 'register' : 'login';
      render();
    });

    container.querySelector('#authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = container.querySelector('#authSubmit');
      const errEl = container.querySelector('#authError');
      const email = container.querySelector('#authEmail').value.trim();
      const pass  = container.querySelector('#authPass').value;
      errEl.textContent = '';

      if (!email || !pass) { errEl.textContent = 'Fill in all fields.'; return; }
      if (pass.length < 6) { errEl.textContent = 'Password must be 6+ characters.'; return; }

      const remember = container.querySelector('#authRemember').checked;
      if (remember) localStorage.setItem('seinfeld_remember_email', email);
      else          localStorage.removeItem('seinfeld_remember_email');

      btn.disabled = true;
      btn.textContent = 'Loading...';

      if (isLogin) {
        const result = await signIn(email, pass);
        if (!result.ok) {
          btn.disabled = false; btn.textContent = 'Sign In';
          errEl.textContent = result.msg;
        }
      } else {
        const result = await signUp(email, pass);
        if (!result.ok) {
          btn.disabled = false; btn.textContent = 'Create Account';
          errEl.textContent = result.msg;
        } else if (result.needsConfirmation) {
          btn.disabled = false; btn.textContent = 'Create Account';
          toast('Check your email to confirm your account, then sign in.', 'info');
          mode = 'login';
          render();
        }
      }
    });

    // Restore remembered email
    const savedEmail = localStorage.getItem('seinfeld_remember_email');
    if (savedEmail) {
      container.querySelector('#authEmail').value = savedEmail;
      container.querySelector('#authRemember').checked = true;
    }

    setTimeout(() => {
      const emailEl = container.querySelector('#authEmail');
      const passEl  = container.querySelector('#authPass');
      if (emailEl.value) passEl.focus(); else emailEl.focus();
    }, 100);
  }

  render();
}
