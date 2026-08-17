import { createClient } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const app = document.querySelector('#app')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  app.innerHTML = `
    <main class="center">
      <section class="card">
        <h1>Parcel Desk</h1>
        <h2>Supabase connection required</h2>
        <p>Create a <code>.env</code> file from <code>.env.example</code> and add your Supabase Project URL and publishable/anon key.</p>
      </section>
    </main>`
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  start(supabase)
}

async function start(supabase) {
  app.innerHTML = `
    <main class="center">
      <section class="card auth-card">
        <div class="brand">PD</div>
        <h1>Parcel Desk</h1>
        <p class="muted">Secure parcel & order management</p>
        <div id="auth"></div>
      </section>
    </main>`

  const auth = document.querySelector('#auth')
  const { data: { session } } = await supabase.auth.getSession()

  if (session) return loadDashboard(supabase, session.user)

  renderLogin(auth, supabase)
  supabase.auth.onAuthStateChange((_event, newSession) => {
    if (newSession) loadDashboard(supabase, newSession.user)
  })
}

function renderLogin(container, supabase) {
  container.innerHTML = `
    <form id="loginForm" class="stack">
      <label>Email<input id="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
      <label>Password<input id="password" type="password" autocomplete="current-password" required placeholder="Password"></label>
      <button class="primary">Sign in</button>
      <p id="loginError" class="error"></p>
    </form>
    <hr>
    <button id="signupToggle" class="linkbtn">Create an account</button>
    <form id="signupForm" class="stack hidden">
      <label>Full name<input id="fullName" required placeholder="Full name"></label>
      <label>Email<input id="signupEmail" type="email" required placeholder="you@example.com"></label>
      <label>Password<input id="signupPassword" type="password" minlength="8" required placeholder="At least 8 characters"></label>
      <button class="primary">Sign up</button>
      <p class="muted small">New accounts require Owner approval before dashboard access.</p>
      <p id="signupMsg" class="error"></p>
    </form>
  `
  const signupForm = document.querySelector('#signupForm')
  document.querySelector('#signupToggle').onclick = () => signupForm.classList.toggle('hidden')

  document.querySelector('#loginForm').onsubmit = async (e) => {
    e.preventDefault()
    const email = document.querySelector('#email').value.trim()
    const password = document.querySelector('#password').value
    const msg = document.querySelector('#loginError')
    msg.textContent = ''
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) msg.textContent = error.message
  }

  signupForm.onsubmit = async (e) => {
    e.preventDefault()
    const msg = document.querySelector('#signupMsg')
    msg.textContent = ''
    const full_name = document.querySelector('#fullName').value.trim()
    const email = document.querySelector('#signupEmail').value.trim()
    const password = document.querySelector('#signupPassword').value
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name } }
    })
    msg.textContent = error ? error.message : 'Account created. Wait for Owner approval.'
  }
}

async function loadDashboard(supabase, user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) return showBlocked('Profile not found. Ask the Owner to approve your account.')
  if (profile.approval_status !== 'approved' || !profile.is_active) {
    await supabase.auth.signOut()
    return showBlocked(profile.approval_status === 'pending'
      ? 'Your account is waiting for Owner approval.'
      : 'Your account is not currently allowed to access Parcel Desk.')
  }

  renderDashboard(supabase, user, profile)
}

function showBlocked(message) {
  app.innerHTML = `
    <main class="center"><section class="card">
      <div class="brand">PD</div><h1>Parcel Desk</h1>
      <p>${escapeHtml(message)}</p>
      <button class="secondary" onclick="location.reload()">Back to login</button>
    </section></main>`
}

