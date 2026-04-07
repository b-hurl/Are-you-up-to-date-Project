const fs = require('fs');
const dir = './questions';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}
const path = require('path');

const MIXES = {
    'casual-mix': ['gaming', 'entertainment', 'sports', 'books', 'health'],
    'professional-mix': ['technology', 'science', 'world', 'business', 'canada', 'usa']
};

function createDailyMixes() {
    // 1. USE LOCAL DATE (The fix we discussed for "Tomorrow" issue)
const date = new Date();
const dateStr = date.toLocaleDateString('en-CA'); // Outputs "2026-04-06"
    
    // 2. ABSOLUTE PATH (Ensures it finds the folder regardless of where you run it)
    const questionsDir = path.join(process.cwd(), 'questions');
    console.log(`🔍 Looking for files in: ${questionsDir}`);

    for (const [mixName, categories] of Object.entries(MIXES)) {
        let pool = [];
        console.log(`\n🌀 Building ${mixName}...`);

        categories.forEach(cat => {
            const fileName = `${dateStr}-${cat}.json`;
            const filePath = path.join(questionsDir, fileName);

            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (data.questions && data.questions.length > 0) {
                    pool = pool.concat(data.questions.map(q => ({ ...q, category: cat })));
                    console.log(` ✅ Found ${data.questions.length} questions in ${fileName}`);
                }
            } else {
                console.warn(` ❌ Could not find: ${fileName}`);
            }
        });

        // 3. ONLY SAVE IF WE FOUND QUESTIONS
        if (pool.length > 0) {
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }

            const finalSelection = {
                date: dateStr,
                type: mixName,
                questions: pool.slice(0, 10)
            };

            const outPath = path.join(questionsDir, `${dateStr}-${mixName}.json`);
            fs.writeFileSync(outPath, JSON.stringify(finalSelection, null, 2));
            console.log(`✨ SUCCESS: Saved 10 questions to ${dateStr}-${mixName}.json`);
        } else {
            console.error(` ⛔ FAILURE: No questions found for ${mixName}. Check your filenames!`);
        }
    }
}

createDailyMixes();