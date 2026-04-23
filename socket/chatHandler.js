const { redisClient } = require('../redis/redisClient');
const uploadFilesToR2 = require('../utilities/uploadFilesToR2');
const path = require('path');
const fs = require('fs');
const { checkCommunityMembership } = require('../middleware/communityMemberCheck');

// Track online users and their joined communities
const { registerOnlineUser, unregisterOnlineUser } = require('./socketManager');
const userCommunities = {}; // { userId: Set of communityIds }
const offlineTimeouts = {};

const setupChatHandlers = (io) => {
    
  io.on('connection', (socket) => {
    
    socket.on('joinChatroom', async ({ communityId, chatroom, userId }) => {
      const roomKey = `community:${communityId}:chatroom:${chatroom}`;
      
      // Verify user is a member of the community
      const { isMember } = await checkCommunityMembership(userId, communityId);
      if (!isMember) {
        socket.emit('error', { message: 'You are not a member of this community' });
        return;
      }
      
      socket.join(roomKey);
      const messages = await redisClient.lRange(roomKey, 0, 49);
      socket.emit('chatHistory', messages.reverse().map(JSON.parse));
    });

    socket.on('sendMessage', async ({ communityId, chatroom, message }) => {
      // Verify user is a member of the community
      const { isMember } = await checkCommunityMembership(message.userId, communityId);
      if (!isMember) {
        socket.emit('error', { message: 'You are not a member of this community' });
        return;
      }

      const roomKey = `community:${communityId}:chatroom:${chatroom}`;
      const msgObj = {
        ...message,
        timestamp: Date.now(),
      };
      await redisClient.lPush(roomKey, JSON.stringify(msgObj));
      await redisClient.lTrim(roomKey, 0, 49);
      await redisClient.publish(`community:${communityId}:chatroom:${chatroom}:channel`, JSON.stringify(msgObj));
      // 1) Persist a notification for every community member (respecting prefs)
      // 2) Emit realtime 'notification' events to online members via socketManager
      try {
        const { isAllowedByPreferences } = require('../utilities/notificationUtils');
        const { sendNotificationToUser } = require('./socketManager');
        const pool = require('../db');

        // Fetch community name once (fallback to id if not found)
        let communityName = communityId;
        try {
          const cRes = await pool.query('SELECT name FROM communities WHERE id = $1 LIMIT 1', [communityId]);
          if (cRes.rows[0] && cRes.rows[0].name) communityName = cRes.rows[0].name;
        } catch (err) {
          console.warn('Could not fetch community name for id', communityId, err && err.message ? err.message : err);
        }

        // Get all community members
        const membersRes = await pool.query('SELECT user_id FROM community_members WHERE community_id = $1', [communityId]);
        const memberRows = membersRes.rows || [];

        for (const row of memberRows) {
          const uid = String(row.user_id);
          try {
            // skip the sender
            if (uid === String(message.userId) || uid === message.userId) continue;

            const allowed = await isAllowedByPreferences(uid, 'community');
            if (!allowed) continue;

            // Insert persistent notification row for this member
            const text = `${message.username || 'Someone'} posted in ${communityName}`;
            await pool.query(`INSERT INTO notifications (user_id, actor_id, type, text, link, read, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [uid, message.userId || null, 'community', text, `/community/${communityId}`, false, new Date()]);

            // If the user is online (tracked in userCommunities mapping), emit realtime event
            if (userCommunities[uid] && userCommunities[uid].has(communityId)) {
              sendNotificationToUser(uid, { type: 'community', text, link: `/community/${communityId}` });
            }
          } catch (err) {
            console.error('Error notifying/persisting for community member', uid, err);
          }
        }
      } catch (err) {
        console.error('Error sending/persisting community notifications:', err);
      }
    });

    socket.on('sendMediaFiles', async ({ communityId, chatroom, message }, callback) => {
      try {
        // Verify user is a member of the community
        const { isMember } = await checkCommunityMembership(message.userId, communityId);
        if (!isMember) {
          socket.emit('error', { message: 'You are not a member of this community' });
          callback && callback({ error: 'You are not a member of this community' });
          return;
        }

        // Upload each attachment to R2 and collect URLs
        const uploadedAttachments = [];
        for (let i = 0; i < message.attachments.length; i++) {
          const attachment = message.attachments[i];
          const buffer = Buffer.from(attachment.buffer);
          const ext = attachment.ext || 'pdf';
          const contentType = attachment.contentType || 'application/octet-stream';
          const fileName = `${message.id}_${i}`;
          const tempFilePath = path.join(__dirname, '..', 'uploads', `${fileName}.${ext}`);
          fs.writeFileSync(tempFilePath, buffer);

          // Upload to R2
          const fileKey = `communityMedia/${communityId}/${fileName}.${ext}`;
          const fileUrl = await uploadFilesToR2(tempFilePath, fileKey, contentType);

          // Store metadata for frontend (URL, type, name)
          uploadedAttachments.push({
            url: `https://pub-e4e65ff31f4b469694a88010586c6d6e.r2.dev/${fileKey}`,
            contentType: contentType,
            name: `${fileName}.${ext}`,
          });
        }

        // Replace attachments with URLs
        const msgObj = {
          ...message,
          attachments: uploadedAttachments,
          timestamp: Date.now(),
        };

        const roomKey = `community:${communityId}:chatroom:${chatroom}`;
        await redisClient.lPush(roomKey, JSON.stringify(msgObj));
        await redisClient.lTrim(roomKey, 0, 49);
        await redisClient.publish(`community:${communityId}:chatroom:${chatroom}:channel`, JSON.stringify(msgObj));
        callback && callback({ success: true });
      } catch (err) {
        callback && callback({ error: err.message || "Upload failed" });
      }
    });

    socket.on('pinMessage', async ({ communityId, chatroom, messageId, isPinned }) => {
      const roomKey = `community:${communityId}:chatroom:${chatroom}`;
      const messages = await redisClient.lRange(roomKey, 0, 49);
      const idx = messages.findIndex(msg => JSON.parse(msg).id === messageId);
      if (idx !== -1) {
        const msgObj = JSON.parse(messages[idx]);
        msgObj.isPinned = isPinned;
        await redisClient.lSet(roomKey, idx, JSON.stringify(msgObj));
        io.to(roomKey).emit('messagePinned', { messageId, isPinned });
      }
    });

    socket.on('editMessage', async ({ communityId, chatroom, messageId, newContent }) => {
      const roomKey = `community:${communityId}:chatroom:${chatroom}`;
      const messages = await redisClient.lRange(roomKey, 0, 49);
      const idx = messages.findIndex(msg => JSON.parse(msg).id === messageId);
      if (idx !== -1) {
        const msgObj = JSON.parse(messages[idx]);
        msgObj.content = newContent;
        msgObj.edited = true;
        await redisClient.lSet(roomKey, idx, JSON.stringify(msgObj));
        io.to(roomKey).emit('messageEdited', { messageId, newContent });
      }
    });

    socket.on('deleteMessage', async ({ communityId, chatroom, messageId }) => {
        const roomKey = `community:${communityId}:chatroom:${chatroom}`;
        const messages = await redisClient.lRange(roomKey, 0, 49);
        const idx = messages.findIndex(msg => JSON.parse(msg).id === messageId);
        if (idx !== -1) {
          await redisClient.lRem(roomKey, 1, messages[idx]);
          io.to(roomKey).emit('messageDeleted', messageId);
        }
    });

    socket.on('joinCommunity', ({ communityId, userId }) => {
      if (!communityId || !userId) return;
      socket.join(communityId);
      socket.userId = userId; // store on socket for disconnect handling
      registerOnlineUser(userId, socket.id);
      if (!userCommunities[userId]) userCommunities[userId] = new Set();
      userCommunities[userId].add(communityId);
      if (offlineTimeouts[userId]) {
        clearTimeout(offlineTimeouts[userId]);
        delete offlineTimeouts[userId];
      }
      // Emit to all: this user is online
      io.to(communityId).emit('userStatus', { userId, status: 'online' });

      // Emit to this socket: all currently online userIds in this community
      const onlineUserIds = Object.keys(userCommunities).filter(uid => userCommunities[uid] && userCommunities[uid].has(communityId));
      socket.emit('communityOnlineUsers', { communityId, userIds: onlineUserIds });
    });

    socket.on('requestCommunityOnlineUsers', ({ communityId }) => {
      if (!communityId) return;
      const onlineUserIds = Object.keys(userCommunities).filter(uid => userCommunities[uid] && userCommunities[uid].has(communityId));
      socket.emit('communityOnlineUsers', { communityId, userIds: onlineUserIds });
    });

    // Allow a socket to request the current online status for a specific userId
    socket.on('requestUserStatus', ({ userId }) => {
      if (!userId) return;
      const isOnline = !!(userCommunities[userId] && userCommunities[userId].size > 0);
      socket.emit('userStatus', { userId, status: isOnline ? 'online' : 'offline' });
    });

    socket.on('disconnect', () => {
      const userId = socket.userId;
      if (userId) {
        unregisterOnlineUser(userId);
        if (userCommunities[userId]) {
          // Delay offline emit
          offlineTimeouts[userId] = setTimeout(() => {
            try {
              const communities = userCommunities[userId];
              if (communities) {
                // Support multiple shapes defensively (Set, Array, plain object)
                if (communities instanceof Set) {
                  for (const communityId of communities) {
                    io.to(communityId).emit('userStatus', { userId, status: 'offline' });
                  }
                } else if (Array.isArray(communities)) {
                  for (const communityId of communities) {
                    io.to(communityId).emit('userStatus', { userId, status: 'offline' });
                  }
                } else if (typeof communities === 'object') {
                  for (const communityId of Object.keys(communities)) {
                    io.to(communityId).emit('userStatus', { userId, status: 'offline' });
                  }
                }
              }
            } catch (err) {
              console.error('Error while emitting offline status for user', userId, err);
            } finally {
              try { delete userCommunities[userId]; } catch (e) {}
              try { delete offlineTimeouts[userId]; } catch (e) {}
            }
          }, 3000); // 3 seconds
        }
      }
    });

    socket.on('reactToMessage', async ({ communityId, chatroom, messageId, emoji, userId }) => {
      const roomKey = `community:${communityId}:chatroom:${chatroom}`;
      const messages = await redisClient.lRange(roomKey, 0, 49);
      const idx = messages.findIndex(msg => JSON.parse(msg).id === messageId);
      if (idx !== -1) {
        const msgObj = JSON.parse(messages[idx]);
        if (!msgObj.reactions) msgObj.reactions = [];
        let reaction = msgObj.reactions.find(r => r.emoji === emoji);
        if (reaction) {
          if (reaction.users.includes(userId)) {
            // Remove reaction
            reaction.users = reaction.users.filter(u => u !== userId);
            reaction.count = reaction.users.length;
            if (reaction.count === 0) {
              msgObj.reactions = msgObj.reactions.filter(r => r.emoji !== emoji);
            }
          } else {
            // Add user to reaction
            reaction.users.push(userId);
            reaction.count = reaction.users.length;
          }
        } else {
          // New reaction
          msgObj.reactions.push({ emoji, count: 1, users: [userId] });
        }
        await redisClient.lSet(roomKey, idx, JSON.stringify(msgObj));
        io.to(roomKey).emit('messageReaction', { messageId, reactions: msgObj.reactions });
      }
    });

  });
};

module.exports = { setupChatHandlers };
