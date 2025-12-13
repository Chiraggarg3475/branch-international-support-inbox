export interface UrgencyResult {
    score: number;
    reasons: Array<{ rule: string; description: string }>;
}

export function calculateUrgency(content: string, timeGapHours: number): UrgencyResult {
    let score = 0;
    const reasons: Array<{ rule: string; description: string }> = [];

    const lower = content.toLowerCase();

    // Rule 1: Keywords (Finance/Urgency)
    if (lower.includes('loan') || lower.includes('money') || lower.includes('fund')) {
        score += 20;
        reasons.push({ rule: 'Keyword', description: 'Financial intent detected' });
    }
    if (lower.includes('urgent') || lower.includes('wait') || lower.includes('asap')) {
        score += 25;
        reasons.push({ rule: 'Keyword', description: 'Explicit urgency' });
    }

    // Rule 2: Sentiment / Blockers
    if (lower.includes('blocked') || lower.includes('rejected') || lower.includes('denied') || lower.includes('error')) {
        score += 40;
        reasons.push({ rule: 'Critical', description: 'Blockage or negative sentiment' });
    }

    if (content.includes('??') || content === content.toUpperCase() && content.length > 10) {
        score += 15;
        reasons.push({ rule: 'Sentiment', description: 'High emotional intensity (Caps/Punctuation)' });
    }

    // Rule 3: Time Decay / Gap
    if (timeGapHours > 6 && timeGapHours <= 24) {
        score += 10;
        reasons.push({ rule: 'Gap', description: 'Waiting > 6 hours' });
    } else if (timeGapHours > 24) {
        score += 30;
        reasons.push({ rule: 'Gap', description: 'Waiting > 24 hours' });
    }

    return {
        score: Math.min(score, 100),
        reasons
    };
}
