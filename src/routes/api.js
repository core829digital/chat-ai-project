// API pubblica chiamata dal widget installato sui siti dei clienti.
// Nessun cookie richiesto: l'accesso è controllato da ID widget + dominio autorizzato.
import { config, PLANS } from '../config.js';
import { canManageAccount, SESSION_COOKIE } from '../auth.js';
import { HttpError, str } from '../lib/http.js';
import { createRateLimiter, isEmail } from '../lib/security.js';
import { respond } from '../lib/responder.js';
import * as M from '../models.js';

const ownOrigin = new URL(config.baseUrl).origin;
const messageLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
const leadLimiter = createRateLimiter({ windowMs: 10 * 60_000, max: 5 });

export function hostAllowed(host, domains) {
  if (!domains || !domains.length) return true;
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  return domains.some((d) => h === d || h.endsWith(`.${d}`));
}

function cors(ctx) {
  const origin = ctx.req.headers.origin;
  ctx.res.setHeader('Access-Control-Allow-Origin', origin || '*');
  ctx.res.setHeader('Vary', 'Origin');
  ctx.res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  ctx.res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  ctx.res.setHeader('Access-Control-Max-Age', '600');
}

const clientIp = (ctx) =>
  (config.production && String(ctx.req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || ctx.req.socket.remoteAddress || '';

// Carica il widget e verifica che la richiesta arrivi da un dominio autorizzato.
async function loadPublicWidget(ctx) {
  cors(ctx);
  const widget = await M.getWidgetByPublicId(ctx.params.pid);
  if (!widget) throw new HttpError(404, 'Widget non trovato');
  const origin = ctx.req.headers.origin;
  if (origin && origin !== ownOrigin && origin !== 'null') {
    let host = '';
    try {
      host = new URL(origin).hostname;
    } catch {
      /* origin non valida */
    }
    if (!hostAllowed(host, widget.allowed_domains)) {
      throw new HttpError(403, `Dominio non autorizzato per questo widget: ${host}`);
    }
  }
  const account = await M.getAccount(widget.account_id);
  return { widget, account };
}

// Le richieste di anteprima dalla dashboard (stessa origine + sessione del proprietario) sono "di prova":
// non contano nei limiti del piano e restano distinguibili nelle statistiche.
async function isOwnerPreview(ctx, widget) {
  if (!ctx.body.preview || ctx.req.headers.origin !== ownOrigin) return false;
  const session = await M.getSession(ctx.cookies[SESSION_COOKIE]);
  return Boolean(session && canManageAccount(session.user, widget.account_id));
}

function publicSettings(widget, account) {
  const s = widget.settings;
  const plan = PLANS[account.plan] || PLANS.pro;
  return {
    title: s.title,
    subtitle: s.subtitle,
    welcomeMessage: s.welcomeMessage,
    launcherLabel: s.launcherLabel,
    color: s.color,
    position: s.position,
    avatarText: s.avatarText,
    leadCapture: s.leadCapture,
    askPhone: s.askPhone,
    privacyUrl: s.privacyUrl,
    quickReplies: s.quickReplies || [],
    showBranding: plan.branding ? true : Boolean(s.showBranding),
  };
}

export function registerApi(router) {
  router.options('/api/widget/:pid/config', async (ctx) => { cors(ctx); ctx.text('', 204); });
  router.options('/api/widget/:pid/messages', async (ctx) => { cors(ctx); ctx.text('', 204); });
  router.options('/api/widget/:pid/leads', async (ctx) => { cors(ctx); ctx.text('', 204); });

  router.get('/api/widget/:pid/config', async (ctx) => {
    const { widget, account } = await loadPublicWidget(ctx);
    const serving = widget.status === 'active' && M.accountIsServing(account);
    if (!serving) return ctx.json({ active: false });
    ctx.json({
      active: true,
      id: widget.public_id,
      brand: { name: config.brand.name, url: config.baseUrl },
      settings: publicSettings(widget, account),
    });
  });

  router.post('/api/widget/:pid/messages', async (ctx) => {
    const { widget, account } = await loadPublicWidget(ctx);
    if (widget.status !== 'active' || !M.accountIsServing(account)) throw new HttpError(403, 'Assistente non attivo');
    const text = str(ctx.body.text, 1000);
    if (!text) throw new HttpError(400, 'Messaggio vuoto');
    if (!messageLimiter(`${clientIp(ctx)}:${widget.id}`)) {
      throw new HttpError(429, 'Stai scrivendo troppo velocemente. Riprova tra un minuto.');
    }
    const isTest = await isOwnerPreview(ctx, widget);
    const visitorId = str(ctx.body.visitorId, 64) || 'anonimo';
    const pageUrl = str(ctx.body.pageUrl, 500);

    let conversation = ctx.body.conversationId ? await M.getConversation(widget.id, str(ctx.body.conversationId, 40)) : null;
    if (!conversation) {
      conversation = await M.createConversation({ widgetId: widget.id, visitorId, pageUrl, isTest });
    }
    if (!isTest) await M.markWidgetSeen(widget.id, pageUrl);

    await M.addMessage(conversation.id, { role: 'visitor', body: text });

    const plan = PLANS[account.plan] || PLANS.pro;
    const overLimit = !isTest && await M.accountConversationsThisMonth(account.id) > plan.conversations;
    let result;
    if (overLimit) {
      result = {
        text: 'In questo momento non posso rispondere automaticamente. Lasciami i tuoi recapiti e ti ricontatteremo.',
        knowledgeId: null, outcome: 'limit', action: 'lead_form', suggestions: [],
      };
    } else {
      result = await respond({ settings: widget.settings, knowledge: await M.listKnowledge(widget.id), message: text });
    }
    await M.addMessage(conversation.id, { role: 'bot', body: result.text, knowledgeId: result.knowledgeId, outcome: result.outcome });
    if (result.knowledgeId && !isTest) await M.hitKnowledge(result.knowledgeId);

    ctx.json({
      conversationId: conversation.public_id,
      reply: { text: result.text },
      action: result.action,
      suggestions: result.suggestions,
    });
  });

  router.post('/api/widget/:pid/leads', async (ctx) => {
    const { widget, account } = await loadPublicWidget(ctx);
    if (widget.status !== 'active' || !M.accountIsServing(account)) throw new HttpError(403, 'Assistente non attivo');
    if (!leadLimiter(`${clientIp(ctx)}:${widget.id}`)) throw new HttpError(429, 'Troppi invii. Riprova più tardi.');

    const name = str(ctx.body.name, 120);
    const email = str(ctx.body.email, 254).toLowerCase();
    const phone = str(ctx.body.phone, 40).replace(/[^\d+\s().-]/g, '');
    const message = str(ctx.body.message, 1000);
    const errors = {};
    if (!name) errors.name = 'Scrivi il tuo nome';
    if (!email && !phone) errors.email = 'Serve almeno un’email o un telefono';
    if (email && !isEmail(email)) errors.email = 'Email non valida';
    if (ctx.body.consent !== true && ctx.body.consent !== 'true') errors.consent = 'Serve il consenso per ricontattarti';
    if (Object.keys(errors).length) return ctx.json({ error: 'Controlla i campi evidenziati', fields: errors }, 422);

    const conversation = ctx.body.conversationId ? await M.getConversation(widget.id, str(ctx.body.conversationId, 40)) : null;
    const isTest = await isOwnerPreview(ctx, widget);
    await M.createLead({ widgetId: widget.id, conversationId: conversation?.id || null, name, email, phone, message, isTest });
    const reply = `Grazie ${name.split(' ')[0]}! Abbiamo ricevuto i tuoi recapiti: ti ricontatteremo al più presto.`;
    if (conversation) await M.addMessage(conversation.id, { role: 'bot', body: reply, outcome: 'lead' });
    ctx.json({ ok: true, reply: { text: reply } });
  });
}
