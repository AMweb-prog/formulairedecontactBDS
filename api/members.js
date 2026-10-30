const { send, database, withOrigin, ipHash, validate, toDatabase, fromDatabase, replyError } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
  if (!withOrigin(req, res)) return;
  try {
    const withinLimit = await database('rpc/check_request_rate_limit', { method: 'POST', body: JSON.stringify({ p_scope: 'public_register', p_ip_hash: ipHash(req, 'public_register'), p_limit: 120, p_window_minutes: 60 }) });
    if (withinLimit !== true) return send(res, 429, { error: 'Trop de demandes depuis cette connexion. Réessayez plus tard.' }, { 'Retry-After': '3600' });
  } catch (error) { return replyError(res, error); }
  const checked = validate(req.body);
  if (checked.error) return send(res, 400, { error: checked.error });
  try {
    const rows = await database('members', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(toDatabase(checked.value)) });
    return send(res, 201, fromDatabase(rows[0]));
  } catch (error) { return replyError(res, error); }
};
