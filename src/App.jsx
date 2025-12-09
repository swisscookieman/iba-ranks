import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Swords, BarChart3, ChevronsUp, ChevronsDown, Loader2, Lock, Unlock, ArrowRight } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, 
  increment, writeBatch
} from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

/**
 * --- CONFIGURATION (THE "JSON FILE") ---
 */
const INITIAL_ROSTER = [
  { name: "Ben Francis" },
  { name: "Jake Beasley" },
  { name: "Shen Guo" },
  { name: "Donald Henry" },
  { name: "Darius Brown" },
  { name: "Onyekautukwu Nwankwoh" },
  { name: "Ricky Ellis" },
  { name: "Rodney Wallace" },
  { name: "Nikolajs Vairogs" },
  { name: "Michel Barrett" },
  { name: "Johan Boström" },
  { name: "Vlado Tomas" },
  { name: "Elia Kirchner" },
  { name: "David Best" },
  { name: "Ray Holmes" },
  { name: "Kevin Marck" },
  { name: "Ian Freeman" },
  { name: "Damien Geathers" },
  { name: "Dwayne Lieberman" },
  { name: "Youssef Auriemma" },
  { name: "Tyler Swanigan" },
  { name: "Thomas Broadnax" },
  { name: "Drew Williams" },
  { name: "Raharjo Indradjaja" },
  { name: "Nam Tae-Hyun" },
  { name: "Oren Gilbert" },
  { name: "Antoine McKay" },
  { name: "Nikola Sinovec" },
  { name: "Ugur Koseoglu" },
  { name: "Andrew Harrington" },
  { name: "Peter Zhong" },
  { name: "Joey Shui" },
  { name: "Jonathan Albarez" },
  { name: "Pavel Rodionov" },
  { name: "Javar Knight" },
  { name: "Michael Witt" },
  { name: "Ron Baxter Jr." },
  { name: "Ross Thomas" },
  { name: "Clay Davis" },
  { name: "Angelo Pace" },
  { name: "Cole Nelson" },
  { name: "Peter Travers" },
  { name: "Connor Kamana" },
  { name: "Zoran Alihodzic" },
  { name: "Mark Blind" },
  { name: "Charles Gibson" },
  { name: "Michael Hopper" },
  { name: "Adam Adamczyk" },
  { name: "Gil Cardoso" },
  { name: "Julian McNeil" },
  { name: "Toni Ercegovic" },
  { name: "David Blot" },
  { name: "Adham Tahan" },
  { name: "Rolandas Pocius" },
  { name: "Kieran Krslovic" },
  { name: "Kyle White" },
  { name: "Linos Labropoulos" },
  { name: "Min Sang-Hun" },
  { name: "Devin Eldredge" },
  { name: "Nando Wolff" },
  { name: "Yan Kang" },
  { name: "Javan Mathis" },
  { name: "Richard Gagnon" },
  { name: "Cícero de Figueiredo" },
  { name: "Lutz Berger" },
  { name: "Muratcan Suvari" },
  { name: "Martin Hoffmann" },
  { name: "Murray Forzani" },
  { name: "Duan Hu" },
  { name: "Simeão Derénusson" },
  { name: "Dante Ledesma" },
  { name: "Jonathan Schröder" },
  { name: "Brandon Benenoch" },
  { name: "Derrick Downs" },
  { name: "Jung Young-Nam" },
  { name: "Randy Woods" },
  { name: "Charlie Murphy" },
  { name: "Song Yin" },
  { name: "Alessandro Tote" },
  { name: "McCall Longoria" },
  { name: "Cody Jones" },
  { name: "Quintopolis Aboundomendo" },
  { name: "Austin Washington" },
  { name: "Baki Kilicli" },
  { name: "Stephon Parris" },
  { name: "Kerem Sahan" },
  { name: "Seth Battle" },
  { name: "Anthony Kamp" },
  { name: "David Krejčí" },
  { name: "Moataz Hajjar" },
  { name: "Miroslav Babic" },
  { name: "Lawrence Coley" },
  { name: "Chuck Zanna" },
  { name: "Juan Andrés Pavon" },
  { name: "Zou Xiuying" },
  { name: "Bunichi Mizusawa" },
  { name: "Peter Harrison" },
  { name: "Kevin Ross" },
  { name: "Walter Atkinson" },
  { name: "Timeu Assunção" },
];

/**
 * --- UTILITIES ---
 */

