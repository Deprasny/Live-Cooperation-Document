import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createDocument = async () => {
  return await prisma.document.create({
    data: {
      content: '',
      version: 0,
    },
  });
};

export const getDocumentById = async (id: string) => {
  return await prisma.document.findUnique({
    where: { id },
  });
};

export const getAllDocuments = async () => {
  return await prisma.document.findMany({
    orderBy: { updatedAt: 'desc' },
  });
};

export const deleteDocument = async (id: string) => {
  return await prisma.document.delete({
    where: { id },
  });
};

export const updateDocument = async (id: string, content: string, version: number) => {
  // This is used by the socket layer, but we expose it here for completeness
  // In a real app, we might want to use a transaction or optimistic locking
  return await prisma.document.update({
    where: { id },
    data: { content, version },
  });
};

export const getPrismaClient = () => prisma;
