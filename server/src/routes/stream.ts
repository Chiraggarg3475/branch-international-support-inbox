import { Router } from 'express';
import { events, CHANNELS } from '../services/events';

const router = Router();

router.get('/', (req, res) => {
    // Headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Initial connection message
    sendEvent({ type: 'CONNECTED' });

    const listener = (payload: any) => {
        sendEvent(payload);
    };

    events.on(CHANNELS.UPDATE, listener);

    // Cleanup on close
    req.on('close', () => {
        events.off(CHANNELS.UPDATE, listener);
    });
});

export default router;
