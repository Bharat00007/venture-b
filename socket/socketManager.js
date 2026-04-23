let ioInstance = null;
const onlineUsers = {}; // userId -> socketId

function init(io) {
  ioInstance = io;
}

function registerOnlineUser(userId, socketId) {
  onlineUsers[userId] = socketId;
}

function unregisterOnlineUser(userId) {
  delete onlineUsers[userId];
}

function sendNotificationToUser(userId, payload) {
  try {
    if (!ioInstance) return false;
    const socketId = onlineUsers[userId];
    if (!socketId) return false;
    ioInstance.to(socketId).emit('notification', payload);
    return true;
  } catch (err) {
    console.error('Error sending socket notification:', err);
    return false;
  }
}

module.exports = { init, registerOnlineUser, unregisterOnlineUser, sendNotificationToUser };
