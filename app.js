require("dotenv").config();
const express = require("express");
const app = express();
const admin = require("firebase-admin");
const port = process.env.PORT;

/**
 * @summary
 * Connect to the ReciMe Firebase project using credentials stored as env vars
 */
const firebaseApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // replace escape characters
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const firestore = firebaseApp.firestore();

app.use("/api", express.static("public"));

app.get("/", (req, res) => {
  res.redirect("/api/trending.html");
});

/**
 * @summary
 * Gets the current trending recipes stored in Firestore
 */
const getTrendingRecipes = async () => {
  let trendingRef = firestore.collection("recipes").doc("trending");
  return await firestore
    .runTransaction((t) => {
      return t.get(trendingRef).then((doc) => {
        const results = doc.data().results;
        return Promise.resolve(JSON.stringify(results));
      });
    })
    .then((result) => {
      return result;
    })
    .catch((err) => {
      return -1;
    });
};

/**
 * @summary
 * Route to retrieve current trending recipes stored in trendingRecipes
 */
app.get("/api/utils/getTrending", async (req, res) => {
  let trendingRecipes = await getTrendingRecipes();
  if (trendingRecipes == -1) {
    res.status(500).send("error");
    return;
  }
  res.status(200).send(trendingRecipes);
});

/**
 * @summary
 * Temporary route for dev purposes
 * updateRecipes() will only be called by cron job when it's confirmed to be working
 */
// app.get("/update", (req, res) => {
//   updateRecipes().then((result) => {
//     res.send(result);
//   });
// });

app.listen(port, () => console.log("Listening on port", port));