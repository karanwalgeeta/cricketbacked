
const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const BASE_URL = "https://api.cricapi.com/v1";
const API_KEY  = process.env.CRIC_API_KEY;

// ══════════════════════════════════════════════════════════
// CACHE — 2 minute server-side cache (API rate limit bachao)
// ══════════════════════════════════════════════════════════
let cache = {
  data:      null,
  fetchedAt: null,
};
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const isCacheValid = () =>
  cache.data && cache.fetchedAt && (Date.now() - cache.fetchedAt < CACHE_TTL);

// ══════════════════════════════════════════════════════════
// HELPER — tournament detect karo
// ══════════════════════════════════════════════════════════
const detectTournament = (m) => {
  const name     = (m?.name   || '').toLowerCase();
  const series   = (m?.series || '').toLowerCase();
  const combined = name + ' ' + series;

  if (combined.includes('ipl') || combined.includes('indian premier league')) return 'IPL';
  if (combined.includes('psl') || combined.includes('pakistan super league')) return 'PSL';
  return 'Other';
};

// ══════════════════════════════════════════════════════════
// HELPER — status normalize
// ══════════════════════════════════════════════════════════
const getStatus = (m) => {
  const s = (m?.status || '').toLowerCase();
  if (s === 'live' || (m?.matchStarted === true && m?.matchEnded === false)) return 'live';
  if (s === 'completed' || m?.matchEnded === true) return 'completed';
  return 'upcoming';
};

// ══════════════════════════════════════════════════════════
// HELPER — score extract karo from scorecard
// ══════════════════════════════════════════════════════════
const getScore = (m, teamIndex) => {
  const scores   = m?.score || [];
  const teamName = (m?.teams?.[teamIndex] || '').toLowerCase();
  const inning   = scores.find(s => s?.inning?.toLowerCase().includes(teamName));
  if (!inning) return '';
  return `${inning.r}/${inning.w}`;
};

const getOvers = (m, teamIndex) => {
  const scores   = m?.score || [];
  const teamName = (m?.teams?.[teamIndex] || '').toLowerCase();
  const inning   = scores.find(s => s?.inning?.toLowerCase().includes(teamName));
  if (!inning) return '';
  return inning.o || '';
};

// ══════════════════════════════════════════════════════════
// HELPER — format single match
// ══════════════════════════════════════════════════════════
const formatMatch = (m) => {
  const status     = getStatus(m);
  const tournament = detectTournament(m);

  return {
    matchId:    m?.id,
    name:       m?.name   || '',
    series:     m?.series || '',
    tournament,

    team1: {
      name:      m?.teams?.[0] || 'TBD',
      shortName: (m?.teams?.[0] || 'TBD').slice(0, 3).toUpperCase(),
      logo:      '',
      score:     getScore(m, 0),
      overs:     getOvers(m, 0),
    },

    team2: {
      name:      m?.teams?.[1] || 'TBD',
      shortName: (m?.teams?.[1] || 'TBD').slice(0, 3).toUpperCase(),
      logo:      '',
      score:     getScore(m, 1),
      overs:     getOvers(m, 1),
    },

    venue:  m?.venue       || 'Unknown',
    date:   m?.dateTimeGMT || '',
    status,
    result: status === 'completed' ? (m?.status || '') : '',

    recentBalls:    [],
    currentBatsmen: [],
  };
};

// ══════════════════════════════════════════════════════════
// GET /api/match/live  — ALL + UPCOMING + IPL + PSL
// ══════════════════════════════════════════════════════════
router.get('/live', async (req, res) => {
  try {

    // ✅ Cache hit — seedha return karo
    if (isCacheValid()) {
      console.log("✅ Serving from cache");
      return res.json(cache.data);
    }

    // Cache miss — CricAPI call karo
    const [currentRes, upcomingRes] = await Promise.all([
      axios.get(`${BASE_URL}/currentMatches`, { params: { apikey: API_KEY, offset: 0 } }),
      axios.get(`${BASE_URL}/matches`,        { params: { apikey: API_KEY, offset: 0 } }),
    ]);

    const currentMatches  = currentRes?.data?.data  || [];
    const upcomingMatches = upcomingRes?.data?.data  || [];

    // Combine + Deduplicate by id
    const seen = new Set();
    const unique = [...currentMatches, ...upcomingMatches].filter(m => {
      if (!m?.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    // Format
    const formatted = unique.map(formatMatch);

    // Debug stats
    const live     = formatted.filter(m => m.status === 'live').length;
    const upcoming = formatted.filter(m => m.status === 'upcoming').length;
    const ipl      = formatted.filter(m => m.tournament === 'IPL').length;
    const psl      = formatted.filter(m => m.tournament === 'PSL').length;

    console.log(`✅ Matches — total:${formatted.length} live:${live} upcoming:${upcoming} IPL:${ipl} PSL:${psl}`);

    const response = {
      success: true,
      total:   formatted.length,
      counts:  { live, upcoming, ipl, psl },
      matches: formatted,
    };

    // ✅ Cache mein save karo
    cache = { data: response, fetchedAt: Date.now() };

    res.json(response);

  } catch (err) {
    console.error("🔥 MATCH ERROR:", err.response?.data || err.message);

    // ✅ Error pe bhi old cache serve karo agar available ho
    if (cache.data) {
      console.log("⚠️ API failed, serving stale cache");
      return res.json({ ...cache.data, stale: true });
    }

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
    const { matchId } = req.params;

    if (!matchId || matchId === 'undefined') {
      return res.status(400).json({ success: false, message: 'Invalid matchId' });
    }

    const response = await axios.get(`${BASE_URL}/match_info`, {
      params: { apikey: API_KEY, id: matchId }
    });

    const m = response?.data?.data;

    if (!m) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    res.json({
      success: true,
      match: formatMatch(m)
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
