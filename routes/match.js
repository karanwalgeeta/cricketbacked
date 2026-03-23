// const express = require('express');
// const router  = express.Router();

// // ─────────────────────────────────────────────────────────
// // MOCK IPL 2025 Match Data
// // In production: replace with a real cricket API
// // Recommended APIs: CricAPI, SportRadar, RapidAPI Cricket
// // ─────────────────────────────────────────────────────────
// const MOCK_MATCHES = [
//   {
//     matchId:  'ipl2025_m01',
//     team1: {
//       name:      'Chennai Super Kings',
//       shortName: 'CSK',
//       logo:      '🟡',
//       score:     '185/4',
//       wickets:   4,
//       overs:     '20.0',
//     },
//     team2: {
//       name:      'Mumbai Indians',
//       shortName: 'MI',
//       logo:      '🔵',
//       score:     '147/7',
//       wickets:   7,
//       overs:     '18.2',
//     },
//     venue:       'Wankhede Stadium, Mumbai',
//     date:        new Date().toISOString(),
//     status:      'live',
//     recentBalls: ['4', '1', 'W', '6', '0', '2'],
//     currentBatsmen: [
//       { name: 'Ruturaj Gaikwad', runs: 58, balls: 42, fours: 5, sixes: 2 },
//       { name: 'Shivam Dube',     runs: 27, balls: 16, fours: 2, sixes: 2 },
//     ],
//     currentBowler: {
//       name:    'Jasprit Bumrah',
//       overs:   '3.2',
//       wickets: 2,
//       runs:    26,
//     },
//     tossWinner:   'CSK',
//     tossDecision: 'bat',
//     topBatsmen: [
//       { name: 'Rohit Sharma',    team: 'MI',  runs: 64, balls: 46 },
//       { name: 'Ruturaj Gaikwad', team: 'CSK', runs: 58, balls: 42 },
//     ],
//     topBowlers: [
//       { name: 'Jasprit Bumrah', team: 'MI',  wickets: 2, runs: 26, overs: '3.2' },
//       { name: 'Deepak Chahar',  team: 'CSK', wickets: 3, runs: 30, overs: '4.0' },
//     ],
//   },
//   {
//     matchId:  'ipl2025_m02',
//     team1: {
//       name:      'Royal Challengers Bengaluru',
//       shortName: 'RCB',
//       logo:      '🔴',
//       score:     '',
//       wickets:   0,
//       overs:     '0.0',
//     },
//     team2: {
//       name:      'Kolkata Knight Riders',
//       shortName: 'KKR',
//       logo:      '🟣',
//       score:     '',
//       wickets:   0,
//       overs:     '0.0',
//     },
//     venue:       'M. Chinnaswamy Stadium, Bengaluru',
//     date:        new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
//     status:      'upcoming',
//     recentBalls: [],
//     currentBatsmen: [],
//     topBatsmen:  [],
//     topBowlers:  [],
//   },
//   {
//     matchId:  'ipl2025_m03',
//     team1: {
//       name:      'Delhi Capitals',
//       shortName: 'DC',
//       logo:      '🔵',
//       score:     '172/6',
//       wickets:   6,
//       overs:     '20.0',
//     },
//     team2: {
//       name:      'Punjab Kings',
//       shortName: 'PBKS',
//       logo:      '🔴',
//       score:     '',
//       wickets:   0,
//       overs:     '0.0',
//     },
//     venue:       'Arun Jaitley Stadium, Delhi',
//     date:        new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
//     status:      'upcoming',
//     recentBalls: [],
//     currentBatsmen: [],
//     topBatsmen:  [],
//     topBowlers:  [],
//   },
//   {
//     matchId:  'ipl2025_m04',
//     team1: {
//       name:      'Rajasthan Royals',
//       shortName: 'RR',
//       logo:      '🩷',
//       score:     '210/4',
//       wickets:   4,
//       overs:     '20.0',
//     },
//     team2: {
//       name:      'Sunrisers Hyderabad',
//       shortName: 'SRH',
//       logo:      '🟠',
//       score:     '198/8',
//       wickets:   8,
//       overs:     '20.0',
//     },
//     venue:          'Sawai Mansingh Stadium, Jaipur',
//     date:           new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
//     status:         'completed',
//     result:         'Rajasthan Royals won by 12 runs',
//     winnerShortName:'RR',
//     recentBalls:    [],
//     currentBatsmen: [],
//     topBatsmen: [
//       { name: 'Jos Buttler',     team: 'RR',  runs: 89, balls: 55 },
//       { name: 'Abhishek Sharma', team: 'SRH', runs: 76, balls: 48 },
//     ],
//     topBowlers: [
//       { name: 'Trent Boult', team: 'RR',  wickets: 3, runs: 28, overs: '4.0' },
//       { name: 'Pat Cummins', team: 'SRH', wickets: 2, runs: 38, overs: '4.0' },
//     ],
//   },
//   {
//     matchId:  'ipl2025_m05',
//     team1: {
//       name:      'Gujarat Titans',
//       shortName: 'GT',
//       logo:      '🔵',
//       score:     '',
//       wickets:   0,
//       overs:     '0.0',
//     },
//     team2: {
//       name:      'Lucknow Super Giants',
//       shortName: 'LSG',
//       logo:      '🩵',
//       score:     '',
//       wickets:   0,
//       overs:     '0.0',
//     },
//     venue:       'Narendra Modi Stadium, Ahmedabad',
//     date:        new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
//     status:      'upcoming',
//     recentBalls: [],
//     currentBatsmen: [],
//     topBatsmen:  [],
//     topBowlers:  [],
//   },
// ];

