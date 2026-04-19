"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuditLog_1 = require("../models/AuditLog");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, (0, authorize_1.authorize)('team-lead', 'co-lead'));
router.get('/', async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const logs = await AuditLog_1.AuditLog.find()
            .populate('userId', 'name email')
            .sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        const total = await AuditLog_1.AuditLog.countDocuments();
        res.json({ logs, total, page, pages: Math.ceil(total / limit) });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/:resourceId', async (req, res) => {
    try {
        const logs = await AuditLog_1.AuditLog.find({ resourceId: req.params.resourceId })
            .populate('userId', 'name email')
            .sort({ timestamp: -1 });
        res.json(logs);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=audit.routes.js.map