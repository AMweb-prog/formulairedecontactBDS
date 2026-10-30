const { send, config, withOrigin, sessionCookie, equalSecret, ipHash, database, replyError } = require('../_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
  if (!withOrigin(req, res)) return;
  try {
    const cfg = config();
    const withinLimit = await database('rpc/check_request_rate_limit', { method: 'POST', body: JSON.stringify({ p_scope: 'admin_login', p_ip_hash: ipHash(req, 'admin_login'), p_limit: 8, p_window_minutes: 15 }) });
    if (withinLimit !== true) return send(res, 429, { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { 'Retry-After': '900' });
    if (!equalSecret(req.body?.password || '', cfg.password)) return send(res, 401, { error: 'Mot de passe incorrect.' });
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie() });
  } catch (error) { return replyError(res, error); }
};
