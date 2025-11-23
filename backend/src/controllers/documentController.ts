import { Request, Response } from 'express';
import * as documentService from '../services/documentService';

export const createDocument = async (req: Request, res: Response) => {
  try {
    const doc = await documentService.createDocument();
    res.status(201).json(doc);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
};

export const getDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await documentService.getDocumentById(id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(doc);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const docs = await documentService.getAllDocuments();
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

import { getDocumentUserCount } from '../socket/documentSocket';

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if other users are in the document
    // We assume the user requesting the delete is likely one of the active users (if deleting from editor)
    // So we block only if there are MORE than 1 user.
    const activeUsers = getDocumentUserCount(id);
    if (activeUsers > 1) {
      return res.status(409).json({ error: 'Cannot delete document while other users are active.' });
    }

    await documentService.deleteDocument(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};
