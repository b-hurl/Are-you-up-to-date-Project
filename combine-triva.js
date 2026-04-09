const fs = require('fs');
const dir = './questions';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}
const path = require('path');

const GAUNTLET_GROUPS = {
    'casual': ['gaming', 'entertainment', 'sports', 'books', 'health'],
    'professional': ['technology', 'science', 'world', 'business', 'canada', 'usa']
};

function createDailyMixes() {
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-CA'); 
    
    const questionsDir = path.join(process.cwd(), 'questions');
    console.log(`🔍 Looking for files in: ${questionsDir}`);

    for (const [groupName, categories] of Object.entries(GAUNTLET_GROUPS)) {
        let pool = [];
        console.log(`\n🌀 Building pools for ${groupName.toUpperCase()} gauntlets...`);

        categories.forEach(cat => {
            const fileName = `${dateStr}-${cat}.json`;
            const filePath = path.join(questionsDir, fileName);

            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const questions = data.questions || [];
                if (questions.length > 0) {
                    // Tag the category for display and add to pool
                    pool = pool.concat(questions.map(q => ({ 
                        ...q, 
                        category: q.category || (cat.charAt(0).toUpperCase() + cat.slice(1)) 
                    })));
                    console.log(`   ✅ Found ${questions.length} questions in ${fileName}`);
                }
            } else {
                console.warn(`   ❌ Missing source file: ${fileName}`);
            }
        });

        if (pool.length > 0) {
            // Shuffle the entire master pool once to ensure randomness
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }

            // Create distinct splits: Solo (0-10) and Multiplayer (10-20)
            const gauntletDefinitions = [
                { name: `solo-${groupName}-gauntlet`, questions: pool.slice(0, 10) },
                { name: `multiplayer-${groupName}-gauntlet`, questions: pool.slice(10, 20) }
            ];

            gauntletDefinitions.forEach(mix => {
                if (mix.questions.length > 0) {
                    const output = {
                        date: dateStr,
                        type: mix.name,
                        questions: mix.questions
                    };
                    const outPath = path.join(questionsDir, `${dateStr}-${mix.name}.json`);
                    if (fs.existsSync(outPath)) {
                        console.log(`🔄 Overwriting existing file: ${dateStr}-${mix.name}.json`);
                    }
                    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
                    console.log(`✨ SUCCESS: Saved ${mix.questions.length} questions to ${dateStr}-${mix.name}.json`);
                }
            });
        } else {
            console.error(` ⛔ FAILURE: No questions found for ${groupName} pool.`);
        }
    }
}

createDailyMixes();