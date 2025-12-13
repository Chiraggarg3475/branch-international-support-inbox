import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const CSV_PATH = path.join(__dirname, '../../GeneralistRails_Project_MessageData.csv');

interface UrgencyResult {
  score: number;
  reasons: Array<{ rule: string; description: string }>;
}

function calculateUrgency(content: string, timeGapHours: number): UrgencyResult {
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
  console.log('Reading CSV...');
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Found ${records.length} messages.`);

  // Sort: User, then Time
  records.sort((a: any, b: any) => {
    if (a['User ID'] !== b['User ID']) return a['User ID'].localeCompare(b['User ID']);
    return new Date(a['Timestamp (UTC)']).getTime() - new Date(b['Timestamp (UTC)']).getTime();
  });

  // Map<UserId, Conversation>
  const activeConvos = new Map<string, any>();

  for (const record of records) {
    const userId = record['User ID'];
    const timestamp = new Date(record['Timestamp (UTC)']);
    const content = record['Message Body'];

    // 1. Ensure Customer
    await prisma.customer.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, firstName: `User`, lastName: userId },
    });

    // 2. Check Windowing
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

    // 3. Calc Urgency
    const { score: msgScore, reasons: msgReasons } = calculateUrgency(content, timeGap);

    if (isNewConvo) {
      // Create new
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
          urgencyReasons: msgReasons as Prisma.InputJsonValue,
        }
      });
    } else {
      // Update existing
      const currentScore = conversation.urgencyScore || 0;
      const currentReasons = (conversation.urgencyReasons as any[]) || [];

      const newReasons = [...currentReasons];
      for (const r of msgReasons) {
        if (!newReasons.some((xr: any) => xr.rule === r.rule && xr.description === r.description)) {
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
          urgencyReasons: newReasons as Prisma.InputJsonValue,
        }
      });
    }

    // Update map
    activeConvos.set(userId, normalizeConversation(conversation));

    // 4. Create Message
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

function normalizeConversation(c: any) {
  return c;
}

ingest()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
