const express = require('express');
const router = express.Router();
const axios = require('axios');

const BASE_URL = "https://api.cricapi.com/v1";

// ══════════════════════════════════════════════════════════
// GET /api/match/live — ALL matches (IPL + PSL + others)
// ══════════════════════════════════════════════════════════
router.get('/live', async (req, res) => {
  try {
    // 🔥 Single API call to get all matches (live + upcoming)
    const response = await axios.get(`${BASE_URL}/matches`, {
      params: { 
        apikey: process.env.CRIC_API_KEY,
        offset: 0,
        limit: 100  // Max matches
      }
    });

    let matches = response?.data?.data || [];

    // 🏏 IPL & PSL Filter (case-insensitive)
    const iplPslMatches = matches.filter(m => {
      const seriesName = m?.series?.name || m?.name || '';
      return seriesName.toLowerCase().includes('ipl') || 
             seriesName.toLowerCase().includes('psl') ||
             seriesName.toLowerCase().includes('indian premier league') ||
             seriesName.toLowerCase().includes('pakistan super league');
    });

    // 🎯 Format matches properly
    const formattedMatches = iplPslMatches.map(m => {
      // Handle team names properly
      let team1Name = "TBD", team2Name = "TBD";
      
      if (m?.teams && Array.isArray(m.teams)) {
        if (m.teams[0]) {
          // Team can be string or object
          team1Name = typeof m.teams[0] === 'string' ? m.teams[0] : (m.teams[0]?.name || m.teams[0] || "TBD");
        }
        if (m.teams[1]) {
          team2Name = typeof m.teams[1] === 'string' ? m.teams[1] : (m.teams[1]?.name || m.teams[1] || "TBD");
        }
      }

      return {
        matchId: m?.id,
        series: m?.series?.name || m?.name || "IPL/PSL Match",
        team1: {
          name: team1Name,
          shortName: getShortName(team1Name),
          logo: `https://example.com/logos/${team1Name.toLowerCase().replace(/ /g, '-')}.png` // Placeholder
        },
        team2: {
          name: team2Name,
          shortName: getShortName(team2Name),
          logo: `https://example.com/logos/${team2Name.toLowerCase().replace(/ /g, '-')}.png`
        },
        venue: m?.venue || "TBA",
        date: m?.dateTimeGMT || m?.date,
        status: getMatchStatus(m)
      };
    });

    res.json({
      success: true,
      total: formattedMatches.length,
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

// Helper: Get short name for team
function getShortName(teamName) {
  const shortNames = {
    'Mumbai Indians': 'MI',
    'Chennai Super Kings': 'CSK',
    'Royal Challengers Bangalore': 'RCB',
    'Kolkata Knight Riders': 'KKR',
    'Delhi Capitals': 'DC',
    'Rajasthan Royals': 'RR',
    'Punjab Kings': 'PBKS',
    'Sunrisers Hyderabad': 'SRH',
    'Gujarat Titans': 'GT',
    'Lucknow Super Giants': 'LSG',
    'Islamabad United': 'IU',
    'Karachi Kings': 'KK',
    'Lahore Qalandars': 'LQ',
    'Multan Sultans': 'MS',
    'Peshawar Zalmi': 'PZ',
    'Quetta Gladiators': 'QG'
  };
  
  return shortNames[teamName] || teamName?.slice(0, 3).toUpperCase() || "TBD";
}

// Helper: Get match status
function getMatchStatus(m) {
  if (m?.status === 'completed' || m?.status === 'finished') return 'completed';
  if (m?.status === 'live' || m?.status === 'inprogress') return 'live';
  if (m?.status === 'cancelled') return 'cancelled';
  return 'upcoming';
}

// ══════════════════════════════════════════════════════════
// GET /api/match/live-all — ALL matches (no filter)
// ══════════════════════════════════════════════════════════
router.get('/live-all', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/matches`, {
      params: { apikey: process.env.CRIC_API_KEY }
    });

    const matches = response?.data?.data || [];
    
    const formattedMatches = matches.map(m => ({
      matchId: m?.id,
      series: m?.series?.name || m?.name || "Unknown",
      team1: {
        name: m?.teams?.[0]?.name || m?.teams?.[0] || "TBD",
        shortName: getShortName(m?.teams?.[0]?.name || m?.teams?.[0])
      },
      team2: {
        name: m?.teams?.[1]?.name || m?.teams?.[1] || "TBD",
        shortName: getShortName(m?.teams?.[1]?.name || m?.teams?.[1])
      },
      venue: m?.venue || "TBA",
      date: m?.dateTimeGMT || m?.date,
      status: getMatchStatus(m)
    }));

    res.json({
      success: true,
      total: formattedMatches.length,
      matches: formattedMatches
    });

  } catch (err) {
    console.error("🔥 MATCH ERROR:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch matches"
    });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/match/:matchId — single match detail
// ══════════════════════════════════════════════════════════
router.get('/:matchId', async (req, res) => {
  try {
    const matchId = req.params.matchId;

    if (!matchId || matchId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Invalid matchId"
      });
    }

    const response = await axios.get(`${BASE_URL}/match_info`, {
      params: {
        apikey: process.env.CRIC_API_KEY,
        id: matchId
      }
    });

    const m = response?.data?.data;

    if (!m) {
      return res.status(404).json({
        success: false,
        message: "Match not found"
      });
    }

    // Parse teams properly
    let team1Name = "TBD", team2Name = "TBD";
    if (m?.teams && Array.isArray(m.teams)) {
      team1Name = typeof m.teams[0] === 'string' ? m.teams[0] : (m.teams[0]?.name || "TBD");
      team2Name = typeof m.teams[1] === 'string' ? m.teams[1] : (m.teams[1]?.name || "TBD");
    }

    const match = {
      matchId: m?.id,
      series: m?.series?.name || m?.name || "Unknown",
      team1: {
        name: team1Name,
        shortName: getShortName(team1Name),
        logo: m?.teams?.[0]?.logo || ""
      },
      team2: {
        name: team2Name,
        shortName: getShortName(team2Name),
        logo: m?.teams?.[1]?.logo || ""
      },
      venue: m?.venue || "Unknown",
      date: m?.dateTimeGMT || m?.date,
      status: m?.status,
      score: m?.score || null,
      toss: m?.toss || null,
      result: m?.result || null
    };

    res.json({
      success: true,
      match
    });

  } catch (err) {
    console.error("🔥 MATCH DETAIL ERROR:", err.message);
    res.status(500).json({
      success: false,
      message: "Error fetching match details"
    });
  }
});

module.exports = router;
