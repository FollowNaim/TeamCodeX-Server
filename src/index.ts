import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { connectDB } from './config/db';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import projectRoutes from './routes/projects.routes';
import clientRoutes from './routes/clients.routes';
import reviewRoutes from './routes/reviews.routes';
import resourceRoutes from './routes/resources.routes';
import noticeRoutes from './routes/notices.routes';
import analyticsRoutes from './routes/analytics.routes';
import auditRoutes from './routes/audit.routes';
import chatRoutes from './routes/chat.routes';
import todoRoutes from './routes/todos.routes';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketIO } from './services/socket';

const app = express();
app.set('trust proxy', 1);

// 1. CORS (MUST BE FIRST)
app.use(cors({ 
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. DEBUG LOGGER
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: env.CLIENT_URL, credentials: true }
});

setupSocketIO(io);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/todos', todoRoutes);

app.get('/', (_req, res) => res.send('🚀 TeamCodeX API is running...'));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use(errorHandler);

const start = async () => {
  await connectDB();
  server.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT}`);
  });
};

start();

export { io };
