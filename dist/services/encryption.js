"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-cbc';
const KEY_HEX = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
const KEY = Buffer.from(KEY_HEX.slice(0, 64), 'hex');
const encrypt = (text) => {
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex') };
};
exports.encrypt = encrypt;
const decrypt = (encrypted, iv) => {
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
};
exports.decrypt = decrypt;
//# sourceMappingURL=encryption.js.map