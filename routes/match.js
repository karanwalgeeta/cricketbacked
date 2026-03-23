const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const BASE_URL = "https://api.cricapi.com/v1";

// 🔹 IPL & PSL series IDs (replace with correct IDs from your API)
const IPL_SERIES_ID = "1234"; // Example: IPL
const PSL_SERIES_ID = "5678"; // Example: PSL

// ══════════════════════════════════════════════════════════
// GET /api/match/live — LIVE + UPCOMING matches for IPL & PSL
router.get('/live', async (req, res) => {
  try {
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
    const formattedMatches = matches.map(m => {
      const team1Name = m?.teams?.[0]?.name || "TBD";
      const team2Name = m?.teams?.[1]?.name || "TBD";
      const seriesName = m?.series?.name || "Unknown";

      return {
        matchId: m?.id,
        tournament: seriesName.toUpperCase() === 'IPL' ? 'IPL' : seriesName.toUpperCase() === 'PSL' ? 'PSL' : 'Other', // frontend filter ke liye
        series: seriesName,

        team1: {
          name: team1Name,
          shortName: team1Name.slice(0, 3),
          logo: m?.teams?.[0]?.logo || "",
        },

        team2: {
          name: team2Name,
          shortName: team2Name.slice(0, 3),
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
