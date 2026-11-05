// Local server for the site: node serve.js  ->  http://localhost:5500
// Serves the static pages and a small API used by blog-admin.html to add/delete blog posts.
// Posts live in data/posts.json; their images go to wp-content/uploads/blog/.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const root = __dirname;
const PORT = Number(process.env.PORT) || 5500;
const DATA_DIR = path.join(root, 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const UPLOAD_DIR = path.join(root, 'wp-content', 'uploads', 'blog');
const MAX_BODY = 12 * 1024 * 1024; // featured image arrives base64-encoded inside JSON
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]\n');

// Admin password: BLOG_ADMIN_PASSWORD wins; otherwise one is generated once and kept in data/admin.json.
function adminPassword() {
  if (process.env.BLOG_ADMIN_PASSWORD) return process.env.BLOG_ADMIN_PASSWORD;
  if (!fs.existsSync(ADMIN_FILE)) {
    fs.writeFileSync(ADMIN_FILE, JSON.stringify({ password: crypto.randomBytes(6).toString('hex') }, null, 2) + '\n');
  }
  return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8')).password;
}
const PASSWORD = adminPassword();
const passwordOk = (given) => {
  const a = Buffer.from(String(given || '')), b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const readPosts = () => { try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')); } catch { return []; } };
function writePosts(posts) {
  const tmp = POSTS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(posts, null, 2) + '\n');
  fs.renameSync(tmp, POSTS_FILE);
}

// Slugs of the two posts that already exist as their own pages.
const STATIC_SLUGS = ['choosing-the-right-packaging-partner-for-your-business', 'why-packaging-is-more-than-just-a-box'];
function slugify(title, posts) {
  const base = String(title).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'post';
  const taken = new Set(posts.map((p) => p.slug).concat(STATIC_SLUGS));
  let slug = base, n = 2;
  while (taken.has(slug)) slug = base + '-' + n++;
  return slug;
}

const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too-large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

async function api(req, res, p) {
  if (p === '/api/posts' && req.method === 'GET') return send(res, 200, readPosts());

  if (p === '/api/login' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'Invalid request.' }); }
    return passwordOk(body.password) ? send(res, 200, { ok: true }) : send(res, 401, { error: 'Wrong password.' });
  }

  if (p === '/api/posts' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch (e) { return send(res, e.message === 'too-large' ? 413 : 400, { error: e.message === 'too-large' ? 'Image is too large (max about 8 MB).' : 'Invalid request.' }); }
    if (!passwordOk(body.password)) return send(res, 401, { error: 'Wrong password.' });

    const title = clean(body.title, 160), content = clean(body.content, 60000);
    if (!title) return send(res, 400, { error: 'Title is required.' });
    if (!content) return send(res, 400, { error: 'Content is required.' });
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
    if (!m) return send(res, 400, { error: 'Please choose a JPG, PNG or WebP featured image.' });

    const posts = readPosts();
    const slug = slugify(title, posts);
    const file = slug + IMAGE_TYPES[m[1]];
    fs.writeFileSync(path.join(UPLOAD_DIR, file), Buffer.from(m[2], 'base64'));

    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
    const post = {
      slug, title,
      author: clean(body.author, 60) || 'Uday Multiprint',
      category: clean(body.category, 60) || 'Print Shop',
      date,
      excerpt: clean(body.excerpt, 400),
      content,
      image: 'wp-content/uploads/blog/' + file,
      created: new Date().toISOString(),
    };
    posts.unshift(post);
    writePosts(posts);
    console.log('Blog post added:', slug);
    return send(res, 201, post);
  }

  const del = /^\/api\/posts\/([a-z0-9-]+)$/.exec(p);
  if (del && req.method === 'DELETE') {
    if (!passwordOk(req.headers['x-admin-password'])) return send(res, 401, { error: 'Wrong password.' });
    const posts = readPosts();
    const post = posts.find((x) => x.slug === del[1]);
    if (!post) return send(res, 404, { error: 'Post not found.' });
    writePosts(posts.filter((x) => x !== post));
    const img = path.join(root, post.image);
    if (img.startsWith(UPLOAD_DIR) && fs.existsSync(img)) fs.unlinkSync(img);
    console.log('Blog post deleted:', post.slug);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'Not found.' });
}

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }

  if (p.startsWith('/api/')) {
    api(req, res, p).catch((e) => { console.error(e); send(res, 500, { error: 'Server error.' }); });
    return;
  }
  // never hand out the admin password file
  if (p.replace(/\\/g, '/').toLowerCase().startsWith('/data/admin')) { res.writeHead(404); return res.end(); }

  let f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  // clean page addresses, same as .htaccess on the live server: /service -> service.html
  if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) f = path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => {
  console.log('Site:        http://localhost:' + PORT);
  console.log('Blog upload: http://localhost:' + PORT + '/blog-admin');
  console.log('Admin password: ' + (process.env.BLOG_ADMIN_PASSWORD ? '(from BLOG_ADMIN_PASSWORD)' : PASSWORD + '  (saved in data/admin.json)'));
});
