const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CSV_PATH = path.resolve(__dirname, '../../GeneralistRails_Project_MessageData.csv');

function calculateUrgency(content, timeGapHours) {
    let score = 0;
    const reasons = [];

    const lower = content.toLowerCase();

    if (lower.includes('loan') || lower.includes('money') || lower.includes('urgent')) {
        score += 30;
        reasons.push({ rule: 'Keyword', description: 'Contains urgent keywords' });
    }
    if (lower.includes('blocked') || lower.includes('rejected') || lower.includes('denied')) {
        score += 40;
        reasons.push({ rule: 'Critical', description: 'Negative sentiment/Blockage' });
    }

    if (timeGapHours > 24) {
        score += 20;
        reasons.push({ rule: 'Gap', description: 'Long wait time' });
    }

    return { score: Math.min(score, 100), reasons };
}

async function ingest() {
    console.log('Reading CSV from:', CSV_PATH);

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`ERROR: CSV not found at ${CSV_PATH}`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
    });

    console.log(`Found ${records.length} messages. Sorting...`);

    records.sort((a, b) => {
        if (a['User ID'] !== b['User ID']) return a['User ID'].localeCompare(b['User ID']);
        return new Date(a['Timestamp (UTC)']).getTime() - new Date(b['Timestamp (UTC)']).getTime();
    });

    console.log('Processing records...');

    const activeConvos = new Map();

    for (const record of records) {
        const userId = record['User ID'];
        const timestamp = new Date(record['Timestamp (UTC)']);
        const content = record['Message Body'];

        await prisma.customer.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId, firstName: `User`, lastName: userId },
        });

        let conversation = activeConvos.get(userId);
        let isNewConvo = false;
        let timeGap = 0;

        if (conversation) {
            const lastMsgTime = new Date(conversation.lastMessageAt);
            const diff = (timestamp.getTime() - lastMsgTime.getTime()) / (1000 * 60 * 60);
            timeGap = diff;
            if (diff > 24) {
                isNewConvo = true;
            }
        } else {
            isNewConvo = true;
        }

        const { score: msgScore, reasons: msgReasons } = calculateUrgency(content, timeGap);

        if (isNewConvo) {
            const title = content.length > 40 ? content.substring(0, 40) + '...' : content;
            conversation = await prisma.conversation.create({
                data: {
                    customerId: userId,
                    title: title,
                    status: 'OPEN',
                    lastMessageAt: timestamp,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    urgencyScore: msgScore,
                    urgencyReasons: JSON.stringify(msgReasons),
                }
            });
        } else {
            const currentScore = conversation.urgencyScore || 0;
            const currentReasons = conversation.urgencyReasons ? JSON.parse(conversation.urgencyReasons) : [];

            const newReasons = [...currentReasons];
            for (const r of msgReasons) {
                const exists = newReasons.some(xr => xr.rule === r.rule && xr.description === r.description);
                if (!exists) {
                    newReasons.push(r);
                }
            }

            const newScore = Math.min(100, currentScore + msgScore);

            conversation = await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: timestamp,
                    updatedAt: timestamp,
                    urgencyScore: newScore,
                    urgencyReasons: JSON.stringify(newReasons),
                }
            });
        }

        activeConvos.set(userId, conversation);

        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderType: 'CUSTOMER',
                content: content,
                timestamp: timestamp,
                isRead: false,
            }
        });
    }

    console.log('Ingestion complete.');
}

ingest()
    .catch(e => {
        console.error('FATAL ERROR:');
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
