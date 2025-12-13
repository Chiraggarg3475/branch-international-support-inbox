
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Backend Persistence ---');

    // 1. Create a Test Customer
    const customerId = 'DEBUG_USER_' + Date.now();
    await prisma.customer.create({
        data: { id: customerId, firstName: 'Debug', lastName: 'User' }
    });
    console.log('1. Created Customer:', customerId);

    // 2. Create Conversation
    const convo = await prisma.conversation.create({
        data: {
            customerId,
            title: 'Debug Conversation',
            status: 'OPEN',
            lastMessageAt: new Date(),
            urgencyScore: 50,
            urgencyReasons: '[]'
        }
    });
    console.log('2. Created Conversation:', convo.id);

    // 3. Create Customer Message (Initial)
    const msg1 = await prisma.message.create({
        data: {
            conversationId: convo.id,
            senderType: 'CUSTOMER',
            content: 'Initial Customer Message',
            timestamp: new Date(),
            isRead: false
        }
    });
    console.log('3. Created Message 1:', msg1.id);

    // 4. Simulate Agent Reply (Backend Logic)
    const replyContent = 'Agent Reply Content';
    const msg2 = await prisma.message.create({
        data: {
            conversationId: convo.id,
            senderType: 'AGENT',
            content: replyContent,
            timestamp: new Date(Date.now() + 1000), // Ensure later timestamp
            isRead: true
        }
    });
    console.log('4. Created Agent Reply:', msg2.id);

    // 5. Fetch Full Conversation (Simulate GET /:id)
    const fetched = await prisma.conversation.findUnique({
        where: { id: convo.id },
        include: {
            messages: {
                orderBy: { timestamp: 'asc' }
            }
        }
    });

    console.log('5. Fetched Conversation Messages:', fetched?.messages.length);
    fetched?.messages.forEach((m, i) => {
        console.log(`   [${i}] ${m.senderType}: ${m.content} (${m.timestamp.toISOString()})`);
    });

    if (fetched?.messages.length !== 2) {
        console.error('FAIL: Expected 2 messages, found', fetched?.messages.length);
        process.exit(1);
    }

    if (fetched.messages[0].id !== msg1.id || fetched.messages[1].id !== msg2.id) {
        console.error('FAIL: Message order or IDs mismatch');
        process.exit(1);
    }

    console.log('SUCCESS: Backend persistence is working correctly.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
