import { Server } from 'socket.io';

export const setupSocketIO = (io: Server): void => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join_project', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });

    socket.on('leave_project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on('send_team_message', async (data: { senderId: string; text: string }) => {
      try {
        const { ChatMessage } = await import('../models/ChatMessage');
        const newMessage = new ChatMessage({
          sender: data.senderId,
          text: data.text
        });
        await newMessage.save();
        const populated = await newMessage.populate('sender', 'name avatar');
        io.emit('team_message_received', populated);
      } catch (err) {
        console.error('Chat error:', err);
      }
    });

    socket.on('delete_team_message', (messageId: string) => {
      io.emit('team_message_deleted', messageId);
    });

    socket.on('edit_team_message', (data: { _id: string; text: string }) => {
      io.emit('team_message_edited', data);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};
