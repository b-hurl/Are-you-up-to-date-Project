const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
admin.initializeApp();

// Runs everyday at 14:15 UTC (8:15 AM CST)
exports.resetStreaks = onSchedule({
    schedule: "15 14 * * *",
    timeZone: "Etc/UTC"
}, async (event) => {
    const db = admin.firestore();
    const now = new Date();
    
    // Helper to format YYYY-MM-DD
    const formatDate = (d) => {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };

    // Calculate "Yesterday's Game Date"
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);
    const yesterdayGameDate = formatDate(yesterday); 

    console.log(`Querying users who missed the cutoff: ${yesterdayGameDate}`);

    // Optimized Query: Filter by both streak and date at the database level
    const snapshot = await db.collection('users')
        .where('currentStreak', '>', 0)
        .where('lastPlayedDate', '<', yesterdayGameDate)
        .get();

    if (snapshot.empty) {
        console.log('No streaks to reset.');
        return null;
    }

    // Firestore batches are limited to 500 operations
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += 500) {
        chunks.push(snapshot.docs.slice(i, i + 500));
    }

    let successCount = 0;
    let failureCount = 0;
    const MAX_RETRIES = 3;
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const chunk of chunks) {
        let attempts = 0;
        let committed = false;

        while (attempts < MAX_RETRIES && !committed) {
            try {
                const batch = db.batch();
                chunk.forEach(doc => batch.update(doc.ref, { currentStreak: 0 }));
                await batch.commit();
                successCount += chunk.length;
                committed = true;
            } catch (error) {
                attempts++;
                if (attempts >= MAX_RETRIES) {
                    console.error(`Batch commit failed after ${MAX_RETRIES} attempts:`, error);
                    failureCount += chunk.length;
                } else {
                    const waitTime = Math.pow(2, attempts - 1) * 1000;
                    console.warn(`Attempt ${attempts} failed. Retrying in ${waitTime / 1000}s...`);
                    await delay(waitTime);
                }
            }
        }
    }

    console.log(`Streak reset complete. Successes: ${successCount}, Failures: ${failureCount}`);
    return null;
});

// --- TEMPORARY TESTING FUNCTION ---
// Access this URL in your browser to manually trigger the reset
exports.testResetStreaks = onRequest(async (req, res) => {
    const db = admin.firestore();
    const now = new Date();
    
    // Helper to format YYYY-MM-DD
    const formatDate = (d) => {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };

    // Same logic as above
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);
    const yesterdayGameDate = formatDate(yesterday); 

    // Query: Users with a streak > 0
    const snapshot = await db.collection('users')
        .where('currentStreak', '>', 0)
        .get();

    if (snapshot.empty) {
        res.send(`No users with active streaks found.`);
        return;
    }

    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.lastPlayedDate < yesterdayGameDate) {
            batch.update(doc.ref, { currentStreak: 0 });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
    }
    
    res.send(`Success! Reset streaks for ${count} users. (Cutoff date was ${yesterdayGameDate})`);
});
