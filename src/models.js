// Accesso ai dati. Tutte le query passano da qui.
import { all, one, run, tx } from './db.js';
import { config, PLANS } from './config.js';
import { hashPassword, publicId, randomToken, sha256 } from './lib/security.js';
import { SECTORS, defaultSettings } from './templates.js';

const isoIn = (days) => new Date(Date.now() + days * 86400000).toISOString().replace('T', ' ').slice(0, 19);
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().replace('T', ' ').slice(0, 19);
};
const daysAgo = (n) => isoIn(-n);

// ---------------- Account e utenti ----------------

export function createAccountWithUser({ company, name, email, password, plan = 'pro', status = 'trial', sector = 'generico', createdBy = 'self' }) {
  return tx(() => {
    const acc = run(
      `INSERT INTO accounts (name, plan, status, sector, trial_ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      company, plan, status, sector, status === 'trial' ? isoIn(config.trialDays) : null, createdBy,
    );
    const accountId = Number(acc.lastInsertRowid);
    const user = run(
      `INSERT INTO users (email, name, password_hash, role, account_id) VALUES (?, ?, ?, 'client', ?)`,
      email, name, password ? hashPassword(password) : null, accountId,
    );
    return { accountId, userId: Number(user.lastInsertRowid) };
  });
}

export function createAdmin({ email, name, password }) {
  const r = run(`INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')`, email, name, hashPassword(password));
  return Number(r.lastInsertRowid);
}

export const findUserByEmail = (email) => one(`SELECT * FROM users WHERE email = ?`, email);
export const getUser = (id) => one(`SELECT * FROM users WHERE id = ?`, id);
export const getAccount = (id) => one(`SELECT * FROM accounts WHERE id = ?`, id);
export const listAccountUsers = (accountId) => all(`SELECT * FROM users WHERE account_id = ? ORDER BY id`, accountId);

export function setPassword(userId, password) {
  run(`UPDATE users SET password_hash = ? WHERE id = ?`, hashPassword(password), userId);
}

export function updateUserName(userId, name) {
  run(`UPDATE users SET name = ? WHERE id = ?`, name, userId);
}

export function touchLogin(userId) {
  run(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, userId);
}

export function updateAccount(id, fields) {
  const allowed = ['name', 'plan', 'status', 'sector', 'trial_ends_at', 'notes'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!keys.length) return;
  run(`UPDATE accounts SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => fields[k]), id);
}

export function deleteAccount(id) {
  run(`DELETE FROM accounts WHERE id = ?`, id);
}

// Un account in prova scaduto viene trattato come sospeso dal widget.
export function accountIsServing(acc) {
  if (!acc) return false;
  if (acc.status === 'suspended') return false;
  if (acc.status === 'trial' && acc.trial_ends_at && acc.trial_ends_at < isoIn(0)) return false;
  return true;
}

export function listAccounts({ q = '', status = '' } = {}) {
  const where = [];
  const params = [];
  if (q) {
    where.push(`(a.name LIKE ? OR EXISTS (SELECT 1 FROM users u2 WHERE u2.account_id = a.id AND u2.email LIKE ?))`);
    params.push(`%${q}%`, `%${q}%`);
  }
  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }
  return all(
    `SELECT a.*,
       (SELECT email FROM users u WHERE u.account_id = a.id ORDER BY u.id LIMIT 1) AS owner_email,
       (SELECT name FROM users u WHERE u.account_id = a.id ORDER BY u.id LIMIT 1) AS owner_name,
       (SELECT last_login_at FROM users u WHERE u.account_id = a.id ORDER BY u.last_login_at DESC LIMIT 1) AS last_login_at,
       (SELECT COUNT(*) FROM widgets w WHERE w.account_id = a.id) AS widget_count,
       (SELECT COUNT(*) FROM conversations c JOIN widgets w ON w.id = c.widget_id
          WHERE w.account_id = a.id AND c.is_test = 0 AND c.started_at >= ?) AS conv_month
     FROM accounts a ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY a.created_at DESC, a.id DESC`,
    monthStart(), ...params,
  );
}

// ---------------- Sessioni e inviti ----------------

export function createSession(userId, impersonatorId = null) {
  const token = randomToken();
  run(
    `INSERT INTO sessions (token_hash, user_id, impersonator_id, expires_at) VALUES (?, ?, ?, ?)`,
    sha256(token), userId, impersonatorId, isoIn(config.sessionDays),
  );
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const s = one(`SELECT * FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')`, sha256(token));
  if (!s) return null;
  const user = getUser(s.user_id);
  if (!user) return null;
  return { ...s, user, impersonator: s.impersonator_id ? getUser(s.impersonator_id) : null };
}

export const deleteSession = (token) => run(`DELETE FROM sessions WHERE token_hash = ?`, sha256(token || ''));
export const deleteUserSessions = (userId) => run(`DELETE FROM sessions WHERE user_id = ?`, userId);

export function createInvite(userId) {
  const token = randomToken(24);
  run(`DELETE FROM invites WHERE user_id = ? AND used_at IS NULL`, userId);
  run(`INSERT INTO invites (token_hash, user_id, expires_at) VALUES (?, ?, ?)`, sha256(token), userId, isoIn(config.inviteDays));
  return token;
}

export function getInvite(token) {
  if (!token) return null;
  const inv = one(
    `SELECT * FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
    sha256(token),
  );
  return inv ? { ...inv, user: getUser(inv.user_id) } : null;
}

export function pendingInvite(userId) {
  return one(`SELECT * FROM invites WHERE user_id = ? AND used_at IS NULL AND expires_at > datetime('now')`, userId);
}

export function consumeInvite(token, password) {
  return tx(() => {
    const inv = getInvite(token);
    if (!inv) return null;
    run(`UPDATE invites SET used_at = datetime('now') WHERE token_hash = ?`, inv.token_hash);
    setPassword(inv.user_id, password);
    return inv.user;
  });
}

// ---------------- Widget ----------------

function hydrateWidget(row) {
  if (!row) return row;
  return { ...row, settings: JSON.parse(row.settings || '{}'), allowed_domains: JSON.parse(row.allowed_domains || '[]') };
}

export function createWidget({ accountId, name, siteUrl = '', sector = 'generico', withTemplate = true, fixedPublicId = null }) {
  const acc = getAccount(accountId);
  const plan = PLANS[acc?.plan] || PLANS.pro;
  const settings = defaultSettings({ name, sector, showBranding: plan.branding });
  if (!withTemplate) settings.quickReplies = [];
  const domains = domainFromUrl(siteUrl) ? [domainFromUrl(siteUrl)] : [];
  return tx(() => {
    const r = run(
      `INSERT INTO widgets (public_id, account_id, name, site_url, allowed_domains, settings) VALUES (?, ?, ?, ?, ?, ?)`,
      fixedPublicId || publicId('wdg'), accountId, name, siteUrl, JSON.stringify(domains), JSON.stringify(settings),
    );
    const widgetId = Number(r.lastInsertRowid);
    if (withTemplate) {
      for (const [question, answer, keywords] of (SECTORS[sector] || SECTORS.generico).faq) {
        run(`INSERT INTO knowledge (widget_id, question, answer, keywords) VALUES (?, ?, ?, ?)`, widgetId, question, answer, keywords);
      }
    }
    return getWidget(widgetId);
  });
}

export const getWidget = (id) => hydrateWidget(one(`SELECT * FROM widgets WHERE id = ?`, id));
export const getWidgetByPublicId = (pid) => hydrateWidget(one(`SELECT * FROM widgets WHERE public_id = ?`, pid));

export function listWidgets(accountId) {
  return all(
    `SELECT w.*,
       (SELECT COUNT(*) FROM knowledge k WHERE k.widget_id = w.id) AS knowledge_count,
       (SELECT COUNT(*) FROM conversations c WHERE c.widget_id = w.id AND c.is_test = 0 AND c.started_at >= ?) AS conv_30d,
       (SELECT COUNT(*) FROM leads l WHERE l.widget_id = w.id AND l.is_test = 0 AND l.created_at >= ?) AS leads_30d
     FROM widgets w WHERE w.account_id = ? ORDER BY w.created_at, w.id`,
    daysAgo(30), daysAgo(30), accountId,
  ).map(hydrateWidget);
}

export function listAllWidgets() {
  return all(
    `SELECT w.*, a.name AS account_name, a.status AS account_status, a.plan AS account_plan,
       (SELECT COUNT(*) FROM knowledge k WHERE k.widget_id = w.id) AS knowledge_count,
       (SELECT COUNT(*) FROM conversations c WHERE c.widget_id = w.id AND c.is_test = 0 AND c.started_at >= ?) AS conv_30d,
       (SELECT COUNT(*) FROM leads l WHERE l.widget_id = w.id AND l.is_test = 0 AND l.created_at >= ?) AS leads_30d
     FROM widgets w JOIN accounts a ON a.id = w.account_id ORDER BY w.created_at DESC, w.id DESC`,
    daysAgo(30), daysAgo(30),
  ).map(hydrateWidget);
}

export function updateWidget(id, { name, siteUrl, allowedDomains, settings, status }) {
  const w = getWidget(id);
  if (!w) return null;
  run(
    `UPDATE widgets SET name = ?, site_url = ?, allowed_domains = ?, settings = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    name ?? w.name,
    siteUrl ?? w.site_url,
    JSON.stringify(allowedDomains ?? w.allowed_domains),
    JSON.stringify(settings ? { ...w.settings, ...settings } : w.settings),
    status ?? w.status,
    id,
  );
  return getWidget(id);
}

export const deleteWidget = (id) => run(`DELETE FROM widgets WHERE id = ?`, id);
export const countWidgets = (accountId) => one(`SELECT COUNT(*) AS n FROM widgets WHERE account_id = ?`, accountId).n;

export function markWidgetSeen(id, pageUrl) {
  // Un messaggio senza pagina (es. inviato da un'app) non cancella l'ultima pagina nota.
  run(
    `UPDATE widgets SET last_seen_at = datetime('now'), last_seen_url = COALESCE(NULLIF(?, ''), last_seen_url) WHERE id = ?`,
    String(pageUrl || '').slice(0, 500), id,
  );
}

export function domainFromUrl(url) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

// ---------------- Risposte (knowledge) ----------------

export const listKnowledge = (widgetId) => all(`SELECT * FROM knowledge WHERE widget_id = ? ORDER BY id`, widgetId);
export const getKnowledge = (id) => one(`SELECT * FROM knowledge WHERE id = ?`, id);

export function addKnowledge(widgetId, { question, answer, keywords = '' }) {
  return Number(run(`INSERT INTO knowledge (widget_id, question, answer, keywords) VALUES (?, ?, ?, ?)`, widgetId, question, answer, keywords).lastInsertRowid);
}

export function updateKnowledge(id, { question, answer, keywords = '' }) {
  run(`UPDATE knowledge SET question = ?, answer = ?, keywords = ?, updated_at = datetime('now') WHERE id = ?`, question, answer, keywords, id);
}

export const deleteKnowledge = (id) => run(`DELETE FROM knowledge WHERE id = ?`, id);
export const hitKnowledge = (id) => run(`UPDATE knowledge SET hits = hits + 1 WHERE id = ?`, id);

// Domande a cui il widget non ha saputo rispondere: sono la lista di cose da aggiungere.
export function unansweredQuestions(widgetId, limit = 20) {
  return all(
    `SELECT m.body, m.created_at, c.public_id AS conversation
     FROM messages m
     JOIN messages b ON b.conversation_id = m.conversation_id AND b.id = (SELECT MIN(id) FROM messages WHERE conversation_id = m.conversation_id AND id > m.id)
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.widget_id = ? AND m.role = 'visitor' AND b.outcome = 'fallback'
     ORDER BY m.id DESC LIMIT ?`,
    widgetId, limit,
  );
}

// ---------------- Conversazioni e messaggi ----------------

export function getConversation(widgetId, conversationPublicId) {
  return one(`SELECT * FROM conversations WHERE widget_id = ? AND public_id = ?`, widgetId, conversationPublicId);
}

export function createConversation({ widgetId, visitorId, pageUrl, isTest }) {
  const pid = publicId('cnv', 16);
  run(
    `INSERT INTO conversations (public_id, widget_id, visitor_id, page_url, is_test) VALUES (?, ?, ?, ?, ?)`,
    pid, widgetId, visitorId, String(pageUrl || '').slice(0, 500), isTest ? 1 : 0,
  );
  return getConversation(widgetId, pid);
}

export function addMessage(conversationId, { role, body, knowledgeId = null, outcome = '' }) {
  run(
    `INSERT INTO messages (conversation_id, role, body, knowledge_id, outcome) VALUES (?, ?, ?, ?, ?)`,
    conversationId, role, body, knowledgeId, outcome,
  );
  run(
    `UPDATE conversations SET message_count = message_count + 1, last_at = datetime('now'),
       unanswered = unanswered + ? WHERE id = ?`,
    outcome === 'fallback' ? 1 : 0, conversationId,
  );
}

export function listConversations(widgetId, { filter = 'all', limit = 100, includeTest = true } = {}) {
  const where = ['c.widget_id = ?'];
  if (!includeTest) where.push('c.is_test = 0');
  if (filter === 'unanswered') where.push('c.unanswered > 0');
  if (filter === 'leads') where.push('c.has_lead = 1');
  return all(
    `SELECT c.*, (SELECT body FROM messages m WHERE m.conversation_id = c.id AND m.role = 'visitor' ORDER BY m.id LIMIT 1) AS first_message
     FROM conversations c WHERE ${where.join(' AND ')} ORDER BY c.last_at DESC, c.id DESC LIMIT ?`,
    widgetId, limit,
  );
}

export const listMessages = (conversationId) => all(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY id`, conversationId);

export function accountConversationsThisMonth(accountId) {
  return one(
    `SELECT COUNT(*) AS n FROM conversations c JOIN widgets w ON w.id = c.widget_id
     WHERE w.account_id = ? AND c.is_test = 0 AND c.started_at >= ?`,
    accountId, monthStart(),
  ).n;
}

// ---------------- Contatti (lead) ----------------

export function createLead({ widgetId, conversationId, name, email, phone, message, isTest }) {
  const id = Number(run(
    `INSERT INTO leads (widget_id, conversation_id, name, email, phone, message, is_test) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    widgetId, conversationId, name, email, phone, message, isTest ? 1 : 0,
  ).lastInsertRowid);
  if (conversationId) run(`UPDATE conversations SET has_lead = 1 WHERE id = ?`, conversationId);
  return id;
}

export function listLeads({ accountId, widgetId, status = '', limit = 500 }) {
  const where = [];
  const params = [];
  if (accountId) { where.push('w.account_id = ?'); params.push(accountId); }
  if (widgetId) { where.push('l.widget_id = ?'); params.push(widgetId); }
  if (status) { where.push('l.status = ?'); params.push(status); }
  return all(
    `SELECT l.*, w.name AS widget_name, w.public_id AS widget_public_id, c.public_id AS conversation_public_id
     FROM leads l JOIN widgets w ON w.id = l.widget_id LEFT JOIN conversations c ON c.id = l.conversation_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.created_at DESC, l.id DESC LIMIT ?`,
    ...params, limit,
  );
}

export const getLead = (id) => one(`SELECT l.*, w.account_id FROM leads l JOIN widgets w ON w.id = l.widget_id WHERE l.id = ?`, id);
export const setLeadStatus = (id, status) => run(`UPDATE leads SET status = ? WHERE id = ?`, status, id);

// ---------------- Statistiche ----------------

export function widgetStats(widgetId, days = 30) {
  const since = daysAgo(days);
  const c = one(
    `SELECT COUNT(*) AS conversations, COALESCE(SUM(message_count), 0) AS messages,
       COALESCE(SUM(CASE WHEN unanswered > 0 THEN 1 ELSE 0 END), 0) AS with_unanswered
     FROM conversations WHERE widget_id = ? AND is_test = 0 AND started_at >= ?`,
    widgetId, since,
  );
  const answers = one(
    `SELECT COALESCE(SUM(CASE WHEN m.outcome = 'answered' THEN 1 ELSE 0 END), 0) AS answered,
       COALESCE(SUM(CASE WHEN m.outcome = 'fallback' THEN 1 ELSE 0 END), 0) AS fallback
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE c.widget_id = ? AND c.is_test = 0 AND m.created_at >= ? AND m.role = 'bot'`,
    widgetId, since,
  );
  const leads = one(`SELECT COUNT(*) AS n FROM leads WHERE widget_id = ? AND is_test = 0 AND created_at >= ?`, widgetId, since).n;
  const asked = answers.answered + answers.fallback;
  return { ...c, ...answers, leads, answerRate: asked ? answers.answered / asked : null };
}

export function dailyConversations(widgetIds, days = 30) {
  if (!widgetIds.length) return [];
  const rows = all(
    `SELECT date(started_at) AS day, COUNT(*) AS n FROM conversations
     WHERE widget_id IN (${widgetIds.map(() => '?').join(',')}) AND is_test = 0 AND started_at >= ?
     GROUP BY day`,
    ...widgetIds, daysAgo(days),
  );
  const map = new Map(rows.map((r) => [r.day, r.n]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push({ day: d, n: map.get(d) || 0 });
  }
  return out;
}

export function platformStats() {
  const accounts = all(`SELECT status, plan, trial_ends_at FROM accounts`);
  const now = isoIn(0);
  let mrr = 0;
  const byStatus = { trial: 0, active: 0, suspended: 0, expired: 0 };
  for (const a of accounts) {
    if (a.status === 'active') mrr += PLANS[a.plan]?.price || 0;
    if (a.status === 'trial' && a.trial_ends_at && a.trial_ends_at < now) byStatus.expired++;
    else byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  }
  const month = monthStart();
  return {
    accounts: accounts.length,
    byStatus,
    mrr,
    widgets: one(`SELECT COUNT(*) AS n FROM widgets`).n,
    widgetsLive: one(`SELECT COUNT(*) AS n FROM widgets WHERE last_seen_at >= ?`, daysAgo(7)).n,
    conversationsMonth: one(`SELECT COUNT(*) AS n FROM conversations WHERE is_test = 0 AND started_at >= ?`, month).n,
    leadsMonth: one(`SELECT COUNT(*) AS n FROM leads WHERE is_test = 0 AND created_at >= ?`, month).n,
    trialsEndingSoon: all(
      `SELECT a.*, (SELECT email FROM users u WHERE u.account_id = a.id ORDER BY u.id LIMIT 1) AS owner_email
       FROM accounts a WHERE a.status = 'trial' AND a.trial_ends_at BETWEEN ? AND ? ORDER BY a.trial_ends_at`,
      now, isoIn(5),
    ),
  };
}

export function allWidgetIds() {
  return all(`SELECT id FROM widgets`).map((r) => r.id);
}

export function recentConversations(limit = 10) {
  return all(
    `SELECT c.*, w.name AS widget_name, w.id AS widget_db_id, a.name AS account_name,
       (SELECT body FROM messages m WHERE m.conversation_id = c.id AND m.role = 'visitor' ORDER BY m.id LIMIT 1) AS first_message
     FROM conversations c JOIN widgets w ON w.id = c.widget_id JOIN accounts a ON a.id = w.account_id
     WHERE c.is_test = 0 ORDER BY c.last_at DESC LIMIT ?`,
    limit,
  );
}
