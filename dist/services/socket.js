"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = void 0;
const setupSocketIO = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);
        socket.on('join_project', (projectId) => {
            socket.join(`project:${projectId}`);
        });
        socket.on('leave_project', (projectId) => {
            socket.leave(`project:${projectId}`);
        });
        socket.on('send_team_message', async (data) => {
            try {
                const { ChatMessage } = await Promise.resolve().then(() => __importStar(require('../models/ChatMessage')));
                const newMessage = new ChatMessage({
                    sender: data.senderId,
                    text: data.text
                });
                await newMessage.save();
                const populated = await newMessage.populate('sender', 'name avatar');
                io.emit('team_message_received', populated);
            }
            catch (err) {
                console.error('Chat error:', err);
            }
        });
        socket.on('delete_team_message', (messageId) => {
            io.emit('team_message_deleted', messageId);
        });
        socket.on('edit_team_message', (data) => {
            io.emit('team_message_edited', data);
        });
        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
};
exports.setupSocketIO = setupSocketIO;
//# sourceMappingURL=socket.js.map