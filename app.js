require("dotenv").config();
const CronJob = require("cron").CronJob;
const admin = require("firebase-admin");
const unirest = require("unirest");
const express = require("express");
const app = express();
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

let trendingRecipes = "";

/**
 * @summary
 * A function to run once whenver the server starts.
 * Basically initializes trendingRecipes to whatever is currently in
 * Firestore
 */
const initTrendingRecipes = async () => {
  let trendingRef = firestore.collection("recipes").doc("trending");
  await firestore
    .runTransaction((t) => {
      return t.get(trendingRef).then((doc) => {
        const results = doc.data().results;
        return Promise.resolve(JSON.stringify(results));
      });
    })
    .then((result) => {
      console.log("Transaction success:", result);
      trendingRecipes = result; // JSON string of recipes
    })
    .catch((err) => {
      console.log("Transaction failure:", err);
    });
};

/**
 * @summary
 * Call spoonacular API for list of 10 popular recipes to use for trendng section in ReciMe
 * @returns recipes, or -1 if error
 */
const getRecipesFromAPI = async () => {
  let request = unirest(
    "GET",
    "https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/random"
  );
  let recipes = [];

  request.query({
    number: "10",
  });
  request.headers({
    "x-rapidapi-host": "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com",
    "x-rapidapi-key": process.env.SPOONACULAR_API_KEY,
  });
  return await request.then((response) => {
    if (response.error) {
      console.log("An error occured");
      return -1; // error
    } else {
      response.body.recipes.forEach((recipe) => {
        recipes.push({
          id: recipe.id.toString(),
          imageURL: recipe.image,
          title: recipe.title,
        });
      });
    }
    return recipes; // an array of JSON objects containing recipes
  });
};

/**
 * @summary
 * Update the recipes currently in the Firebase projects with new ones from
 * calling getRecipesFromAPI()
 * @returns result of transaction, or -1 if error
 */
const updateRecipes = async () => {
  let trendingRef = firestore.collection("recipes").doc("trending");
  let newRecipes = await getRecipesFromAPI();
  return await firestore
    .runTransaction((t) => {
      return t.get(trendingRef).then((doc) => {
        if (newRecipes != -1) {
          t.set(trendingRef, {
            results: newRecipes
          });
          return Promise.resolve(JSON.stringify(newRecipes));
        } else {
          return Promise.reject("Error getting new recipes.");
        }
      });
    })
    .then((result) => {
      console.log("Transaction success:", result);
      trendingRecipes = result; // JSON string of recipes
      return result;
    })
    .catch((err) => {
      console.log("Transaction failure:", err);
      return -1;
    });
};

/**
 * @summary
 * Route to retrieve current trending recipes stored in trendingRecipes
 */
app.get("/api/utils/getTrending", (req, res) => {
  if (trendingRecipes === "") {
    res.status(500).send("empty");
    return;
  }
  res.status(200).send(trendingRecipes);
});

/**
 * @summary
 * Temporary route for dev purposes
 * updateRecipes() will only be called by cron job when it's confirmed to be working
 */
app.get("/update", (req, res) => {
  updateRecipes().then((result) => {
    res.send(result);
  });
});

/**
 * @summary
 * Cron job to run once everyday at 3:00am PST
 * Calls updateRecipes()
 */
const job = new CronJob('0 3 * * * *', async () => {
  console.log(Date.now().toString() + ": updating recipes");
  const res = await updateRecipes();
  if (res == -1) {
    console.log(Date.now().toString() + ": failed to update recipes");
  } else {
    console.log(Date.now().toString() + ": recipes updated");
  }

}, null, true, 'America/Los_Angeles');
job.start();

initTrendingRecipes();
app.listen(port, () => console.log("Listening on port", port));