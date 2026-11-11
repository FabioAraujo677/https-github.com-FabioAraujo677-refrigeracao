process.env.DISABLE_HMR = 'true';

import express, { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '25mb' }));

// Directory to store database
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Database Structure
interface DatabaseSchema {
  revision: number;
  lastUpdated: string;
  users: any[];
  staff: any[];
  orders: any[];
  expenses: any[];
  deliveries: any[];
  customers: any[];
  company: any;
}

const DEFAULT_COMPANY = {
  name: 'NEO FIX ELETRÔNICA & REFRIGERAÇÃO',
  slogan: 'Especialistas em Geladeiras, Máquinas de Lavar e Lava & Seca',
  cnpj: '38.921.455/0001-90',
  phone: '(11) 98765-4321',
  whatsapp: '5511987654321',
  email: 'contato@neofixeletro.com.br',
  cep: '01310-200',
  street: 'Avenida Paulista',
  number: '1842',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  businessHours: 'Segunda a Sexta: 08:00 às 18:30 | Sábado: 08:00 às 14:00',
  logoUrl: '',
  warrantyTerms:
    '1. A garantia cobre exclusivamente a peça trocada e a mão de obra especificada nesta Ordem de Serviço.\n' +
    '2. O rompimento do lacre de garantia, sobretensão elétrica atmosférica (raios), infestações de insetos ou mau uso invalidam a garantia.\n' +
    '3. Em caso de defeito dentro do prazo, entre em contato imediatamente com nossa central para agendamento técnico prioritário.\n' +
    '4. Conserve este certificado digital ou impresso para comprovação de vigência.',
};

const DEFAULT_STAFF: any[] = [];
const INITIAL_ORDERS: any[] = [];
const INITIAL_EXPENSES: any[] = [];

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        const cleanOrders = (Array.isArray(data.orders) ? data.orders : []).filter(
          (o: any) => o && o.id !== 'OS-2026-1051' && o.id !== 'OS-2026-5961' && o.customerName !== 'Refrigeraondas Nando' && o.customerName !== 'Marta Ribeiro Souza'
        );
        return {
          revision: data.revision || Date.now(),
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          users: Array.isArray(data.users) ? data.users : [],
          staff: Array.isArray(data.staff) ? data.staff : [],
          orders: cleanOrders,
          expenses: Array.isArray(data.expenses) ? data.expenses : [],
          deliveries: Array.isArray(data.deliveries) ? data.deliveries : [],
          customers: Array.isArray(data.customers) ? data.customers : [],
          company: data.company || DEFAULT_COMPANY,
        };
      }
    }
  } catch (err) {
    console.error('Error reading database file, resetting to defaults:', err);
  }

  const initialDb: DatabaseSchema = {
    revision: Date.now(),
    lastUpdated: new Date().toISOString(),
    users: [],
    staff: [],
    orders: [],
    expenses: [],
    deliveries: [],
    customers: [],
    company: DEFAULT_COMPANY,
  };
  saveDatabase(initialDb);
  return initialDb;
}

let db = loadDatabase();

function saveDatabase(data: DatabaseSchema): void {
  try {
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database to file:', err);
  }
}

// Active SSE Connections for real-time broadcasts
const sseClients: Response[] = [];

function broadcastChange(payload: any) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(message);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Healthcheck
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', revision: db.revision, lastUpdated: db.lastUpdated, clients: sseClients.length });
});

// 2. Full State for initial hydration and backup
app.get('/api/state', (_req: Request, res: Response) => {
  res.json(db);
});

// 3. Real-time Server-Sent Events (SSE) Stream
app.get('/api/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ event: 'connected', revision: db.revision })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 3. Reset All System Data (Wipes all database records to clean initial state)
app.post('/api/reset-all', (_req: Request, res: Response) => {
  db = {
    ...db,
    revision: Date.now(),
    lastUpdated: new Date().toISOString(),
    users: [],
    staff: [],
    orders: [],
    expenses: [],
    deliveries: [],
    customers: [],
  };
  saveDatabase(db);
  broadcastChange({ event: 'full_sync', revision: db.revision, data: db });
  return res.json({ success: true, message: 'All system data wiped completely', revision: db.revision });
});

// 4. Atomic Mutation API (INSERT, UPDATE, DELETE, BULK)
app.post('/api/sync', (req: Request, res: Response) => {
  const { table, action, data, id, fullState } = req.body;

  // Option A: Full state overwrite / merge
  if (fullState) {
    db = {
      ...db,
      ...fullState,
      revision: Date.now(),
      lastUpdated: new Date().toISOString(),
    };
    saveDatabase(db);
    broadcastChange({ event: 'full_sync', revision: db.revision, data: db });
    return res.json({ success: true, revision: db.revision });
  }

  if (!table || !action) {
    return res.status(400).json({ error: 'table and action are required' });
  }

  db.revision = Date.now();
  db.lastUpdated = new Date().toISOString();

  if (table === 'company') {
    db.company = { ...db.company, ...data };
  } else if (Array.isArray((db as any)[table])) {
    const list: any[] = (db as any)[table];

    if (action === 'INSERT') {
      const existingIdx = list.findIndex(item => item.id === data.id);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...data };
      } else {
        list.unshift(data);
      }
    } else if (action === 'UPDATE') {
      const idx = list.findIndex(item => item.id === (data?.id || id));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...data };
      } else if (data) {
        list.unshift(data);
      }
    } else if (action === 'DELETE') {
      const targetId = id || data?.id;
      const targetEmail = data?.email?.toLowerCase().trim();
      const targetName = data?.name?.toLowerCase().trim();

      if (table === 'staff') {
        db.staff = db.staff.filter(s => {
          if (targetId && (s.id === targetId || s.id === 'usr_' + targetId)) return false;
          if (targetEmail && s.email && s.email.toLowerCase().trim() === targetEmail) return false;
          if (targetName && s.name && s.name.toLowerCase().trim() === targetName) return false;
          return true;
        });
        db.users = db.users.filter(u => {
          if (targetId && (u.id === targetId || u.id === 'usr_' + targetId)) return false;
          if (targetEmail && u.email && u.email.toLowerCase().trim() === targetEmail) return false;
          if (targetName && u.name && u.name.toLowerCase().trim() === targetName) return false;
          return true;
        });
      } else {
        const filtered = list.filter(item => item.id !== targetId);
        (db as any)[table] = filtered;
      }
    } else if (action === 'REPLACE_ALL') {
      if (Array.isArray(data)) {
        (db as any)[table] = data;
      }
    }
  }

  saveDatabase(db);

  // Broadcast to all other devices in real-time
  broadcastChange({
    event: 'mutation',
    revision: db.revision,
    table,
    action,
    data,
    id,
  });

  return res.json({ success: true, revision: db.revision });
});

// ==========================================
// VITE INTEGRATION (Dev & Prod)
// ==========================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[REALTIME SERVER] Running on http://0.0.0.0:${PORT} (${isProd ? 'Production' : 'Development'})`);
    console.log(`[REALTIME SERVER] Database stored in ${DB_FILE}`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