async function renderDashboard(supabase, user, profile) {
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="logo"><span class="brand smallbrand">PD</span><div><strong>Parcel Desk</strong><small>Management</small></div></div>
        <nav>
          <button data-view="dashboard" class="nav active">Dashboard</button>
          <button data-view="orders" class="nav">Orders</button>
          ${['admin','owner'].includes(profile.role) ? '<button data-view="users" class="nav">Users</button>' : ''}
          ${profile.role === 'owner' ? '<button data-view="activity" class="nav">Activity</button>' : ''}
        </nav>
        <button id="logout" class="logout">Sign out</button>
      </aside>
      <main class="main">
        <header class="topbar">
          <div><h1 id="pageTitle">Dashboard</h1><p id="pageSub">Welcome back, ${escapeHtml(profile.full_name)}</p></div>
          <div class="userpill"><span>${escapeHtml(profile.role)}</span><b>${escapeHtml(profile.full_name)}</b></div>
        </header>
        <section id="content"></section>
      </main>
    </div>`

  document.querySelector('#logout').onclick = async () => { await supabase.auth.signOut(); location.reload() }
  document.querySelectorAll('.nav').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('.nav').forEach(x => x.classList.remove('active'))
    btn.classList.add('active')
    showView(btn.dataset.view, supabase, user, profile)
  })
  showView('dashboard', supabase, user, profile)
}

async function showView(view, supabase, user, profile) {
  const content = document.querySelector('#content')
  const title = document.querySelector('#pageTitle')
  const sub = document.querySelector('#pageSub')

  if (view === 'dashboard') {
    title.textContent = 'Dashboard'
    sub.textContent = `Welcome back, ${profile.full_name}`
    const { data: orders = [] } = await supabase.from('orders').select('status')
    const counts = ['completed','cancelled','exchange','returned'].reduce((a, s) => (a[s] = orders.filter(o => o.status === s).length, a), {})
    content.innerHTML = `
      <div class="stats">
        <div class="stat"><span>Total Orders</span><b>${orders.length}</b></div>
        <div class="stat"><span>Completed</span><b>${counts.completed}</b></div>
        <div class="stat"><span>Cancelled</span><b>${counts.cancelled}</b></div>
        <div class="stat"><span>Exchange</span><b>${counts.exchange}</b></div>
      </div>
      <div class="card">
        <div class="sectionhead"><div><h2>Quick actions</h2><p class="muted">Common Parcel Desk actions</p></div></div>
        <div class="actions">
          ${['moderator','admin','owner'].includes(profile.role) ? '<button id="newOrder" class="primary">+ Place new order</button>' : ''}
          <button id="viewOrders" class="secondary">View orders</button>
        </div>
      </div>`
    document.querySelector('#newOrder')?.addEventListener('click', () => showView('neworder', supabase, user, profile))
    document.querySelector('#viewOrders')?.addEventListener('click', () => showView('orders', supabase, user, profile))
  }

  if (view === 'neworder') {
    if (!['moderator','admin','owner'].includes(profile.role)) return
    title.textContent = 'New Order'
    sub.textContent = 'Create a new parcel order'
    content.innerHTML = `
      <div class="card formcard">
        <form id="orderForm" class="stack">
          <label>Customer name<input id="customer" placeholder="Customer name"></label>
          <label>Phone number<input id="phone" inputmode="numeric" maxlength="11" placeholder="11 digit phone number" required></label>
          <div id="phoneHistory" class="history muted">Enter a valid phone number to see history.</div>
          <label>Order details<textarea id="details" rows="7" required placeholder="Paste order details here..."></textarea></label>
          <button class="primary">Create Order</button>
          <p id="orderMsg" class="msg"></p>
        </form>
      </div>`
    const phone = document.querySelector('#phone')
    phone.addEventListener('input', async () => {
      const value = phone.value.replace(/\D/g, '').slice(0, 11)
      phone.value = value
      if (value.length !== 11) {
        document.querySelector('#phoneHistory').textContent = 'Enter exactly 11 digits to see history.'
        return
      }
      const { data } = await supabase.from('customer_phone_history').select('*').eq('phone', value).maybeSingle()
      const h = data || { total_orders: 0, parcels_received: 0, parcels_returned: 0, exchanges: 0 }
      document.querySelector('#phoneHistory').innerHTML =
        `<b>Customer history</b><div class="mini-stats"><span>Received: ${h.parcels_received}</span><span>Returned: ${h.parcels_returned}</span><span>Exchange: ${h.exchanges}</span><span>Total: ${h.total_orders}</span></div>`
    })
    document.querySelector('#orderForm').onsubmit = async e => {
      e.preventDefault()
      const msg = document.querySelector('#orderMsg')
      msg.textContent = ''
      const p = phone.value
      if (!/^\d{11}$/.test(p)) return msg.textContent = 'Phone number must contain exactly 11 digits.'
      const { data, error } = await supabase.from('orders').insert({
        created_by: user.id,
        customer_name: document.querySelector('#customer').value.trim() || null,
        phone: p,
        order_details: document.querySelector('#details').value.trim(),
        status: 'completed'
      }).select('order_number').single()
      if (error) msg.textContent = error.message
      else {
        msg.className = 'msg success'
        msg.textContent = `Order #${data.order_number} created successfully.`
        e.target.reset()
      }
    }
  }

  if (view === 'orders') {
    title.textContent = 'Orders'
    sub.textContent = 'Search and manage orders'
    const { data: orders = [], error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (error) return content.innerHTML = `<div class="card error">${escapeHtml(error.message)}</div>`
    content.innerHTML = `
      <div class="card">
        <div class="toolbar"><input id="search" placeholder="Search order number, name or phone..."><button id="refresh" class="secondary">Refresh</button></div>
        <div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody id="rows"></tbody></table></div>
      </div>`
    const render = () => {
      const q = document.querySelector('#search').value.toLowerCase()
      const filtered = orders.filter(o => `${o.order_number} ${o.customer_name || ''} ${o.phone}`.toLowerCase().includes(q))
      document.querySelector('#rows').innerHTML = filtered.map(o => `
        <tr><td><b>#${o.order_number}</b></td><td>${escapeHtml(o.customer_name || '—')}</td><td>${escapeHtml(o.phone)}</td><td><span class="badge ${o.status}">${o.status}</span></td><td>${new Date(o.created_at).toLocaleString()}</td>
        <td>${['admin','owner'].includes(profile.role) && o.status !== 'completed' ? `<button class="tiny closeorder" data-id="${o.id}">/close</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">No orders found.</td></tr>'
      document.querySelectorAll('.closeorder').forEach(b => b.onclick = async () => {
        const { error } = await supabase.rpc('close_order', { target_order_id: b.dataset.id })
        if (error) alert(error.message)
        else showView('orders', supabase, user, profile)
      })
    }
    document.querySelector('#search').oninput = render
    document.querySelector('#refresh').onclick = () => showView('orders', supabase, user, profile)
    render()
  }

  if (view === 'users') {
    title.textContent = 'User Management'
    sub.textContent = 'Owner/Admin user controls'
    const { data: users = [], error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) return content.innerHTML = `<div class="card error">${escapeHtml(error.message)}</div>`
    content.innerHTML = `
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Name</th><th>Role</th><th>Approval</th><th>Active</th><th>Action</th></tr></thead>
      <tbody>${users.map(u => `<tr><td>${escapeHtml(u.full_name)}</td><td>${escapeHtml(u.role)}</td><td><span class="badge ${u.approval_status}">${u.approval_status}</span></td><td>${u.is_active ? 'Yes' : 'No'}</td>
      <td>${profile.role === 'owner' && u.id !== user.id ? `<button class="tiny approve" data-id="${u.id}" data-status="approved">Approve</button><button class="tiny reject" data-id="${u.id}" data-status="rejected">Reject</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`
    document.querySelectorAll('.approve,.reject').forEach(b => b.onclick = async () => {
      const { error } = await supabase.from('profiles').update({ approval_status: b.dataset.status, is_active: b.dataset.status === 'approved' }).eq('id', b.dataset.id)
      if (error) alert(error.message); else showView('users', supabase, user, profile)
    })
  }

  if (view === 'activity') {
    title.textContent = 'Activity'
    sub.textContent = 'System activity log'
    const { data: logs = [], error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) return content.innerHTML = `<div class="card error">${escapeHtml(error.message)}</div>`
    content.innerHTML = `<div class="card"><div class="tablewrap"><table><thead><tr><th>Action</th><th>Description</th><th>Date</th></tr></thead><tbody>${logs.map(x => `<tr><td>${escapeHtml(x.action)}</td><td>${escapeHtml(x.description || '')}</td><td>${new Date(x.created_at).toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="3">No activity yet.</td></tr>'}</tbody></table></div></div>`
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))
}
