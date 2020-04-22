require('dotenv').config();
const CronJob = require('cron').CronJob;
const admin = require('firebase-admin');
const unirest = require('unirest');
const express = require('express');
const app = express();
const port = 3000;

const firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') // replace escape characters
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});

const firestore = firebaseApp.firestore();

const getRecipes = async () => {
    let request = unirest("GET", "https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/random");
    let recipes = [];

    request.query({
        "number": "1"
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
            (response.body.recipes).forEach(recipe => {
                recipes.push({
                    id: (recipe.id).toString(),
                    imageURL: recipe.image,
                    title: recipe.title,
                });
            });
        }
        return recipes; // an array of JSON objects containing recipes
    });
};

const updateRecipes = async () => {
    let trendingRef = firestore.collection('recipes').doc('trending');
    let newRecipes = await getRecipes();
    let transaction = await firestore.runTransaction(t => {
        return t.get(trendingRef)
            .then(doc => {
                if (newRecipes != -1) {
                    t.set(trendingRef, { results: newRecipes });
                    return Promise.resolve('Trending recipes updated to ' + JSON.stringify(newRecipes));
                } else {
                    return Promise.reject('Error getting new recipes.');
                }
            });
    }).then(result => {
        console.log('Transaction success', result);
    }).catch(err => {
        console.log('Transaction failure:', err);
    });
};

// const job = new CronJob('* * * * * *', function () {
//     console.log('You will see this message every second');
// }, null, true, 'America/Los_Angeles');
// job.start();

app.listen(port, () => console.log("Listening on port", port));