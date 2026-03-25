

const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const BASE_URL = "https://api.cricapi.com/v1";

// ══════════════════════════════════════════════════════════
// GET /api/match/live  — ALL matches (LIVE + UPCOMING + IPL)
// ══════════════════════════════════════════════════════════
router.get('/live', async (req, res) => {
  try {
    // 🔥 2 APIs call karo
    const [liveRes, upcomingRes] = await Promise.all([
      axios.get(`${BASE_URL}/currentMatches`, {
        params: { apikey: process.env.CRIC_API_KEY }
      }),
      axios.get(`${BASE_URL}/matches`, {
        params: { apikey: process.env.CRIC_API_KEY }
      })
    ]);

    const liveMatches = liveRes?.data?.data || [];
    const upcomingMatches = upcomingRes?.data?.data || [];

    // 🔥 combine both
    let matches = [...liveMatches, ...upcomingMatches];

    // 🔥 IPL FILTER (optional - remove if ALL matches chahiye)
    // matches = matches.filter(m =>
    //   m?.name?.toLowerCase().includes("ipl")
    // );

    // 🔥 FORMAT DATA
    const formattedMatches = matches.map(m => ({
      matchId: m?.id,

      team1: {
        name: m?.teams?.[0] || "TBD",
        shortName: m?.teams?.[0]?.slice(0, 3) || "",
        logo: "",
      },

      team2: {
        name: m?.teams?.[1] || "TBD",
        shortName: m?.teams?.[1]?.slice(0, 3) || "",
        logo: "",
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

      team1: {
        name: m?.teams?.[0] || "TBD",
      },

      team2: {
        name: m?.teams?.[1] || "TBD",
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
