const { send, database, withOrigin, requireAdmin, validate, toDatabase, fromDatabase, replyError } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === 'GET') {
    try {
      const rows = await database('members?select=*&order=created_at.desc');
      return send(res, 200, rows.map(fromDatabase));
    } catch (error) { return replyError(res, error); }
  }
  if (req.method === 'POST') {
    if (!withOrigin(req, res)) return;
    const checked = validate(req.body, { admin: true });
    if (checked.error) return send(res, 400, { error: checked.error });
    try {
      const rows = await database('members', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(toDatabase(checked.value)) });
      return send(res, 201, fromDatabase(rows[0]));
    } catch (error) { return replyError(res, error); }
  }
  return send(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET, POST' });
};