const K_FACTOR = 32;
const STARTING_ELO = 1200;
const COLLECTION_NAME = 'rankr_players_v3';
const LEADERBOARD_PASSWORD = "access"; // Simple Password

const TIERS = [
  { name: 'S', min: 1600, color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
  { name: 'A', min: 1400, color: 'text-red-400 border-red-400/30 bg-red-400/10' },
  { name: 'B', min: 1200, color: 'text-purple-400 border-purple-400/30 bg-purple-400/10' },
  { name: 'C', min: 1000, color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
  { name: 'D', min: 900, color: 'text-green-400 border-green-400/30 bg-green-400/10' },
  { name: 'F', min: 0,    color: 'text-gray-400 border-gray-400/30 bg-gray-400/10' },
];

const getTier = (elo) => TIERS.find(t => elo >= t.min) || TIERS[TIERS.length - 1];

const getExpectedScore = (ratingA, ratingB) => 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));

const calculateNewRatings = (winnerElo, loserElo) => {
  const expectedWinner = getExpectedScore(winnerElo, loserElo);
  const expectedLoser = getExpectedScore(loserElo, winnerElo);
  const newWinnerElo = Math.round(winnerElo + K_FACTOR * (1 - expectedWinner));
  const newLoserElo = Math.round(loserElo + K_FACTOR * (0 - expectedLoser));
  return { newWinnerElo, newLoserElo, winnerDelta: newWinnerElo - winnerElo, loserDelta: newLoserElo - loserElo };
};

// --- FIREBASE SETUP ---
const YOUR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD71D7LmnYtCkrwRRV1xKy-txkyCAA_rSM",
  authDomain: "ibaranks.firebaseapp.com",
  projectId: "ibaranks",
  storageBucket: "ibaranks.firebasestorage.app",
  messagingSenderId: "238254615494",
  appId: "1:238254615494:web:c5cf51b8def64329ce60c7"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : YOUR_FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const getCollectionRef = () => {
  if (typeof __app_id !== 'undefined') {
    return collection(db, 'artifacts', __app_id, 'public', 'data', COLLECTION_NAME);
  }
  return collection(db, COLLECTION_NAME);
};


/**
 * --- COMPONENTS ---
 */

const TierBadge = ({ elo, size = 'md', hidden = false }) => {
  if (hidden) {
    const sizeClasses = size === 'lg' ? 'w-12 h-12 text-xl' : 'w-8 h-8 text-xs';
    return (
      <div className={`${sizeClasses} text-slate-600 border border-slate-700 bg-slate-800/50 font-bold rounded-full flex items-center justify-center`}>
        ?
      </div>
    );
  }
   
  const tier = getTier(elo);
  const sizeClasses = size === 'lg' ? 'w-12 h-12 text-2xl' : 'w-8 h-8 text-sm';
  return (
    <div className={`${sizeClasses} ${tier.color} border font-bold rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.2)]`}>
      {tier.name}
    </div>
  );
};

const PlayerCard = ({ player, onClick, disabled, resultDelta, revealed }) => {
  // We keep the tier logic just for the glow effect, but we won't show the badge or number
  const tier = getTier(player.elo);
   
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-center justify-center w-full md:w-80 h-96 
        bg-slate-800 rounded-2xl border-2 transition-all duration-300
        ${disabled ? 'opacity-100 cursor-default' : 'hover:scale-105 hover:border-indigo-500 hover:shadow-2xl cursor-pointer border-slate-700'}
        ${revealed && resultDelta > 0 ? 'border-green-500 bg-green-900/10' : ''}
        ${revealed && resultDelta < 0 ? 'border-red-500 bg-red-900/10' : ''}
      `}
    >
      {/* Floating Delta Animation - Only shown when revealed */}
      {revealed && resultDelta !== undefined && (
        <div className={`absolute top-10 text-6xl font-black animate-bounce z-20 drop-shadow-lg
          ${resultDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {resultDelta > 0 ? '+' : ''}{resultDelta}
        </div>
      )}

      {/* Tier Glow - Only shown when revealed (Subtle background hint) */}
      {revealed && (
        <div className={`absolute inset-0 rounded-2xl opacity-10 transition-opacity duration-500 ${tier.color.replace('text-', 'bg-')}`}></div>
      )}

      <div className="z-10 flex flex-col items-center gap-4 w-full">
        {/* REMOVED TIER BADGE HERE FOR MYSTERY */}
        <div className="w-12 h-12 flex items-center justify-center text-slate-700 text-3xl font-black">
             ?
        </div>
        
        <h3 className="text-3xl font-bold text-slate-100 text-center px-4 break-words w-full">
          {player.name}
        </h3>
        
        <div className="flex flex-col items-center gap-1 mt-4 text-slate-400 min-h-[4rem]">
          <span className="text-sm uppercase tracking-widest font-semibold opacity-50">Current ELO</span>
          {/* ALWAYS HIDDEN ELO */}
          <span className={`text-2xl font-mono text-slate-600`}>
            ????
          </span>
        </div>

        {/* Stats remain hidden even after reveal to maintain mystery, only delta is shown */}
        <div className={`flex gap-4 mt-6 text-xs text-slate-500 font-mono opacity-0`}>
          <span className="flex items-center gap-1"><ChevronsUp className="w-3 h-3 text-green-500"/> {player.wins}W</span>
          <span className="flex items-center gap-1"><ChevronsDown className="w-3 h-3 text-red-500"/> {player.losses}L</span>
        </div>
      </div>
       
      {!disabled && !revealed && (
        <div className="absolute bottom-8 px-6 py-2 bg-slate-700 rounded-full text-slate-300 text-sm font-medium group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          Select Winner
        </div>
      )}
    </button>
  );
};

