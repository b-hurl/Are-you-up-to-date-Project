console.log("📦 GameSettings.jsx: Transpilation starting...");
window.GameSettingsReady = false;

const MenuButton = ({ onClick, isSelected, isDisabled, isCompleted, title, description, isSmall, badge }) => {
    const baseClasses = `w-full transition-all text-left border-2 ${isSmall ? 'p-4 rounded-2xl' : 'p-5 rounded-2xl'}`;
    const stateClasses = isDisabled
        ? 'bg-slate-900/50 border-slate-800 opacity-30 cursor-not-allowed grayscale'
        : isSelected
            ? 'selected border-primary-400 bg-primary-600/40 shadow-lg shadow-primary-500/20'
            : isCompleted
                ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400'
                : 'bg-slate-700/50 border-slate-600 hover:border-primary-500 hover:animate-[selection-pulse_2s_infinite_ease-in-out]';

    return (
        <button onClick={onClick} disabled={isDisabled} className={`${baseClasses} ${stateClasses} relative`}>
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                    <span className={`block font-bold capitalize leading-tight ${isSmall ? 'text-sm mb-1' : 'text-lg'}`}>
                        {title}
                    </span>
                    {description && (
                        <span className={isSmall ? 'text-[9px] text-slate-500 uppercase tracking-tighter font-black block' : 'text-sm text-slate-400'}>
                            {description}
                        </span>
                    )}
                </div>
                {badge && (
                    <span className="flex-shrink-0 bg-primary-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg shadow-primary-500/40 border border-primary-400/50">
                        {badge}
                    </span>
                )}
            </div>
        </button>
    );
};

const MenuView = ({ title, children, footer, onBack, backLabel }) => (
    <React.Fragment>
        <h2 className="text-2xl font-black mb-6 text-center text-white">{title}</h2>
        {children}
        {footer && (
            <div className="border-t border-slate-700 pt-4">
                <p className="text-center text-slate-500 text-[10px] uppercase tracking-widest font-bold">{footer}</p>
            </div>
        )}
        {onBack && (
            <button 
                onClick={onBack} 
                className="mt-4 text-primary-400 hover:text-white font-bold transition-colors flex items-center gap-2 mx-auto uppercase tracking-widest text-[10px]"
            >
                <span>←</span> {backLabel}
            </button>
        )}
    </React.Fragment>
);

