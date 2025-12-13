import { Router } from 'express';
import { prisma } from '../index';
import { calculateUrgency } from '../services/urgency';
import { events, CHANNELS } from '../services/events';

const router = Router();

// Helper to parse
const mapConvo = (c: any) => ({
    ...c,
    urgencyReasons: c.urgencyReasons ? JSON.parse(c.urgencyReasons) : []
});

router.get('/', async (req, res) => {
    try {
        const { q, status, minUrgency, assignedTo, unreadOnly } = req.query;

        const where: any = {};

        // 1. Status Filter
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }

        // 2. Urgency Filter
        if (minUrgency) {
            where.urgencyScore = {
                gte: parseInt(minUrgency as string)
            };
        }

        // 3. Assignment Filter
        if (assignedTo === 'ME') {
            // Mock "Me" as needing to match a specific ID or null (unassigned) if "UNASSIGNED"
            // For now, let's assume 'assignedTo' param is the exact string stored
            // If client sends 'UNASSIGNED', we check null.
        } else if (assignedTo === 'UNASSIGNED') {
            where.assignedTo = null;
        } else if (assignedTo) {
            where.assignedTo = assignedTo as string;
        }

        // 4. Search (Global)
        if (q) {
            const search = q as string;
            where.OR = [
                { title: { contains: search } }, // SQLite search is case-insensitive usually?
                { customerId: { contains: search } },
                { messages: { some: { content: { contains: search } } } }
            ];
        }

        // 5. Unread Only
        // This is tricky because "unread" means "last message is CUSTOMER and isRead=false" ?
        // Or just any unread message? Usually conversation level unread indicator.
        // Let's assume we want conversations where the LAST message is provided by CUSTOMER (status=OPEN typically implies this but let's be strict).
        if (unreadOnly === 'true') {
            // Complex to do efficiently in one query without computed fields.
            // For MVP, handling via 'status' is better. But if requested:
            // where.messages = { some: { isRead: false, senderType: 'CUSTOMER' } };
        }

        const conversations = await prisma.conversation.findMany({
            where,
            orderBy: [
                { urgencyScore: 'desc' },
                { lastMessageAt: 'desc' }
            ],
            include: {
                messages: {
                    take: 1,
                    orderBy: { timestamp: 'desc' }
                }
            }
        });
        res.json(conversations.map(mapConvo));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: req.params.id },
            include: {
                messages: {
                    orderBy: { timestamp: 'asc' }
                }
            }
        });

        if (!conversation) {
            console.log(`[API] GET /${req.params.id} -> Not Found`);
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        console.log(`[API] GET /${req.params.id} -> Found with ${conversation.messages.length} messages`);
        res.json(mapConvo(conversation));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

router.post('/:id/reply', async (req, res) => {
    try {
        const { content } = req.body;
        const conversationId = req.params.id;

        // 1. Create Agent Message
        const message = await prisma.message.create({
            data: {
                conversationId,
                senderType: 'AGENT',
                content,
                timestamp: new Date(),
                isRead: true,
            }
        });

        // 2. Update Conversation
        const conversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: 'WAITING',
                lastMessageAt: message.timestamp,
            }
        });

        const parsedConversation = mapConvo(conversation);

        // 3. Emit Real-time Event
        events.emit(CHANNELS.UPDATE, {
            type: 'NEW_MESSAGE',
            conversationId,
            message
        });

        events.emit(CHANNELS.UPDATE, {
            type: 'CONVERSATION_UPDATE',
            conversation: parsedConversation
        });

        res.json(message);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send reply' });
    }
});

// PATCH /api/conversations/:id/status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const conversationId = req.params.id;

        if (!['OPEN', 'RESOLVED', 'WAITING'].includes(status)) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }

        const conversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                status: status,
                updatedAt: new Date()
            }
        });

        const parsedConversation = mapConvo(conversation);

        // Emit Real-time Event
        events.emit(CHANNELS.UPDATE, {
            type: 'CONVERSATION_UPDATE',
            conversation: parsedConversation
        });

        res.json(parsedConversation);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

export default router;
