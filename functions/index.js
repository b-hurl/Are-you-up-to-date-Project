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

    console.log(`Checking for streaks broken before ${yesterdayGameDate}`);

    // Query: Users with a streak > 0 (We filter date in memory to avoid Firestore multi-field inequality error)
    const snapshot = await db.collection('users')
        .where('currentStreak', '>', 0)
        .get();

    if (snapshot.empty) {
        console.log('No streaks to reset.');
        return null;
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
        console.log(`Reset streaks for ${count} users.`);
    } else {
        console.log('No streaks needed resetting.');
    }
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
