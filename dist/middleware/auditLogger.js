"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = void 0;
const AuditLog_1 = require("../models/AuditLog");
const auditLogger = (action, resourceType) => {
    return async (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (req.user && res.statusCode < 400) {
                const resourceId = req.params.id || body?._id || body?.data?._id;
                if (resourceId) {
                    AuditLog_1.AuditLog.create({
                        userId: req.user.id,
                        action,
                        resourceType,
                        resourceId,
                        changes: { before: {}, after: req.body },
                        ip: req.ip || '',
                        userAgent: req.headers['user-agent'] || '',
                    }).catch(console.error);
                }
            }
            return originalJson(body);
        };
        next();
    };
};
exports.auditLogger = auditLogger;
//# sourceMappingURL=auditLogger.js.map