const GameSettings = ({ currentConfig, onUpdate, playedModes = [], availableCategories = null }) => {
    const { useState, useEffect } = React;
    const [config, setConfig] = useState({
        gameMode: currentConfig?.gameMode || null,
        soloSubMode: currentConfig?.soloSubMode || null,
        multiSubMode: currentConfig?.multiSubMode || null,
        gauntletMode: currentConfig?.gauntletMode || null,
        activeSelection: currentConfig?.activeSelection || null
    });
    const [challenges, setChallenges] = useState(null);
    const [notificationCount, setNotificationCount] = useState(0);

    const CATEGORIES = ["technology", "science", "sports", "gaming", "entertainment", "books", "health", "business", "world", "canada", "usa"];

    // Reset sub-modes if gameMode changes
    useEffect(() => {
        setConfig({
            gameMode: currentConfig?.gameMode || null,
            soloSubMode: currentConfig?.soloSubMode || null,
            multiSubMode: currentConfig?.multiSubMode || null,
            gauntletMode: currentConfig?.gauntletMode || null,
            activeSelection: currentConfig?.activeSelection || null
        });
    }, [currentConfig]);

    // Check for challenge notifications
    useEffect(() => {
        if (config.gameMode === 'multiplayer' && window.fetchMyChallenges) {
            const checkNotifications = async () => {
                const list = await window.fetchMyChallenges();
                const seenStatus = JSON.parse(localStorage.getItem('trivia-seen-challenges') || '{}');
                
                const updates = list.filter(c => {
                    // Only notify for status changes to 'accepted' or 'completed'
                    const isInteresting = c.status === 'accepted' || c.status === 'completed';
                    return isInteresting && seenStatus[c.id] !== c.status;
                });
                
                setNotificationCount(updates.length);
            };
            checkNotifications();
            const interval = setInterval(checkNotifications, 15000); // Poll every 15s
            return () => clearInterval(interval);
        } else {
            setNotificationCount(0);
        }
    }, [config.gameMode]);

    useEffect(() => {
        if (config.multiSubMode === 'my-challenges' && window.fetchMyChallenges) {
            setChallenges(null);
            window.fetchMyChallenges().then(setChallenges);
        }
    }, [config.multiSubMode]);

    const handleGameModeSelection = (mode) => {
        setConfig({
            gameMode: mode,
            soloSubMode: null,
            multiSubMode: null,
            gauntletMode: null,
            activeSelection: null
        });
        onUpdate({
            gameMode: mode,
            activeSelection: null
        });
    };

    const handleSoloSubModeSelection = (subMode) => {
        setConfig(prev => ({
            ...prev,
            soloSubMode: subMode,
            gauntletMode: null,
            activeSelection: null
        }));
        onUpdate({
            gameMode: config.gameMode,
            soloSubMode: subMode
        });
    };

    const handleMultiSubModeSelection = async (subMode) => {
        if (subMode === 'gauntlet') {
            const isLoggedIn = window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
            if (!isLoggedIn) {
                if (window.showGauntletAuthPrompt) {
                    await window.showGauntletAuthPrompt();
                } else {
                    alert("You must be logged in to play the Multiplayer Gauntlet.");
                }
                return; // Stay on the multiplayer menu
            }
        }
        if (subMode === 'categories') {
            const currentName = localStorage.getItem('trivia-name') || sessionStorage.getItem('trivia-name');
            if (!currentName || currentName.trim() === "") {
                if (window.showNamePrompt) {
                    const newName = await window.showNamePrompt("Enter a display name for multiplayer versus:");
                    if (!newName) return; // Stay on multiplayer menu
                } else {
                    const newName = prompt("Enter a display name for multiplayer versus:");
                    if (!newName) return;
                    localStorage.setItem('trivia-name', newName);
                }
            }
        }

        if (subMode === 'my-challenges') {
            if (window.fetchMyChallenges) {
                const list = await window.fetchMyChallenges();
                const seenStatus = JSON.parse(localStorage.getItem('trivia-seen-challenges') || '{}');
                list.forEach(c => {
                    seenStatus[c.id] = c.status;
                });
                localStorage.setItem('trivia-seen-challenges', JSON.stringify(seenStatus));
            }
            setNotificationCount(0);
        }

        setConfig(prev => ({
            ...prev,
            multiSubMode: subMode,
            gauntletMode: null,
            activeSelection: null
        }));
        onUpdate({
            gameMode: config.gameMode,
            multiSubMode: subMode
        });
    };

    const handleGauntletModeSelection = (mode) => {
        const isSolo = config.gameMode === 'solo';
        setConfig(prev => ({
            ...prev,
            gauntletMode: mode,
            activeSelection: mode
        }));
        onUpdate({
            gameMode: config.gameMode,
            [isSolo ? 'soloSubMode' : 'multiSubMode']: 'gauntlet',
            gauntletMode: mode,
            activeSelection: mode // For gauntlet, activeSelection is casual/professional
        });
    };

    const handleCategorySelection = (category) => {
        const isSolo = config.gameMode === 'solo';
        const isMulti = config.gameMode === 'multiplayer';

        setConfig(prev => ({
            ...prev,
            activeSelection: category
        }));

        // Only trigger immediate game load for solo
        if (isSolo) {
            onUpdate({
                gameMode: 'solo',
                soloSubMode: 'categories',
                activeSelection: category
            });
        }
        // For multi, we stay in the menu to show the "Create Challenge" screen
    };

    const renderMainMenu = () => (
        <MenuView title="Are You Up To Date?" footer="Each round consists of 5 questions.">
            <div className="grid grid-cols-1 gap-4 mb-8">
                <MenuButton
                    onClick={() => handleGameModeSelection('solo')}
                    isSelected={config.gameMode === 'solo' && !config.soloSubMode}
                    title="Solo Play"
                    description="Test your knowledge against the clock."
                />

                <MenuButton
                    onClick={() => handleGameModeSelection('multiplayer')}
                    isSelected={config.gameMode === 'multiplayer'}
                    title="Play Against Friends"
                    description="Challenge your friends and see who's more up to date."
                />
            </div>
        </MenuView>
    );

    const renderMultiSubMenu = () => (
        <MenuView title="Multiplayer" onBack={() => handleGameModeSelection(null)} backLabel="Back to Main Menu">
            <div className="grid grid-cols-1 gap-4 mb-8">
                <MenuButton
                    onClick={() => handleMultiSubModeSelection('gauntlet')}
                    isSelected={config.multiSubMode === 'gauntlet'}
                    title="Gauntlet"
                    description="10 questions: Compete on the group leaderboard."
                />

                <MenuButton
                    onClick={() => handleMultiSubModeSelection('categories')}
                    isSelected={config.multiSubMode === 'categories'}
                    title="Categories"
                    description="5 questions: 1v1 challenge mode."
                />

                <MenuButton
                    onClick={() => handleMultiSubModeSelection('my-challenges')}
                    isSelected={config.multiSubMode === 'my-challenges'}
                    title="My Challenges"
                    description="View active and past 1v1 matches."
                    badge={notificationCount > 0 ? notificationCount : null}
                />
            </div>
        </MenuView>
    );

    const renderSoloSubMenu = () => (
        <MenuView title="Solo Play" onBack={() => handleGameModeSelection(null)} backLabel="Back to Main Menu">
            <div className="grid grid-cols-1 gap-4 mb-8">
                <MenuButton
                    onClick={() => handleSoloSubModeSelection('gauntlet')}
                    isSelected={config.soloSubMode === 'gauntlet'}
                    title="Gauntlet"
                    description="10 questions: Casual or Professional mix."
                />

                <MenuButton
                    onClick={() => handleSoloSubModeSelection('categories')}
                    isSelected={config.soloSubMode === 'categories'}
                    title="Categories"
                    description="5 questions from a specific topic."
                />
            </div>
        </MenuView>
    );

    const renderGauntletOptions = () => {
        const gameDate = (typeof getGameDate === 'function') ? getGameDate() : (window.getGameDate ? window.getGameDate() : '');
        let archive = {};
        try {
            archive = JSON.parse(localStorage.getItem('trivia-archive') || '{}');
        } catch (e) {}

        const modes = [
            { id: 'casual', title: 'Casual Gauntlet', desc: '10 questions: Entertainment, sports, etc.' },
            { id: 'professional', title: 'Professional Gauntlet', desc: '10 questions: Economy, politics, tech, etc.' }
        ];

        return (
            <MenuView title="Gauntlet Mode" onBack={() => config.gameMode === 'solo' ? handleSoloSubModeSelection(null) : handleMultiSubModeSelection(null)} backLabel={config.gameMode === 'solo' ? "Back to Solo Play" : "Back to Multiplayer"}>
                <div className="grid grid-cols-1 gap-4 mb-8">
                    {modes.map(m => {
                        const isPlayed = playedModes.includes(m.id);
                        const savedScore = archive[gameDate]?.[m.id]?.score;
                        const isMulti = config.gameMode === 'multiplayer';

                        return (
                            <MenuButton
                                key={m.id}
                                onClick={() => handleGauntletModeSelection(m.id)}
                                isSelected={config.gauntletMode === m.id}
                                isDisabled={isPlayed}
                                title={m.title}
                                description={isPlayed ? (
                                    savedScore !== undefined 
                                        ? `Daily Score: ${savedScore}/10 ${isMulti ? '⚔️' : ''}` 
                                        : 'Completed for Today'
                                ) : m.desc}
                            />
                        );
                    })}
                </div>
            </MenuView>
        );
    };

    const renderMultiplayerCategorySetup = () => {
        const gameDate = (typeof getGameDate === 'function') ? getGameDate() : (window.getGameDate ? window.getGameDate() : '');
        let archive = {};
        try {
            archive = JSON.parse(localStorage.getItem('trivia-archive') || '{}');
        } catch (e) {}
        const savedScore = archive[gameDate]?.[config.activeSelection]?.score;

        return (
            <MenuView title={`Challenge in ${config.activeSelection}`} onBack={() => setConfig(p => ({...p, activeSelection: null}))} backLabel="Back to Categories">
                <div className="space-y-4 mb-8">
                    {savedScore !== undefined ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl text-center animate-fade-in shadow-inner">
                            <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-1">Your Daily Score</p>
                            <p className="text-4xl font-black text-white">{savedScore}/5</p>
                            <p className="text-slate-500 text-[9px] mt-2 uppercase font-bold">Ready to send challenge link</p>
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm text-center">
                            Challenge a friend in {config.activeSelection}! Generate your 1v1 link, then play to set the score they need to beat.
                        </p>
                    )}
                    <button 
                        onClick={() => window.prepareAndCreateChallenge(config.activeSelection)}
                        className="w-full bg-primary-600 hover:bg-primary-500 py-4 rounded-2xl font-black text-white transition-all shadow-lg shadow-primary-500/20"
                    >
                        {savedScore !== undefined ? "Create Challenge with This Score" : "Create Challenge Link"}
                    </button>
                </div>
            </MenuView>
        );
    };

    const renderMyChallenges = () => (
        <MenuView title="My Challenges" onBack={() => handleMultiSubModeSelection(null)} backLabel="Back to Multiplayer">
            <div className="space-y-3 mb-8 max-h-80 overflow-y-auto p-1 custom-scrollbar">
                {challenges === null ? (
                    <p className="text-center text-slate-500 text-xs animate-pulse py-8">Loading challenges...</p>
                ) : challenges.length === 0 ? (
                    <p className="text-center text-slate-500 text-xs py-8 bg-slate-900/30 rounded-2xl border border-slate-700/30">No challenges found yet.</p>
                ) : (
                    challenges.map(c => {
                        const isP1 = c.role === 'p1';
                        const opponent = isP1 ? c.p2 : c.p1;
                        const myData = isP1 ? c.p1 : c.p2;
                        const oppData = opponent;
                        const isCompleted = c.status === 'completed';
                        const isRefused = c.status === 'refused';
                        const isWinner = isCompleted && myData.score > (oppData?.score || 0);
                        
                        let resultLabel = '';
                        if (isCompleted && oppData && oppData.completed) {
                            if (myData.score > oppData.score) resultLabel = 'WIN';
                            else if (myData.score < oppData.score) resultLabel = 'LOSS';
                            else resultLabel = 'TIE';
                        }

                        return (
                            <div key={c.id} className="bg-slate-700/50 border border-slate-600 p-4 rounded-2xl animate-fade-in">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest block">
                                            {c.category} • {c.date} {resultLabel && <span className={`ml-2 px-1.5 py-0.5 rounded ${resultLabel === 'WIN' ? 'bg-emerald-500 text-white' : resultLabel === 'LOSS' ? 'bg-red-500 text-white' : 'bg-slate-500 text-white'}`}>{resultLabel}</span>}
                                        </span>
                                        <span className="text-sm font-bold text-white">vs {oppData && oppData.name ? oppData.name : 'Waiting...'}</span>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
                                        isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 
                                        isRefused ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                        {c.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Score: <strong className="text-white">{myData.score}/5</strong></span>
                                    <span className="text-slate-400">Opponent: <strong className="text-white">{oppData && oppData.completed ? oppData.score + '/5' : '...'}</strong></span>
                                </div>

                                {c.inviteTaunt && (
                                    <div className="mt-3 p-2 bg-slate-900/50 rounded-lg border border-slate-700">
                                        <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Invite Taunt</p>
                                        <p className="text-xs text-slate-300 italic">"{c.inviteTaunt}"</p>
                                    </div>
                                )}

                                {isCompleted && (
                                    <div className="mt-3 p-2 bg-primary-900/20 rounded-lg border border-primary-500/20">
                                        <p className="text-[9px] text-primary-400 uppercase font-black mb-1">Victory Message</p>
                                        {c.victoryTaunt ? (
                                            <p className="text-xs text-white italic">"{c.victoryTaunt}"</p>
                                        ) : (
                                            <p className="text-xs text-slate-500 italic">No victory taunt set.</p>
                                        )}
                                        {isWinner && (
                                            <button 
                                                onClick={() => window.set1v1VictoryTaunt(c.id)}
                                                className="mt-2 text-[9px] text-primary-400 hover:text-white uppercase font-bold"
                                            >
                                                {c.victoryTaunt ? '✎ Edit Victory Taunt' : '+ Set Victory Taunt'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {isP1 && (
                                    <div className="mt-3 flex gap-2">
                                        {(c.status === 'pending' || c.status === 'refused') && (
                                            <button 
                                                onClick={() => {
                                                    onUpdate({ activeSelection: c.category });
                                                    window.openInviteModal(c.id);
                                                }}
                                                className="flex-1 bg-primary-600/20 hover:bg-primary-600/40 text-primary-300 border border-primary-500/30 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
                                            >
                                                Send to Someone Else
                                            </button>
                                        )}
                                        {(c.status === 'pending' || c.status === 'refused' || c.status === 'accepted') && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.revokeChallenge(c.id);
                                                    // Refresh the list immediately
                                                    window.fetchMyChallenges().then(setChallenges);
                                                }}
                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
                                            >
                                                Revoke
                                            </button>
                                        )}
                                    </div>
                                )}
                                {isCompleted && (
                                    <div className="mt-3">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.handleRematch) {
                                                    window.handleRematch(c.id).then(() => {
                                                        window.fetchMyChallenges().then(setChallenges);
                                                    });
                                                }
                                            }}
                                            className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
                                        >
                                            Rematch
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </MenuView>
    );

    const renderCategoryOptions = () => (
        <MenuView title="Select a Category" onBack={() => config.gameMode === 'solo' ? handleSoloSubModeSelection(null) : handleMultiSubModeSelection(null)} backLabel={config.gameMode === 'solo' ? "Back to Solo Play" : "Back to Multiplayer"}>
            <div className="grid grid-cols-2 gap-3 mb-8 max-h-80 overflow-y-auto p-1 custom-scrollbar">
                {(() => {
                    const gameDate = (typeof getGameDate === 'function') ? getGameDate() : (window.getGameDate ? window.getGameDate() : '');
                    let archive = {};
                    let activeChallengesData = {};
                    try {
                        archive = JSON.parse(localStorage.getItem('trivia-archive') || '{}');
                        const activeAll = JSON.parse(localStorage.getItem('trivia-active-challenges') || '{}');
                        activeChallengesData = (gameDate && activeAll[gameDate]) ? activeAll[gameDate] : {};
                    } catch (e) {
                        console.warn("Failed to parse local storage trivia data", e);
                    }
                    
                    // Handle both legacy array format and new object mapping for isSent calculation
                    const activeChallenges = Array.isArray(activeChallengesData) ? activeChallengesData : Object.keys(activeChallengesData || {});

                    return CATEGORIES.filter(cat =>
                        // Only show category if it has questions available today
                        // or if the data hasn't loaded (or failed to load) yet (null)
                        availableCategories === null || availableCategories.includes(cat)
                    ).map(category => {
                        const isPlayed = playedModes.includes(category);
                        const isMulti = config.gameMode === 'multiplayer';
                        const isSent = isMulti && activeChallenges.includes(category);
                        const savedScore = archive[gameDate]?.[category]?.score;
                        const isCompleted = isMulti && isPlayed;

                        return (
                            <MenuButton
                                key={category}
                                onClick={() => {
                                    if (isMulti && isSent) {
                                        onUpdate({ activeSelection: category });
                                        window.openInviteModal(activeChallengesData[category]);
                                    } else {
                                        handleCategorySelection(category);
                                    }
                                }}
                                isSelected={config.activeSelection === category}
                                isDisabled={!isMulti && isPlayed}
                                isCompleted={isCompleted}
                                isSmall={true}
                                title={category}
                                description={isPlayed ? (
                                    isSent ? (
                                        <span className="flex items-center justify-between w-full">
                                            <span>Challenge Sent ✉️</span>
                                            <span 
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent re-triggering the challenge creation
                                                    window.revokeChallenge(category);
                                                }}
                                                className="ml-2 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 rounded text-[8px] font-black uppercase tracking-tighter transition-all"
                                            >
                                                Revoke
                                            </span>
                                        </span>
                                    ) : 
                                    (savedScore !== undefined ? `Score: ${savedScore}/5 ${isMulti ? '⚔️' : ''}` : 'Completed')
                                ) : '5 Daily Questions'}
                            />
                        );
                    });
                })()}
            </div>
        </MenuView>
    );

    const renderActiveView = () => {
        if (!config.gameMode) return renderMainMenu();
        if (config.gameMode === 'solo') {
            if (!config.soloSubMode) return renderSoloSubMenu();
            if (config.soloSubMode === 'gauntlet') return renderGauntletOptions();
            if (config.soloSubMode === 'categories') return renderCategoryOptions();
        } else if (config.gameMode === 'multiplayer') {
            if (!config.multiSubMode) return renderMultiSubMenu();
            if (config.multiSubMode === 'gauntlet') return renderGauntletOptions();
            if (config.multiSubMode === 'my-challenges') return renderMyChallenges();
            if (config.multiSubMode === 'categories') {
                if (config.activeSelection) return renderMultiplayerCategorySetup();
                return renderCategoryOptions();
            }
        }
        return (
            <div className="text-center p-4">
                <p className="text-slate-500 text-xs animate-pulse">Initializing Menu...</p>
            </div>
        );
    };

    return (
        <div className="p-8 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 max-w-md mx-auto">
            {renderActiveView()}
        </div>
    );
};

// Explicitly attach to window for index.html access
window.GameSettings = GameSettings;
window.GameSettingsReady = true;
console.log("✅ GameSettings component attached to window.");

// Robust Handshake: Poll for the render function in index.html
const attemptInitialRender = () => {
    if (typeof window.renderGameSettings === 'function') {
        console.log("🔗 GameSettings: Handshake successful, triggering render.");
        console.log("🔗 GameSettings: Handshake successful, triggering render.");
        window.renderGameSettings();
    } else {
        console.log("🔗 GameSettings: Waiting for index.html render function...");
        setTimeout(attemptInitialRender, 100);
    }
};
attemptInitialRender();