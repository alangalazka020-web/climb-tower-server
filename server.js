const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// Gracz jest uznawany za "aktywnego" przez tyle milisekund
// od ostatniego heartbeatu.
const HEARTBEAT_TIMEOUT_MS = 15000;

// nickname -> timestamp ostatniego heartbeatu
const lastSeen = new Map();

// nickname -> Set nickname'ow znajomych (przyjazn jest wzajemna)
const friendships = new Map();

// "nickA|nickB" (posortowane alfabetycznie) -> tablica wiadomosci
const conversations = new Map();

function getConversationKey(a, b) {
	return [a, b].sort().join("|");
}

function ensureFriendSet(nickname) {
	if (!friendships.has(nickname)) {
		friendships.set(nickname, new Set());
	}
	return friendships.get(nickname);
}

function isOnline(nickname) {
	const ts = lastSeen.get(nickname);
	if (!ts) return false;
	return (Date.now() - ts) <= HEARTBEAT_TIMEOUT_MS;
}

// ============================================================
// HEARTBEAT / LICZBA GRACZY ONLINE
// ============================================================

app.post("/heartbeat", (req, res) => {
	const nickname = req.body.nickname;

	if (!nickname) {
		return res.status(400).json({ error: "missing nickname" });
	}

	lastSeen.set(nickname, Date.now());
	res.json({ ok: true });
});

app.get("/count", (req, res) => {
	const now = Date.now();
	let active = 0;

	for (const [nick, ts] of lastSeen) {
		if (now - ts <= HEARTBEAT_TIMEOUT_MS) {
			active++;
		}
	}

	res.json({ active: active });
});

// ============================================================
// ZNAJOMI
// ============================================================

app.post("/add-friend", (req, res) => {
	const nickname = req.body.nickname;
	const friendNickname = req.body.friendNickname;

	if (!nickname || !friendNickname) {
		return res.status(400).json({ error: "missing nickname" });
	}

	if (nickname === friendNickname) {
		return res.status(400).json({ error: "cannot add yourself" });
	}

	ensureFriendSet(nickname).add(friendNickname);
	ensureFriendSet(friendNickname).add(nickname);

	res.json({ ok: true });
});

app.get("/friends", (req, res) => {
	const nickname = req.query.nickname;

	if (!nickname) {
		return res.status(400).json({ error: "missing nickname" });
	}

	const friendSet = ensureFriendSet(nickname);
	const list = [];

	for (const friendNickname of friendSet) {
		list.push({
			nickname: friendNickname,
			online: isOnline(friendNickname)
		});
	}

	res.json({ friends: list });
});

// ============================================================
// WIADOMOSCI (TYLKO MIEDZY ZNAJOMYMI)
// ============================================================

app.post("/send-message", (req, res) => {
	const nickname = req.body.nickname;
	const toNickname = req.body.toNickname;
	const text = req.body.text;

	if (!nickname || !toNickname || !text) {
		return res.status(400).json({ error: "missing fields" });
	}

	const friendSet = ensureFriendSet(nickname);

	if (!friendSet.has(toNickname)) {
		return res.status(403).json({ error: "not friends" });
	}

	const key = getConversationKey(nickname, toNickname);

	if (!conversations.has(key)) {
		conversations.set(key, []);
	}

	const log = conversations.get(key);

	log.push({
		from: nickname,
		text: String(text).substring(0, 300),
		timestamp: Date.now()
	});

	while (log.length > 100) {
		log.shift();
	}

	res.json({ ok: true });
});

app.get("/messages", (req, res) => {
	const nickname = req.query.nickname;
	const withNickname = req.query.with;

	if (!nickname || !withNickname) {
		return res.status(400).json({ error: "missing fields" });
	}

	const key = getConversationKey(nickname, withNickname);
	const log = conversations.get(key) || [];

	res.json({ messages: log });
});

app.get("/", (req, res) => {
	res.send("Climb Tower - serwer graczy / znajomych / czatu dziala.");
});

const listener = app.listen(process.env.PORT || 3000, () => {
	console.log("Serwer dziala na porcie " + listener.address().port);
});
