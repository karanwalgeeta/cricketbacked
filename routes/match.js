
// routes/match.js - Updated Version
const express = require('express');
const router = express.Router();
const axios = require('axios');

const BASE_URL = "https://api.cricapi.com/v1";

// Helper: Detect tournament from series name
function detectTournament(seriesName) {
  const name = (seriesName || '').toLowerCase();
  if (name.includes('ipl') || name.includes('indian premier league')) return 'IPL';
  if (name.includes('psl') || name.includes('pakistan super league')) return 'PSL';
  return 'Other';
}

// Helper: Get team short name
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

// ══════════════════════════════════════════════════════════
// GET /api/match/live — ALL matches (with IPL/PSL detection)
// ══════════════════════════════════════════════════════════
router.get('/live', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/matches`, {
      params: { 
        apikey: process.env.CRIC_API_KEY,
        offset: 0,
        limit: 100
      }
    });

    let matches = response?.data?.data || [];

    // Filter for IPL & PSL only
    const filteredMatches = matches.filter(m => {
      const seriesName = m?.series?.name || m?.name || '';
      return seriesName.toLowerCase().includes('ipl') || 
             seriesName.toLowerCase().includes('psl');
    });

    const formattedMatches = filteredMatches.map(m => {
      // Parse teams properly
      let team1Name = "TBD", team2Name = "TBD";
      if (m?.teams && Array.isArray(m.teams)) {
        team1Name = typeof m.teams[0] === 'string' ? m.teams[0] : (m.teams[0]?.name || "TBD");
        team2Name = typeof m.teams[1] === 'string' ? m.teams[1] : (m.teams[1]?.name || "TBD");
      }

      const seriesName = m?.series?.name || m?.name || '';
      
      return {
        matchId: m?.id,
        series: seriesName,
        tournament: detectTournament(seriesName), // ← Important for frontend filter
        team1: {
          name: team1Name,
          shortName: getShortName(team1Name),
          logo: "",
          score: m?.score?.find(s => s?.name === team1Name)?.score || null,
          overs: m?.score?.find(s => s?.name === team1Name)?.overs || null,
        },
        team2: {
          name: team2Name,
          shortName: getShortName(team2Name),
          logo: "",
          score: m?.score?.find(s => s?.name === team2Name)?.score || null,
          overs: m?.score?.find(s => s?.name === team2Name)?.overs || null,
        },
        venue: m?.venue || "TBA",
        date: m?.dateTimeGMT || m?.date,
        status: getMatchStatus(m),
        result: m?.result || null,
      };
    });

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

// Helper: Get match status
function getMatchStatus(m) {
  if (m?.status === 'completed' || m?.status === 'finished') return 'completed';
  if (m?.status === 'live' || m?.status === 'inprogress') return 'live';
  if (m?.status === 'cancelled') return 'cancelled';
  return 'upcoming';
}

// ══════════════════════════════════════════════════════════
// GET /api/match/:matchId — single match detail
// ══════════════════════════════════════════════════════════
router.get('/:matchId', async (req, res) => {
  try {
    const matchId = req.params.matchId;
    if (!matchId || matchId === "undefined") {
      return res.status(400).json({ success: false, message: "Invalid matchId" });
    }

    const response = await axios.get(`${BASE_URL}/match_info`, {
      params: { apikey: process.env.CRIC_API_KEY, id: matchId }
    });

    const m = response?.data?.data;
    if (!m) {
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    let team1Name = "TBD", team2Name = "TBD";
    if (m?.teams && Array.isArray(m.teams)) {
      team1Name = typeof m.teams[0] === 'string' ? m.teams[0] : (m.teams[0]?.name || "TBD");
      team2Name = typeof m.teams[1] === 'string' ? m.teams[1] : (m.teams[1]?.name || "TBD");
    }

    const seriesName = m?.series?.name || m?.name || '';
    
    res.json({
      success: true,
      match: {
        matchId: m?.id,
        series: seriesName,
        tournament: detectTournament(seriesName),
        team1: { name: team1Name, shortName: getShortName(team1Name), logo: "" },
        team2: { name: team2Name, shortName: getShortName(team2Name), logo: "" },
        venue: m?.venue || "Unknown",
        date: m?.dateTimeGMT || m?.date,
        status: m?.status,
        score: m?.score || null,
        toss: m?.toss || null,
        result: m?.result || null
      }
    });

  } catch (err) {
    console.error("🔥 MATCH DETAIL ERROR:", err.message);
    res.status(500).json({ success: false, message: "Error fetching match details" });
  }
});

module.exports = router;
