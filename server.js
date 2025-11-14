require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Basic Auth middleware for admin actions
function adminAuth(req, res, next) {
  const header = req.headers['authorization'];
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'changeme';

  if (!header || !header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="KaiJuBlox Admin"');
    return res.status(401).send('Authentication required');
  }
  const base64 = header.split(' ')[1];
  let decoded = '';
  try {
    decoded = Buffer.from(base64, 'base64').toString('utf8');
  } catch (e) {
    return res.status(400).send('Invalid auth header');
  }
  const [user, pass] = decoded.split(':');
  if (user === adminUser && pass === adminPass) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="KaiJuBlox Admin"');
  return res.status(401).send('Invalid credentials');
}

// Mongo connect
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'kaijublox_db'
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
})();

const accountSchema = new mongoose.Schema(
  {
    judul: { type: String, required: true },
    kode: { type: String, required: true, unique: true },
    harga: { type: Number, required: true },
    level: String,
    robux: String,
    kategori: { type: String, default: 'Umum' },
    catatan: String,
    tag1: String,
    tag2: String,
    tag3: String,
    ribbon: String,
    status: {
      type: String,
      enum: ['available', 'sold'],
      default: 'available'
    }
  },
  { timestamps: true }
);

const Account = mongoose.model('Account', accountSchema);

// Public: list accounts (optionally filter by status)
app.get('/api/accounts', async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && ['available', 'sold'].includes(status)) {
      query.status = status;
    }
    const accounts = await Account.find(query).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching accounts' });
  }
});

// Admin check route
app.get('/api/admin/check', adminAuth, (req, res) => {
  res.json({ ok: true });
});

// Create account (admin only)
app.post('/api/accounts', adminAuth, async (req, res) => {
  try {
    const body = req.body;
    const existing = await Account.findOne({ kode: body.kode });
    if (existing) {
      return res.status(400).json({ message: 'Kode sudah dipakai' });
    }
    const acc = new Account({
      judul: body.judul,
      kode: body.kode,
      harga: body.harga,
      level: body.level,
      robux: body.robux,
      kategori: body.kategori,
      catatan: body.catatan,
      tag1: body.tag1,
      tag2: body.tag2,
      tag3: body.tag3,
      ribbon: body.ribbon,
      status: body.status || 'available'
    });
    const saved = await acc.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Error creating account', detail: err.message });
  }
});

// Update account (admin only)
app.put('/api/accounts/:id', adminAuth, async (req, res) => {
  try {
    const body = req.body;
    const updated = await Account.findByIdAndUpdate(
      req.params.id,
      {
        judul: body.judul,
        kode: body.kode,
        harga: body.harga,
        level: body.level,
        robux: body.robux,
        kategori: body.kategori,
        catatan: body.catatan,
        tag1: body.tag1,
        tag2: body.tag2,
        tag3: body.tag3,
        ribbon: body.ribbon,
        status: body.status
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Account not found' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Error updating account', detail: err.message });
  }
});

// Toggle status (admin only)
app.patch('/api/accounts/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'sold'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const updated = await Account.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Account not found' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Error updating status' });
  }
});

// Delete account (admin only)
app.delete('/api/accounts/:id', adminAuth, async (req, res) => {
  try {
    const deleted = await Account.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Account not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Error deleting account' });
  }
});

// Routes for pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`KaiJuBlox running at http://localhost:${PORT}`);
});
