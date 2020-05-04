require("dotenv").config();
const admin = require("firebase-admin");
const unirest = require("unirest");

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
            console.log("An error occurred");
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
                    return Promise.resolve(newRecipes);
                } else {
                    return Promise.reject("Error getting new recipes.");
                }
            });
        })
        .then((result) => {
            console.log("Transaction success");
            return result;
        })
        .catch((err) => {
            console.log("Transaction failure:", err);
            return -1;
        });
};

/**
 * @summary
 * Function that calls updateRecipes()
 * Can be rewritten as a cron job. 
 * To work properly on Heroku with their dynos, this function will be called
 * in scheduled-job.js. Heroku Scheduler will then run the file once/day
 */
const job = async () => {
    console.log(Date.now().toString() + ": updating recipes");
    const res = await updateRecipes();
    if (res == -1) {
        console.log(Date.now().toString() + ": failed to update recipes");
    } else {
        console.log(Date.now().toString() + ": recipes updated");
    }
};

job();