const { send, withOrigin } = require('../_lib');
module.exports = function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
  if (!withOrigin(req, res)) return;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return send(res, 200, { ok: true }, { 'Set-Cookie': `bds_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}` });
};
