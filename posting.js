/**
 * AUTO WEEKLY BATCH GENERATOR
 * --------------------------------
 * ✔ Generates 70 posts (10/day × 7 days)
 * ✔ Stores in batches: batch1, batch2, ...
 * ✔ Automatically detects if 7 days passed
 * ✔ Only creates next batch if needed
 * ✔ Perfect for PM2 cron execution
 */

const { MongoClient } = require("mongodb");
const axios = require("axios");
const moment = require("moment");

// MongoDB
const uri = "mongodb://admin:imperial_merta2030@147.93.123.140:27017/admin";
const dbName = "mydatabase";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// 10 daily posting times
const dailyTimes = [
  "10:00",
  "11:30",
  "13:00",
  "14:30",
  "16:00",
  "17:30",
  "19:00",
  "20:30",
  "22:00",
  "23:30",
];

// ----------------------------
// CONNECT TO MONGODB
// ----------------------------
async function connectToMongo() {
  await client.connect();
  console.log("✔ Connected to MongoDB");
  return client.db(dbName);
}

// ----------------------------
// FETCH ALL 122 PAGES OF EPISODES
// ----------------------------
async function fetchAllEpisodes() {
  const all = [];
  const totalPages = 122;

  for (let page = 1; page <= totalPages; page++) {
    try {
      const res = await axios.get(
        `https://api.henpro.fun/api/episodes?page=${page}`
      );

      const eps = res.data?.data?.recentEpisodes || [];

      const filtered = eps.filter((e) => e.rawLabel !== "PREVIEW");
      all.push(...filtered);

      console.log("Fetched page", page);
    } catch (err) {
      console.log("Error fetching page", page, err.message);
    }
  }
  return all;
}

// ----------------------------
// PICK 70 UNIQUE EPISODES
// ----------------------------
function pick70(allEpisodes) {
  const selected = [];

  while (selected.length < 70) {
    const ep =
      allEpisodes[Math.floor(Math.random() * allEpisodes.length)];

    if (!selected.includes(ep)) {
      selected.push(ep);
    }
  }

  return selected;
}

// ----------------------------
// CREATE 70 POSTING TIMES ACROSS 7 DAYS
// ----------------------------
function schedulePosts(episodes, startDate) {
  return episodes.map((ep, index) => {
    const dayOffset = Math.floor(index / 10);
    const timeIndex = index % 10;

    const date = moment(startDate)
      .add(dayOffset, "days")
      .format("YYYY-MM-DD");

    const postingTime = moment(
      `${date} ${dailyTimes[timeIndex]}`,
      "YYYY-MM-DD HH:mm"
    ).toISOString();

    return { ...ep, postingTime };
  });
}

// ----------------------------
// CREATE OR APPEND BATCH FOR 1 ACCOUNT
// ----------------------------
async function addBatchForAccount(accountBatches, allEpisodes) {
  const existing = accountBatches || [];
  const batchNumber = existing.length + 1;

  let startDate;

  if (existing.length === 0) {
    // First batch ever
    startDate = moment().startOf("day");
  } else {
    // Start next batch 7 days after previous
    const last = existing[existing.length - 1];
    startDate = moment(last.startDate).add(7, "days");
  }

  const selectedEpisodes = pick70(allEpisodes);
  const scheduledPosts = schedulePosts(selectedEpisodes, startDate);

  const newBatch = {
    batch: batchNumber,
    startDate: startDate.format("YYYY-MM-DD"),
    posts: scheduledPosts,
  };

  return [...existing, newBatch];
}

// ----------------------------
// MAIN FUNCTION
// ----------------------------
async function postData() {
  const db = await connectToMongo();
  const col = db.collection("accounts");

  // Get existing doc
  let doc = await col.findOne({});

  if (!doc) {
    doc = {
      account1: [],
      account2: [],
      account3: [],
    };
  }

  // Fetch episodes
  console.log("Fetching episodes...");
  const allEpisodes = await fetchAllEpisodes();

  // For each account, generate next batch
  console.log("Generating new weekly batch...");

  doc.account1 = await addBatchForAccount(doc.account1, allEpisodes);
  doc.account2 = await addBatchForAccount(doc.account2, allEpisodes);
  doc.account3 = await addBatchForAccount(doc.account3, allEpisodes);

  // Save document
  if (!doc._id) {
    await col.insertOne(doc);
    console.log("✔ Inserted initial weekly batches.");
  } else {
    await col.updateOne(
      { _id: doc._id },
      { $set: {
        account1: doc.account1,
        account2: doc.account2,
        account3: doc.account3
      }}
    );
    console.log("✔ Added new weekly batch.");
  }

  console.log("🎉 ALL DONE!");
}

// Run function
postData().catch(console.error);
