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

const DEFAULT_ADMIN_USER = {
  id: 'usr_admin_ice',
  companyId: 'comp_admin_ice',
  name: 'Araújo - Admin',
  email: 'icerefrigeracaopreventiva@gmail.com',
  password: '120511',
  role: 'admin',
  phone: '(11) 96157-0131',
  createdAt: new Date().toISOString(),
};

const DEFAULT_STAFF = [
  { id: 'stf_admin_ice', companyId: 'comp_admin_ice', name: 'Araújo (Admin)', role: 'admin', phone: '(11) 96157-0131', email: 'icerefrigeracaopreventiva@gmail.com', password: '120511', active: true },
  { id: 'stf_wilian', companyId: 'comp_admin_ice', name: 'wilian', role: 'tecnico', phone: '(11) 96157-0131', email: 'wilian@tecnico.com', password: '123', notes: 'geral', active: true },
  { id: 'stf_sabrina', companyId: 'comp_admin_ice', name: 'Sabrina', role: 'atendente', phone: '(11) 98566-6666', email: 'sabrina@atendente.com', password: '123', active: true },
  { id: 'stf_1', companyId: 'comp_admin_ice', name: 'Carlos Eduardo Mendes', role: 'tecnico', phone: '(11) 99123-4567', email: 'carlos@tecnico.com', password: '123', active: true },
  { id: 'stf_2', companyId: 'comp_admin_ice', name: 'Márcio Silva Santos', role: 'tecnico', phone: '(11) 98234-5678', email: 'marcio@tecnico.com', password: '123', active: true },
  { id: 'stf_3', companyId: 'comp_admin_ice', name: 'Rodrigo Refrigeração', role: 'tecnico', phone: '(11) 97345-6789', email: 'rodrigo@tecnico.com', password: '123', active: true },
  { id: 'stf_4', companyId: 'comp_admin_ice', name: 'Juliana Costa', role: 'atendente', phone: '(11) 96456-7890', email: 'juliana@atendente.com', password: '123', active: true },
  { id: 'stf_5', companyId: 'comp_admin_ice', name: 'Fernanda Rocha', role: 'atendente', phone: '(11) 95567-8901', email: 'fernanda@atendente.com', password: '123', active: true },
  { id: 'stf_6', companyId: 'comp_admin_ice', name: 'Marcos Paulo Vieira', role: 'motorista', phone: '(11) 94321-1234', email: 'marcos@motorista.com', password: '123', active: true },
  { id: 'stf_7', companyId: 'comp_admin_ice', name: 'Diego Barbosa Lima', role: 'motorista', phone: '(11) 93210-9876', email: 'diego@motorista.com', password: '123', active: true },
];

const INITIAL_ORDERS = [
  {
    id: 'OS-2026-1051',
    createdAt: new Date().toISOString(),
    attendanceStatus: 'Na fila / Aguardando',
    customerName: 'Marta Ribeiro Souza',
    customerPhone: '(11) 98545-7887',
    customerCpf: '123.456.789-00',
    cep: '05781-250',
    street: 'Rua Noanamá',
    number: '17',
    neighborhood: 'Jardim São Januário',
    city: 'São Paulo',
    state: 'SP',
    applianceType: 'Geladeira / Refrigerador',
    applianceBrand: 'Brastemp',
    applianceModel: 'Inverse Frost Free 422L',
    technicianName: 'wilian',
    serviceDescription: 'Troca de compressor e recarga de gás refrigerante R134a.',
    partsCost: 350,
    laborCost: 450,
    totalAmount: 800,
    warrantyMonths: 3,
    status: 'Ativa',
    warrantyStartDate: new Date().toISOString(),
    warrantyEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

const INITIAL_EXPENSES = [
  {
    id: 'EXP-101',
    description: 'Gás Refrigerante R134a + Filtro Secador Cobre',
    amount: 110.0,
    category: 'Peças e Insumos',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Pix',
    createdBy: 'wilian',
    notes: 'Insumos utilizados na visita da manhã',
    createdAt: new Date().toISOString(),
  }
];

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        return {
          revision: data.revision || Date.now(),
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          users: Array.isArray(data.users) ? data.users : [DEFAULT_ADMIN_USER],
          staff: Array.isArray(data.staff) ? data.staff : DEFAULT_STAFF,
          orders: Array.isArray(data.orders) ? data.orders : INITIAL_ORDERS,
          expenses: Array.isArray(data.expenses) ? data.expenses : INITIAL_EXPENSES,
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
    users: [DEFAULT_ADMIN_USER],
    staff: DEFAULT_STAFF,
    orders: INITIAL_ORDERS,
    expenses: INITIAL_EXPENSES,
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
