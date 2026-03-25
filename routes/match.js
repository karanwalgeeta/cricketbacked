
const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const BASE_URL = "https://api.cricapi.com/v1";

// 🔹 IPL & PSL series IDs (replace with correct IDs from your API)
const IPL_SERIES_ID = "1234"; // Example: IPL
const PSL_SERIES_ID = "5678"; // Example: PSL

// ══════════════════════════════════════════════════════════
// GET /api/match/live — LIVE + UPCOMING matches for IPL & PSL
// ══════════════════════════════════════════════════════════
router.get('/live', async (req, res) => {
  try {
    // 🔥 fetch live & upcoming matches for IPL + PSL
    const [liveIPL, upcomingIPL, livePSL, upcomingPSL] = await Promise.all([
      axios.get(`${BASE_URL}/matches`, { params: { apikey: process.env.CRIC_API_KEY, series_id: IPL_SERIES_ID, status: 'live' } }),
      axios.get(`${BASE_URL}/matches`, { params: { apikey: process.env.CRIC_API_KEY, series_id: IPL_SERIES_ID, status: 'upcoming' } }),
      axios.get(`${BASE_URL}/matches`, { params: { apikey: process.env.CRIC_API_KEY, series_id: PSL_SERIES_ID, status: 'live' } }),
      axios.get(`${BASE_URL}/matches`, { params: { apikey: process.env.CRIC_API_KEY, series_id: PSL_SERIES_ID, status: 'upcoming' } }),
    ]);

    // combine all matches
    let matches = [
      ...liveIPL.data.data, 
      ...upcomingIPL.data.data, 
      ...livePSL.data.data, 
      ...upcomingPSL.data.data
    ];

    // format matches
    const formattedMatches = matches.map(m => ({
      matchId: m?.id,
      series: m?.series?.name || "Unknown",

      team1: {
        name: m?.teams?.[0]?.name || "TBD",
        shortName: m?.teams?.[0]?.name?.slice(0, 3) || "",
        logo: m?.teams?.[0]?.logo || "",
      },

      team2: {
        name: m?.teams?.[1]?.name || "TBD",
        shortName: m?.teams?.[1]?.name?.slice(0, 3) || "",
        logo: m?.teams?.[1]?.logo || "",
      },

      venue: m?.venue || "Unknown",
      date: m?.dateTimeGMT,

      status:
        m?.status === "completed"
          ? "completed"
          : m?.status === "live"
          ? "live"
          : "upcoming",
    }));

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

    const match = {
      matchId: m?.id,
      series: m?.series?.name || "Unknown",

      team1: {
        name: m?.teams?.[0]?.name || "TBD",
        logo: m?.teams?.[0]?.logo || "",
      },

      team2: {
        name: m?.teams?.[1]?.name || "TBD",
        logo: m?.teams?.[1]?.logo || "",
      },

      venue: m?.venue || "Unknown",
      date: m?.dateTimeGMT,
      status: m?.status,
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