/**
 * --- MAIN APP ---
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('vote'); // 'vote', 'leaderboard'
  
  // Voting State
  const [currentMatch, setCurrentMatch] = useState([null, null]);
  const [matchResult, setMatchResult] = useState(null); 
  const [isAnimating, setIsAnimating] = useState(false);

  // Leaderboard Auth State
  const [isLeaderboardUnlocked, setIsLeaderboardUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // 1. Auth Setup
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
           await signInWithCustomToken(auth, __initial_auth_token);
        } catch(e) {
           await signInAnonymously(auth);
        }
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!user) return;
    const dataRef = getCollectionRef();
    const unsubscribe = onSnapshot(dataRef, async (snapshot) => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        INITIAL_ROSTER.forEach((p) => {
          const newDocRef = doc(dataRef);
          batch.set(newDocRef, {
            name: p.name, elo: STARTING_ELO, wins: 0, losses: 0, matches: 0, id: newDocRef.id
          });
        });
        await batch.commit();
      } else {
        const loadedPlayers = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        setPlayers(loadedPlayers);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Matchmaking
  const getNextMatch = useCallback(() => {
    if (players.length < 2) return;
    const idx1 = Math.floor(Math.random() * players.length);
    let idx2 = Math.floor(Math.random() * players.length);
    while (idx1 === idx2) idx2 = Math.floor(Math.random() * players.length);
    setCurrentMatch([players[idx1], players[idx2]]);
    setMatchResult(null);
    setIsAnimating(false);
  }, [players]);

  useEffect(() => {
    if (!loading && players.length >= 2 && !currentMatch[0] && view === 'vote') {
      getNextMatch();
    }
  }, [loading, players, currentMatch, view, getNextMatch]);

  // 4. Voting Logic
  const handleVote = async (winner, loser) => {
    if (isAnimating || !user) return;
    setIsAnimating(true);
    const { newWinnerElo, newLoserElo, winnerDelta, loserDelta } = calculateNewRatings(winner.elo, loser.elo);

    setMatchResult({
      winnerId: winner.id,
      loserId: loser.id,
      winnerDelta,
      loserDelta,
      tempWinnerElo: newWinnerElo, 
      tempLoserElo: newLoserElo,
      tempWinnerWins: winner.wins + 1,
      tempLoserLosses: loser.losses + 1
    });

    const dataRef = getCollectionRef();
    const batch = writeBatch(db);
    batch.update(doc(dataRef, winner.id), { elo: newWinnerElo, wins: increment(1), matches: increment(1) });
    batch.update(doc(dataRef, loser.id), { elo: newLoserElo, losses: increment(1), matches: increment(1) });
    batch.commit().catch(console.error);

    setTimeout(() => {
      getNextMatch();
    }, 1500);
  };

  // 5. Auth Logic
  const checkPassword = (e) => {
    e.preventDefault();
    if (passwordInput === LEADERBOARD_PASSWORD) {
        setIsLeaderboardUnlocked(true);
        setAuthError(false);
    } else {
        setAuthError(true);
        setPasswordInput('');
    }
  }

  // --- RENDERERS ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  const renderLeaderboard = () => {
    // PASSWORD PROTECTION CHECK
    if (!isLeaderboardUnlocked) {
        return (
            <div className="max-w-md mx-auto w-full animate-fade-in mt-20">
                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-2xl flex flex-col items-center text-center">
                    <div className="bg-slate-900 p-4 rounded-full mb-6 border border-slate-700">
                        <Lock className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Restricted Access</h2>
                    <p className="text-slate-400 mb-6">Enter the password to view the rankings.</p>
                    
                    <form onSubmit={checkPassword} className="w-full relative">
                        <input 
                            type="password" 
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            autoFocus
                        />
                        <button 
                            type="submit"
                            className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-md transition-colors"
                        >
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                    {authError && (
                        <p className="text-red-400 text-sm mt-4 animate-pulse">Incorrect password</p>
                    )}
                </div>
            </div>
        )
    }

    // ACTUAL LEADERBOARD (Shown if unlocked)
    const sorted = [...players].sort((a, b) => b.elo - a.elo);
    
    return (
      <div className="max-w-4xl mx-auto w-full animate-fade-in">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="text-yellow-400" /> Leaderboard
            </h2>
            <button 
                onClick={() => setIsLeaderboardUnlocked(false)}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
                <Lock className="w-3 h-3" /> Lock
            </button>
        </div>
        
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Rank</th>
                  <th className="p-4">Player</th>
                  <th className="p-4 text-center">Tier</th>
                  <th className="p-4 text-right">ELO</th>
                  <th className="p-4 text-right hidden sm:table-cell">W/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sorted.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4 text-slate-500 font-mono">#{i + 1}</td>
                    <td className="p-4 font-medium text-white">{p.name}</td>
                    <td className="p-4 flex justify-center">
                      <TierBadge elo={p.elo} />
                    </td>
                    <td className="p-4 text-right font-mono text-indigo-300 font-bold">{p.elo}</td>
                    <td className="p-4 text-right text-slate-400 text-sm hidden sm:table-cell">
                      {p.wins} - {p.losses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderVote = () => {
    if (!currentMatch[0] || !currentMatch[1]) return null;

    const [p1, p2] = currentMatch;
    const isRevealed = Boolean(matchResult);
    
    // We don't update the displayed player stats visually to hide ELO
    // We only pass the delta to the card
    const p1Delta = isRevealed ? (matchResult.winnerId === p1.id ? matchResult.winnerDelta : matchResult.loserDelta) : undefined;
    const p2Delta = isRevealed ? (matchResult.winnerId === p2.id ? matchResult.winnerDelta : matchResult.loserDelta) : undefined;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in w-full">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 w-full max-w-5xl justify-center relative">
           
          <PlayerCard 
            player={p1} 
            onClick={() => handleVote(p1, p2)} 
            disabled={isAnimating}
            resultDelta={p1Delta}
            revealed={isRevealed}
          />
           
          <div className="flex flex-col items-center gap-2 z-10">
            <div className={`rounded-full p-4 border-4 shadow-xl transition-colors duration-300
              ${isRevealed ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800'}
            `}>
              <Swords className="w-8 h-8 text-slate-400" />
            </div>
            <span className="text-slate-500 font-bold tracking-widest text-sm">VS</span>
          </div>
           
          <PlayerCard 
            player={p2} 
            onClick={() => handleVote(p2, p1)} 
            disabled={isAnimating}
            resultDelta={p2Delta}
            revealed={isRevealed}
          />

        </div>
        
        <div className="mt-12 text-center h-8">
           {isRevealed ? (
             <span className="text-indigo-400 font-bold animate-pulse">Updating Rankings...</span>
           ) : (
             <span className="text-slate-500 text-sm">Stats hidden until you vote</span>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
       
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-2xl tracking-tighter text-indigo-500 cursor-pointer" onClick={() => setView('vote')}>
            <BarChart3 className="w-8 h-8" />
            RANKR
          </div>
           
          <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
            <button 
              onClick={() => setView('vote')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'vote' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Vote
            </button>
            <button 
              onClick={() => setView('leaderboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'leaderboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              {!isLeaderboardUnlocked && <Lock className="w-3 h-3" />}
              Leaderboard
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center w-full">
        {view === 'vote' && renderVote()}
        {view === 'leaderboard' && renderLeaderboard()}
      </main>
       
      {/* Footer */}
      <footer className="w-full text-center py-6 text-slate-600 text-sm">
        <p>Uses standard ELO rating system (K={K_FACTOR})</p>
      </footer>
    </div>
  );
}