// // ══════════════════════════════════════════════════════════
// // GET /api/match/live  — all matches (live + upcoming + recent)
// // ══════════════════════════════════════════════════════════
// router.get('/live', (_req, res) => {
//   res.json({ success: true, matches: MOCK_MATCHES });
// });

// // ══════════════════════════════════════════════════════════
// // GET /api/match/:matchId  — single match
// // ══════════════════════════════════════════════════════════
// router.get('/:matchId', (req, res) => {
//   const match = MOCK_MATCHES.find(m => m.matchId === req.params.matchId);
//   if (!match) {
//     return res.status(404).json({ success: false, message: 'Match not found' });
//   }
//   res.json({ success: true, match });
// });

// module.exports = router;






const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const BASE_URL = "https://api.sportmonks.com/v3/cricket";


// ══════════════════════════════════════════════════════════
// GET /api/match/live  — IPL matches only
// ══════════════════════════════════════════════════════════
router.get('/live', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/fixtures`, {
      params: {
        api_token: process.env.SPORTMONKS_API_KEY,
        include: "localteam,visitorteam,venue,league"
      }
    });

    let matches = response?.data?.data || [];

    // 🔥 IPL FILTER SAFE
    matches = matches.filter(m =>
      m?.league?.name?.toLowerCase().includes("ipl")
    );

    const formattedMatches = matches.map(m => ({
      matchId: m?.id,

      team1: {
        name: m?.localteam?.name || "TBD",
        shortName: m?.localteam?.code || "",
        logo: m?.localteam?.image_path || "",
      },

      team2: {
        name: m?.visitorteam?.name || "TBD",
        shortName: m?.visitorteam?.code || "",
        logo: m?.visitorteam?.image_path || "",
      },

      venue: m?.venue?.name || "Unknown",
      date: m?.starting_at,

      status:
        m?.status === "Finished"
          ? "completed"
          : m?.status === "Live"
          ? "live"
          : "upcoming",
    }));

    res.json({
      success: true,
      matches: formattedMatches
    });

  } catch (err) {
    console.error("🔥 MATCH ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: err.response?.data?.message || "Failed to fetch matches"
    });
  }
});


// ══════════════════════════════════════════════════════════
// GET /api/match/:matchId — single match detail
// ══════════════════════════════════════════════════════════
router.get('/:matchId', async (req, res) => {
  try {
    const matchId = req.params.matchId;

    console.log("👉 MATCH ID:", matchId);

    // ❌ undefined / null check
    if (!matchId || matchId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Invalid matchId"
      });
    }

    const response = await axios.get(
      `${BASE_URL}/fixtures/${matchId}`,
      {
        params: {
          api_token: process.env.SPORTMONKS_API_KEY,
          include: "localteam,visitorteam,venue,league,runs"
        }
      }
    );

    const m = response?.data?.data;

    // ❌ match not found
    if (!m) {
      return res.status(404).json({
        success: false,
        message: "Match not found"
      });
    }

    const match = {
      matchId: m?.id,

      team1: {
        name: m?.localteam?.name || "TBD",
        shortName: m?.localteam?.code || "",
        logo: m?.localteam?.image_path || "",
      },

      team2: {
        name: m?.visitorteam?.name || "TBD",
        shortName: m?.visitorteam?.code || "",
        logo: m?.visitorteam?.image_path || "",
      },

      venue: m?.venue?.name || "Unknown",
      date: m?.starting_at,

      status:
        m?.status === "Finished"
          ? "completed"
          : m?.status === "Live"
          ? "live"
          : "upcoming",

      runs: m?.runs || [],
    };

    res.json({
      success: true,
      match
    });

  } catch (err) {
    console.error("🔥 MATCH DETAIL ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: err.response?.data?.message || "Error fetching match"
    });
  }
});

module.exports = router;
