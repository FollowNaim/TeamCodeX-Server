"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const env_1 = require("../config/env");
const authenticate_1 = require("../middleware/authenticate");
const router = (0, express_1.Router)();
const generateTokens = (user) => {
    const accessToken = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, email: user.email, badges: user.badges }, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_EXPIRES_IN,
    });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN });
    return { accessToken, refreshToken };
};
// POST /api/auth/register (Public request access)
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const exists = await User_1.User.findOne({ email });
        if (exists) {
            res.status(400).json({ error: 'Email already registered' });
            return;
        }
        await User_1.User.create({ name, email, passwordHash: password, role: 'member', isApproved: false });
        res.status(201).json({ message: 'Registration requested. Please wait for leadership approval.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ error: 'Account deactivated' });
            return;
        }
        const isLead = user.role === 'team-lead' || user.role === 'co-lead';
        if (!user.isApproved && !isLead) {
            res.status(403).json({ error: 'Account pending leadership approval' });
            return;
        }
        const { accessToken, refreshToken } = generateTokens({ id: user._id.toString(), role: user.role, email: user.email, badges: user.badges });
        res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, badges: user.badges }, accessToken, refreshToken });
    }
    catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            res.status(401).json({ error: 'No refresh token' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET);
        const user = await User_1.User.findById(decoded.id);
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        const tokens = generateTokens({ id: user._id.toString(), role: user.role, email: user.email, badges: user.badges });
        res.json(tokens);
    }
    catch {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});
// GET /api/auth/me
router.get('/me', authenticate_1.authenticate, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user?.id).select('-passwordHash');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map