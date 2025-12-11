const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;
const LEADS_FILE = path.join(__dirname, 'leads.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// Session-Konfiguration
app.use(session({
  secret: process.env.SESSION_SECRET || 'vorsorge-pilot-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true für HTTPS in Production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
  }
}));

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Ensure users.json exists
async function initUsersFile() {
  try {
    await fs.access(USERS_FILE);
    // Prüfe ob bestehende Benutzer gehashte Passwörter haben
    const users = await readUsers();
    let needsUpdate = false;
    
    for (let user of users) {
      // Wenn Passwort nicht gehasht ist (kein $2a$ oder $2b$ Präfix), hashe es
      if (user.password && !user.password.startsWith('$2')) {
        user.password = await bcrypt.hash(user.password, 10);
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
      console.log('✅ Passwörter wurden gehasht');
    }
  } catch {
    // Standard-Benutzer erstellen (Benutzername: admin, Passwort: admin123)
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const defaultUsers = [{
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date().toISOString()
    }];
    await fs.writeFile(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    console.log('✅ Default user created: admin / admin123');
  }
}

// Read users from file
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
}

// Authentifizierungs-Middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
}

// Spezifische Routen VOR express.static, damit sie nicht überschrieben werden
// Serve index page (root)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve login page
app.get('/login', (req, res) => {
  // Wenn bereits eingeloggt, weiterleiten
  if (req.session && req.session.user) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Login API
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Benutzername und Passwort erforderlich' 
      });
    }

    const users = await readUsers();
    const user = users.find(u => u.username === username);

    if (user) {
      // Prüfe Passwort (unterstützt sowohl gehashte als auch ungehashte Passwörter für Migration)
      let passwordMatch = false;
      
      if (user.password.startsWith('$2')) {
        // Gehashtes Passwort
        passwordMatch = await bcrypt.compare(password, user.password);
      } else {
        // Ungehashtes Passwort (für Migration)
        passwordMatch = user.password === password;
        // Wenn Match, Passwort hashen und speichern
        if (passwordMatch) {
          user.password = await bcrypt.hash(password, 10);
          await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        }
      }

      if (passwordMatch) {
        req.session.user = {
          username: user.username,
          role: user.role
        };
        res.json({ success: true, message: 'Login erfolgreich' });
      } else {
        res.status(401).json({ 
          success: false, 
          error: 'Ungültiger Benutzername oder Passwort' 
        });
      }
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Ungültiger Benutzername oder Passwort' 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// Logout API
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout fehlgeschlagen' });
    }
    res.json({ success: true, message: 'Logout erfolgreich' });
  });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: false, user: null });
  }
});

// Serve admin page (geschützt)
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve impressum page
app.get('/impressum', (req, res) => {
  res.sendFile(path.join(__dirname, 'impressum.html'));
});

// Serve datenschutz page
app.get('/datenschutz', (req, res) => {
  res.sendFile(path.join(__dirname, 'datenschutz.html'));
});

// Serve static files (HTML, CSS, JS) - muss NACH den spezifischen Routen kommen
app.use(express.static(__dirname));

// Ensure leads.json exists
async function initLeadsFile() {
  try {
    await fs.access(LEADS_FILE);
  } catch {
    await fs.writeFile(LEADS_FILE, JSON.stringify([], null, 2));
  }
}

// Read leads from file
async function readLeads() {
  try {
    const data = await fs.readFile(LEADS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading leads file:', error);
    return [];
  }
}

// Write leads to file
async function writeLeads(leads) {
  try {
    await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing leads file:', error);
    return false;
  }
}

// API Endpoint: Receive lead data
app.post('/api/leads', async (req, res) => {
  try {
    const leadData = req.body;
    
    console.log('📥 Received lead data:', JSON.stringify(leadData, null, 2));

    // Validate required fields
    const phoneField = leadData.flow === 'av' ? 'av_phone' : 'bu_phone';
    if (!leadData.flow) {
      console.error('❌ Missing flow field');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: flow' 
      });
    }
    
    if (!leadData[phoneField]) {
      console.error(`❌ Missing phone field: ${phoneField}`);
      return res.status(400).json({ 
        success: false, 
        error: `Missing required field: ${phoneField}` 
      });
    }

    // Add timestamp and ID
    const lead = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      ...leadData,
      receivedAt: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress
    };

    // Read existing leads
    const leads = await readLeads();

    // Add new lead
    leads.push(lead);

    // Write back to file
    const success = await writeLeads(leads);

    if (success) {
      console.log(`✅ New ${leadData.flow.toUpperCase()} lead saved successfully!`);
      console.log(`   Lead ID: ${lead.id}`);
      console.log(`   Phone: ${lead[phoneField]}`);
      console.log(`   Received at: ${lead.receivedAt}`);
      console.log(`   Total leads in file: ${leads.length}`);

      res.json({ 
        success: true, 
        message: 'Lead saved successfully',
        leadId: lead.id
      });
    } else {
      console.error('❌ Failed to write leads to file');
      res.status(500).json({ 
        success: false, 
        error: 'Failed to save lead' 
      });
    }
  } catch (error) {
    console.error('Error processing lead:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// API Endpoint: Get all leads (for admin/viewing) - geschützt
app.get('/api/leads', requireAuth, async (req, res) => {
  try {
    const leads = await readLeads();
    res.json({ success: true, leads, count: leads.length });
  } catch (error) {
    console.error('Error reading leads:', error);
    res.status(500).json({ success: false, error: 'Failed to read leads' });
  }
});

// API Endpoint: Get leads by flow type - geschützt
app.get('/api/leads/:flow', requireAuth, async (req, res) => {
  try {
    const { flow } = req.params;
    const leads = await readLeads();
    const filteredLeads = leads.filter(lead => lead.flow === flow);
    res.json({ success: true, leads: filteredLeads, count: filteredLeads.length });
  } catch (error) {
    console.error('Error reading leads:', error);
    res.status(500).json({ success: false, error: 'Failed to read leads' });
  }
});

// API Endpoint: Update lead (Status, Notizen, etc.) - geschützt
app.put('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const leads = await readLeads();
    const leadIndex = leads.findIndex(lead => lead.id === id);

    if (leadIndex === -1) {
      return res.status(404).json({ success: false, error: 'Lead nicht gefunden' });
    }

    // Update lead
    leads[leadIndex] = {
      ...leads[leadIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: req.session.user.username
    };

    const success = await writeLeads(leads);

    if (success) {
      res.json({ success: true, lead: leads[leadIndex] });
    } else {
      res.status(500).json({ success: false, error: 'Fehler beim Speichern' });
    }
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// API Endpoint: Delete lead - geschützt
app.delete('/api/leads/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const leads = await readLeads();
    const filteredLeads = leads.filter(lead => lead.id !== id);

    if (leads.length === filteredLeads.length) {
      return res.status(404).json({ success: false, error: 'Lead nicht gefunden' });
    }

    const success = await writeLeads(filteredLeads);

    if (success) {
      res.json({ success: true, message: 'Lead gelöscht' });
    } else {
      res.status(500).json({ success: false, error: 'Fehler beim Löschen' });
    }
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});


// Start server
async function startServer() {
  await initLeadsFile();
  await initUsersFile();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Leads will be saved to: ${LEADS_FILE}`);
    console.log(`🔐 Login at: http://localhost:${PORT}/login`);
    console.log(`📊 CRM Dashboard at: http://localhost:${PORT}/admin`);
    console.log(`⚠️  Default credentials: admin / admin123`);
  });
}

startServer();
