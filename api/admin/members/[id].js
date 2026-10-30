const { send, database, withOrigin, requireAdmin, validate, toDatabase, fromDatabase, replyError } = require('../../_lib');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const id = String(req.query?.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: 'Identifiant invalide.' });
  if (!withOrigin(req, res)) return;
  if (req.method === 'PUT') {
    const checked = validate(req.body, { admin: true });
    if (checked.error) return send(res, 400, { error: checked.error });
    const values = toDatabase(checked.value);
    delete values.consent_date;
    try {
      const rows = await database(`members?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(values) });
      if (!rows.length) return send(res, 404, { error: 'Membre introuvable.' });
      return send(res, 200, fromDatabase(rows[0]));
    } catch (error) { return replyError(res, error); }
  }
  if (req.method === 'DELETE') {
    try {
      const rows = await database(`members?id=eq.${encodeURIComponent(id)}&select=id`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
      if (!rows.length) return send(res, 404, { error: 'Membre introuvable.' });
      return send(res, 200, { ok: true });
    } catch (error) { return replyError(res, error); }
  }
  return send(res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'PUT, DELETE' });
};
