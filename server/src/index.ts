import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import conversationRoutes from './routes/conversations';
import streamRoutes from './routes/stream';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Prisma Client - Singleton
export const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/conversations', conversationRoutes);
app.use('/api/stream', streamRoutes);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
