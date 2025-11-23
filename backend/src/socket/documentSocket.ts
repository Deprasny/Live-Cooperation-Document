import { Server, Socket } from 'socket.io';
import { getPrismaClient } from '../services/documentService';

const prisma = getPrismaClient();

interface UpdateDocumentPayload {
  documentId: string;
  content: string;
  version: number; // The version the client *thinks* they are updating from
}

let ioInstance: Server | null = null;

export const getDocumentUserCount = (documentId: string): number => {
  if (!ioInstance) return 0;
  const room = ioInstance.sockets.adapter.rooms.get(documentId);
  return room ? room.size : 0;
};

export const setupDocumentSocket = (io: Server) => {
  ioInstance = io;
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-document', async (documentId: string) => {
      socket.join(documentId);
      console.log(`Socket ${socket.id} joined document ${documentId}`);

      // Broadcast new user count
      const room = io.sockets.adapter.rooms.get(documentId);
      const userCount = room ? room.size : 0;
      io.to(documentId).emit('active-users', userCount);
    });

    socket.on('edit-document', async (payload: UpdateDocumentPayload) => {
      const { documentId, content, version } = payload;

      try {
        // 1. Fetch current document state from DB (Source of Truth)
        const currentDoc = await prisma.document.findUnique({
          where: { id: documentId },
        });

        if (!currentDoc) {
          socket.emit('error', 'Document not found');
          return;
        }

        // 2. Conflict Resolution Strategy: Versioned Last-Write-Wins
        // We only accept updates if the client's base version matches the server's current version.
        if (version === currentDoc.version) {
          // ACCEPT UPDATE
          const newVersion = currentDoc.version + 1;

          const updatedDoc = await prisma.document.update({
            where: { id: documentId },
            data: {
              content: content,
              version: newVersion,
            },
          });

          // Broadcast the NEW successful state to ALL clients in the room (including sender)
          // This ensures everyone is on the same page.
          io.to(documentId).emit('document-updated', {
            content: updatedDoc.content,
            version: updatedDoc.version,
          });
        } else {
          // REJECT UPDATE (Conflict)
          // Client was working on an old version.
          // We send them the LATEST server state so they can overwrite/sync.
          console.log(`Conflict detected for doc ${documentId}. Client v${version} vs Server v${currentDoc.version}`);

          socket.emit('document-updated', {
            content: currentDoc.content,
            version: currentDoc.version,
          });
        }
      } catch (error) {
        console.error('Error processing edit:', error);
        socket.emit('error', 'Internal server error processing edit');
      }
    });

    socket.on('disconnecting', () => {
      // We use 'disconnecting' to access rooms before the socket leaves them
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          // It's a document room
          // The socket is still in the room, so we subtract 1 for the count after disconnect
          const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
          io.to(room).emit('active-users', roomSize - 1);
        }
      }
    });

    socket.on('typing', (data: { documentId: string }) => {
      socket.to(data.documentId).emit('user-typing', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};
