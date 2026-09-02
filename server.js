const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// Gracz jest uznawany za "aktywnego" przez tyle milisekund
// od ostatniego heartbeatu (jeśli przez ten czas się nie
// odezwie - liczymy że wyszedł z gry).
const HEARTBEAT_TIMEOUT_MS = 15000;

// sessionId -> timestamp ostatniego heartbeatu
const sessions = new Map();

// Gra wywołuje to co kilka sekund, żeby powiedzieć "wciąż gram"
app.post("/heartbeat", (req, res) => {
	const sessionId = req.body.sessionId;

	if (!sessionId) {
		return res.status(400).json({ error: "missing sessionId" });
	}

	sessions.set(sessionId, Date.now());
	res.json({ ok: true });
});

// Gra wywołuje to, żeby dowiedzieć się ile osób gra teraz
app.get("/count", (req, res) => {
	const now = Date.now();
	let active = 0;

	for (const [id, ts] of sessions) {
		if (now - ts <= HEARTBEAT_TIMEOUT_MS) {
			active++;
		} else {
			sessions.delete(id);
		}
	}

	res.json({ active: active });
});

app.get("/", (req, res) => {
	res.send("Climb Tower - serwer licznika graczy działa.");
});

const listener = app.listen(process.env.PORT || 3000, () => {
	console.log("Serwer działa na porcie " + listener.address().port);
});
