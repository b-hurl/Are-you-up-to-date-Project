/**
 * Processes raw trivia JSON data into game rounds based on the active mode.
 */
const getTriviaRound = (questions, gameMode, soloSubMode, selection) => {
    const professionalCats = ['Economy', 'Politics', 'Science', 'Finance', 'World', 'Technology', 'Business', 'Health', 'Environment', 'Markets'];
    const casualCats = ['Entertainment', 'Music', 'Gaming', 'Sports', 'Celebrity', 'Pop Culture', 'Lifestyle', 'Weather', 'Movies', 'Food', 'Travel'];

    let filtered = [];
    let numQuestions = 5; // Default for categories

    if (gameMode === 'solo') {
        if (soloSubMode === 'gauntlet') {
            numQuestions = 10;
            const targetCats = selection === 'professional' ? professionalCats : casualCats;
            filtered = questions.filter(q => targetCats.includes(q.category));
        } else if (soloSubMode === 'categories') {
            numQuestions = 5;
            filtered = questions.filter(q => q.category === selection);
        }
    }
    // Fallback if no specific mode/submode matches, or if it's not solo mode (e.g., multiplayer, though not implemented here)
    if (filtered.length === 0) {
        filtered = questions; // Fallback to all questions if no filter applies
        numQuestions = 5; // Default to 5 questions for fallback
    }

    return filtered
        .sort(() => 0.5 - Math.random())
        .slice(0, numQuestions);
};

/**
 * Example Usage:
 * const dailyData = require('../2026-03-31.json');
 * 
 * // New System
 * const sportsRound = getTriviaRound(dailyData, 'new', 'Sports');
 * 
 * // Legacy Mode
 * const legacyProfessional = getTriviaRound(dailyData, 'legacy', 'professional');
 */