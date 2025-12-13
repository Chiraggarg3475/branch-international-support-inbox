
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Inspecting Existing Data ---');

    // 1. Find a conversation with multiple messages
    const convos = await prisma.conversation.findMany({
        take: 5,
        include: {
            messages: {
                orderBy: { timestamp: 'asc' }
            }
        }
    });

    console.log(`Found ${convos.length} conversations.`);

    for (const c of convos) {
        console.log(`\nConversation ${c.id} (${c.status}):`);
        console.log(`Messages: ${c.messages.length}`);
        c.messages.forEach(m => {
            console.log(` - [${m.senderType}] ${m.content.substring(0, 50)}... (${m.timestamp.toISOString()})`);
        });

        if (c.messages.length < 2) {
            console.log(' (Single message conversation)');
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
