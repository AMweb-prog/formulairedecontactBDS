"""Small standard-library server and SQLite API for the BDS registration site."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from http.cookies import SimpleCookie
import hashlib, hmac, json, os, secrets, sqlite3
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get('BDS_DB_PATH', ROOT / 'data' / 'bds.sqlite3'))
ADMIN_PASSWORD = os.environ.get('BDS_ADMIN_PASSWORD', '')
SESSIONS: set[str] = set()
SPORTS = {'Football', 'Basketball', 'Volleyball', 'Handball', 'Athlétisme', 'Autre'}

def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute('''CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY, lastName TEXT NOT NULL, firstName TEXT NOT NULL,
        program TEXT NOT NULL, schoolYear TEXT NOT NULL DEFAULT '2026/2027',
        email TEXT NOT NULL COLLATE NOCASE UNIQUE, phone TEXT NOT NULL,
        level TEXT NOT NULL, sports TEXT NOT NULL, consent INTEGER NOT NULL,
        consentDate TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'included',
        createdAt TEXT NOT NULL)''')
    conn.commit()
    return conn

def iso_now(): return datetime.now(timezone.utc).isoformat(timespec='seconds')
def decode_sports(v):
    try: result = json.loads(v or '[]')
    except (TypeError, json.JSONDecodeError): result = []
    return result if isinstance(result, list) else []
def member(row):
    item = dict(row); item['sports'] = decode_sports(item['sports']); item['consent'] = bool(item['consent']); return item

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, fmt, *args): print('%s - %s' % (self.address_string(), fmt % args))
    def send_json(self, code, payload, extra=None):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store')
        for k,v in (extra or {}).items(): self.send_header(k,v)
        self.end_headers(); self.wfile.write(body)
    def read_json(self):
        try:
            length = min(int(self.headers.get('Content-Length','0')), 100_000)
            return json.loads(self.rfile.read(length) or b'{}')
        except (ValueError, json.JSONDecodeError): return None
    def is_admin(self):
        cookies=SimpleCookie(self.headers.get('Cookie',''))
        token=cookies.get('bds_session')
        return bool(token and token.value in SESSIONS)
    def do_GET(self):
        if self.path == '/api/admin/members':
            if not self.is_admin(): return self.send_json(401,{'error':'Connexion requise.'})
            with db() as c: rows=c.execute('SELECT * FROM members ORDER BY createdAt DESC').fetchall()
            return self.send_json(200,[member(r) for r in rows])
        if self.path.startswith('/api/'): return self.send_json(404,{'error':'Route inconnue.'})
        return super().do_GET()
    def do_POST(self):
        data=self.read_json()
        if data is None: return self.send_json(400,{'error':'Requête invalide.'})
        if self.path == '/api/admin/login':
            if not ADMIN_PASSWORD: return self.send_json(503,{'error':'Configurez BDS_ADMIN_PASSWORD avant de démarrer le serveur.'})
            supplied=str(data.get('password',''))
            if not hmac.compare_digest(hashlib.sha256(supplied.encode()).digest(),hashlib.sha256(ADMIN_PASSWORD.encode()).digest()): return self.send_json(401,{'error':'Mot de passe incorrect.'})
            token=secrets.token_urlsafe(32); SESSIONS.add(token)
            return self.send_json(200,{'ok':True},{'Set-Cookie':f'bds_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'})
        if self.path == '/api/admin/logout':
            cookies=SimpleCookie(self.headers.get('Cookie','')); token=cookies.get('bds_session')
            if token: SESSIONS.discard(token.value)
            return self.send_json(200,{'ok':True},{'Set-Cookie':'bds_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})
        if self.path not in ('/api/members','/api/admin/members'): return self.send_json(404,{'error':'Route inconnue.'})
        admin=self.path.startswith('/api/admin/')
        if admin and not self.is_admin(): return self.send_json(401,{'error':'Connexion requise.'})
        item=self.clean(data,admin)
        if isinstance(item,str): return self.send_json(400,{'error':item})
        item.update(id=secrets.token_hex(16), schoolYear='2026/2027', consentDate=iso_now(), createdAt=iso_now())
        try:
            with db() as c: c.execute('INSERT INTO members VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',self.values(item))
        except sqlite3.IntegrityError: return self.send_json(409,{'error':'Une inscription existe déjà avec cette adresse e-mail.'})
        return self.send_json(201,item)
    def do_PUT(self):
        if not self.is_admin(): return self.send_json(401,{'error':'Connexion requise.'})
        ident=self.path.removeprefix('/api/admin/members/'); data=self.read_json()
        if not ident or '/' in ident or data is None: return self.send_json(400,{'error':'Requête invalide.'})
        item=self.clean(data,True)
        if isinstance(item,str): return self.send_json(400,{'error':item})
        try:
            with db() as c:
                cur=c.execute('UPDATE members SET lastName=?,firstName=?,program=?,schoolYear=?,email=?,phone=?,level=?,sports=?,consent=?,status=? WHERE id=?',(*self.values(item)[1:10],item['status'],ident))
                if not cur.rowcount: return self.send_json(404,{'error':'Membre introuvable.'})
                row=c.execute('SELECT * FROM members WHERE id=?',(ident,)).fetchone()
        except sqlite3.IntegrityError: return self.send_json(409,{'error':'Cette adresse e-mail est déjà utilisée.'})
        return self.send_json(200,member(row))
    def do_DELETE(self):
        if not self.is_admin(): return self.send_json(401,{'error':'Connexion requise.'})
        ident=self.path.removeprefix('/api/admin/members/')
        if not ident or '/' in ident: return self.send_json(400,{'error':'Identifiant invalide.'})
        with db() as c: cur=c.execute('DELETE FROM members WHERE id=?',(ident,))
        if not cur.rowcount: return self.send_json(404,{'error':'Membre introuvable.'})
        return self.send_json(200,{'ok':True})
    def clean(self,d,admin):
        fields=['lastName','firstName','program','email','phone','level']
        out={k:str(d.get(k,'')).strip() for k in fields}
        if any(not out[k] for k in fields): return 'Tous les champs sont obligatoires.'
        if len(out['email'])>160 or '@' not in out['email']: return 'Adresse e-mail invalide.'
        sports=d.get('sports',[])
        if not isinstance(sports,list) or not sports or any(s not in SPORTS for s in sports): return 'Sélectionnez au moins un sport valide.'
        if out['level'] not in ('1ère année','2ème année','Bachelor'): return 'Niveau d’études invalide.'
        consent=bool(d.get('consent'))
        if not consent and not admin: return 'L’acceptation de la notice est obligatoire.'
        status=d.get('status','included') if admin else 'included'
        if status not in ('included','excluded'): return 'Statut invalide.'
        return {**out,'schoolYear':'2026/2027','sports':sports,'consent':consent,'status':status}
    def values(self,x): return (x.get('id',''),x['lastName'],x['firstName'],x['program'],'2026/2027',x['email'],x['phone'],x['level'],json.dumps(x['sports'],ensure_ascii=False),int(x['consent']),x.get('consentDate',iso_now()),x['status'],x.get('createdAt',iso_now()))

if __name__ == '__main__':
    if not ADMIN_PASSWORD: raise SystemExit('Définissez la variable BDS_ADMIN_PASSWORD avant de démarrer (voir README.md).')
    with db() as conn: pass
    print(f'BDS actif sur http://127.0.0.1:8000 — base SQLite : {DB_PATH}')
    ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
