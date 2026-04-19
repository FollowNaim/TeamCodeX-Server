"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('5000'),
    MONGODB_URI: zod_1.z.string().default('mongodb://localhost:27017/teamdash'),
    JWT_SECRET: zod_1.z.string().default('supersecretjwt2024teamdash'),
    JWT_REFRESH_SECRET: zod_1.z.string().default('supersecretrefresh2024teamdash'),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    ENCRYPTION_KEY: zod_1.z.string().default('a'.repeat(64)),
    CLIENT_URL: zod_1.z.string().default('http://localhost:3000'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
});
exports.env = envSchema.parse(process.env);
//# sourceMappingURL=env.js.map