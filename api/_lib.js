const crypto = require('node:crypto');

const SPORTS = new Set(['Football', 'Basketball', 'Volleyball', 'Handball', 'Athlétisme', 'Autre']);
const LEVELS = new Set(['1ère année', '2ème année', 'Bachelor']);
const COOKIE = 'bds_admin';

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function config() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BDS_ADMIN_PASSWORD, SESSION_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BDS_ADMIN_PASSWORD || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error('Configuration serveur manquante. Vérifiez les variables d’environnement Vercel.');
  }
  return { url: SUPABASE_URL.replace(/\/$/, ''), key: SUPABASE_SERVICE_ROLE_KEY, password: BDS_ADMIN_PASSWORD, sessionSecret: SESSION_SECRET };
}

async function database(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let result;
  try { result = text ? JSON.parse(text) : null; } catch { result = null; }
  if (!response.ok) {
    const duplicate = response.status === 409 || result?.code === '23505';
    const error = new Error(duplicate ? 'Cette adresse e-mail est déjà utilisée.' : 'La base de données a refusé la requête.');
    error.status = duplicate ? 409 : 502;
    console.error('Database request failed:', response.status, result?.code || 'unknown');
    throw error;
  }
  return result;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

function withOrigin(req, res) {
  if (!sameOrigin(req)) { send(res, 403, { error: 'Origine non autorisée.' }); return false; }
  return true;
}

function signature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function sessionCookie() {
  const cfg = config();
  const expires = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const payload = Buffer.from(String(expires)).toString('base64url');
  const token = `${payload}.${signature(payload, cfg.sessionSecret)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`;
}

function authorized(req) {
  try {
    const cfg = config();
    const token = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token) return false;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const expected = Buffer.from(signature(payload, cfg.sessionSecret));
    const actual = Buffer.from(sig);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
    return Number(Buffer.from(payload, 'base64url').toString()) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

function requireAdmin(req, res) {
  if (!authorized(req)) { send(res, 401, { error: 'Session expirée. Connectez-vous à nouveau.' }); return false; }
  return true;
}

function equalSecret(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

function ipHash(req, scope) {
  const cfg = config();
  const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  return crypto.createHmac('sha256', cfg.sessionSecret).update(`${scope}:${ip}`).digest('hex');
}

function validate(input, { admin = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Formulaire invalide.' };
  const fields = ['lastName', 'firstName', 'program', 'email', 'phone', 'level'];
  const value = {};
  for (const name of fields) {
    value[name] = String(input[name] || '').trim();
    if (!value[name]) return { error: 'Tous les champs sont obligatoires.' };
  }
  const limits = { lastName: 80, firstName: 80, program: 120, email: 160, phone: 30, level: 30 };
  for (const [name, limit] of Object.entries(limits)) if (value[name].length > limit) return { error: 'Un ou plusieurs champs dépassent la longueur autorisée.' };
  value.email = value.email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) return { error: 'Adresse e-mail invalide.' };
  if (!LEVELS.has(value.level)) return { error: 'Niveau d’études invalide.' };
  if (!Array.isArray(input.sports) || !input.sports.length || input.sports.some(sport => !SPORTS.has(sport))) return { error: 'Sélectionnez au moins un sport valide.' };
  if (input.consent !== true) return { error: 'L’acceptation de la notice est obligatoire.' };
  value.sports = [...new Set(input.sports)];
  value.schoolYear = '2026/2027';
  value.consent = true;
  value.status = admin && input.status === 'excluded' ? 'excluded' : 'included';
  return { value };
}

function fromDatabase(row) {
  return { id: row.id, lastName: row.last_name, firstName: row.first_name, program: row.program,
    schoolYear: row.school_year, email: row.email, phone: row.phone, level: row.level,
    sports: row.sports, consent: row.consent, consentDate: row.consent_date,
    status: row.status, createdAt: row.created_at };
}

function toDatabase(value) {
  return { last_name: value.lastName, first_name: value.firstName, program: value.program,
    school_year: '2026/2027', email: value.email, phone: value.phone, level: value.level,
    sports: value.sports, consent: value.consent, consent_date: new Date().toISOString(), status: value.status };
}

function replyError(res, error) {
  send(res, error.status || 500, { error: error.status ? error.message : 'Erreur serveur. Réessayez plus tard.' });
}

module.exports = { send, config, database, withOrigin, sessionCookie, requireAdmin, equalSecret, ipHash, validate, fromDatabase, toDatabase, replyError };
