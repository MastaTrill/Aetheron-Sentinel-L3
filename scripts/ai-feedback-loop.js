#!/usr/bin/env node

/**
 * Sentinel AI Feedback Loop
 * Validates AI predictions against ground truth and retrains models
 */

const hivemind = require('./hivemind-integration');
const ipfs = require('./ipfs-integration');
const { createClient } = require('../src/lib/supabase/server');

async function runFeedbackLoop() {
    const supabase = await createClient();
    console.log('🔄 Starting AI Feedback Loop...');

    // 1. Fetch recent events from Supabase that haven't been validated
    const { data: events, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('validated', false)
        .limit(50);

    if (error || !events.length) {
        console.log('No new events to validate.');
        return;
    }

    const predictions = [];
    const groundTruth = [];

    for (const event of events) {
        // 2. Fetch ground truth (In a real scenario, this checks if a hack actually happened)
        // For now, we compare the prediction against the Monitor's confirmed anomaly status
        const actualOutcome = event.risk_score > 5 ? 1 : 0;

        predictions.push(event.analysis_data);
        groundTruth.push({ txHash: event.tx_hash, outcome: actualOutcome });

        // Mark as validated
        await supabase.from('security_events').update({ validated: true }).eq('id', event.id);
    }

    // 3. Validate via Hivemind
    try {
        const validationResult = await hivemind.validatePredictions(predictions, groundTruth);
        console.log('📈 Model Performance Metrics:', validationResult.metrics);

        // 4. If accuracy drops below 90%, trigger retraining
        if (validationResult.metrics.accuracy < 0.90) {
            console.warn('⚠️ Accuracy low. Triggering model retraining...');
            await hivemind.trainSentinelModel(groundTruth.map(gt => ({
                features: [/* extracted features from IPFS log */],
                label: gt.outcome
            })));
        }
    } catch (err) {
        console.error('Feedback loop failed:', err.message);
    }
}

if (require.main === module) {
    runFeedbackLoop();
    // Run every 6 hours
    setInterval(runFeedbackLoop, 6 * 60 * 60 * 1000);
}