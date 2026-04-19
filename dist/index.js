"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const projects_routes_1 = __importDefault(require("./routes/projects.routes"));
const clients_routes_1 = __importDefault(require("./routes/clients.routes"));
const reviews_routes_1 = __importDefault(require("./routes/reviews.routes"));
const resources_routes_1 = __importDefault(require("./routes/resources.routes"));
const notices_routes_1 = __importDefault(require("./routes/notices.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const socket_1 = require("./services/socket");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: env_1.env.CLIENT_URL, credentials: true }
});
exports.io = io;
(0, socket_1.setupSocketIO)(io);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: env_1.env.CLIENT_URL, credentials: true }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/projects', projects_routes_1.default);
app.use('/api/clients', clients_routes_1.default);
app.use('/api/reviews', reviews_routes_1.default);
app.use('/api/resources', resources_routes_1.default);
app.use('/api/notices', notices_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/audit', audit_routes_1.default);
app.use('/api/chat', chat_routes_1.default);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.use(errorHandler_1.errorHandler);
const start = async () => {
    await (0, db_1.connectDB)();
    server.listen(env_1.env.PORT, () => {
        console.log(`🚀 Server running on port ${env_1.env.PORT}`);
    });
};
start();
//# sourceMappingURL=index.js.map