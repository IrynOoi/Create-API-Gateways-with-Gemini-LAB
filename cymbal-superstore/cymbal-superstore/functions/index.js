const functions = require('@google-cloud/functions-framework');


// Import the Firestore client library
const {Firestore} = require('@google-cloud/firestore');

// Create a Firestore client
const firestore = new Firestore();

// Create a Cloud Function that will be triggered by an HTTP request
functions.http('newproducts', async (req, res) => {
  // Add a CORS header to allow requests from any origin.
  res.set('Access-Control-Allow-Origin', '*');

  try {
    // Get the products from Firestore
    const products = await firestore.collection('inventory').where('timestamp', '>', new Date(Date.now() - 604800000)).get();

    // Create an array of products
    const productsArray = [];
    products.forEach((product) => {
      const p = {
        id: product.id,
        name: product.data().name + ' (' + product.data().quantity + ')',
        price: product.data().price,
        quantity: product.data().quantity,
        imgfile: product.data().imgfile,
        timestamp: product.data().timestamp,
        actualdateadded: product.data().actualdateadded,
      };
      productsArray.push(p);
    });

    // Send the products array to the client
    res.status(200).send(productsArray);
  } catch (error) {
    console.error("Error fetching new products:", error);
    res.status(500).send("Internal Server Error: Could not fetch new products.");
  }
});

// Separate HTTP function to seed the database.
// This should not be called on every request to 'newproducts'.
functions.http('seedproducts', async (req, res) => {
  try {
    await initFirestoreCollection();
    res.status(200).send("Database seeded successfully.");
  } catch (error) {
    console.error("Error seeding database:", error);
    res.status(500).send("Internal Server Error: Could not seed database.");
  }
});

// ------------------- ------------------- ------------------- ------------------- -------------------
// HELPERS -- SEED THE INVENTORY DATABASE (PRODUCTS)
// ------------------- ------------------- ------------------- ------------------- -------------------

// This will overwrite products in the database - this is intentional, to keep the date-added fresh. (always have a list of products added < 1 week ago, so that
// the new products page always has items to show.
async function initFirestoreCollection() {
  const oldProducts = [
    "Apples",
    "Bananas",
    "Milk",
    "Whole Wheat Bread",
    "Eggs",
    "Cheddar Cheese",
    "Whole Chicken",
    "Rice",
    "Black Beans",
    "Bottled Water",
    "Apple Juice",
    "Cola",
    "Coffee Beans",
    "Green Tea",
    "Watermelon",
    "Broccoli",
    "Jasmine Rice",
    "Yogurt",
    "Beef",
    "Shrimp",
    "Walnuts",
    "Sunflower Seeds",
    "Fresh Basil",
    "Cinnamon",
  ];
  // iterate over product names
  // add "old" products to firestore - all added between 1 month and 12 months ago
  // (none of these should show up in the new products list.)
  const promises = [];
  for (let i = 0; i < oldProducts.length; i++) {
    const oldProduct = {
      name: oldProducts[i],
      price: Math.floor(Math.random() * 10) + 1,
      quantity: Math.floor(Math.random() * 500) + 1,
      imgfile:
        "product-images/" +
        oldProducts[i].replace(/\s/g, "").toLowerCase() +
        ".png",
      // generate a random timestamp at least 3 months ago (but not more than 12 months ago)
      timestamp: new Date(
        Date.now() - Math.floor(Math.random() * 31536000000) - 7776000000
      ),

      actualdateadded: new Date(Date.now()),
    };
    console.log(
      "⬆️ Adding (or updating) product in firestore: " + oldProduct.name
    );
    promises.push(addOrUpdateFirestore(oldProduct));
  }
  // Add recent products (force add last 7 days)
  const recentProducts = [
    "Parmesan Crisps",
    "Pineapple Kombucha",
    "Maple Almond Butter",
    "Mint Chocolate Cookies",
    "White Chocolate Caramel Corn",
    "Acai Smoothie Packs",
    "Smores Cereal",
    "Peanut Butter and Jelly Cups",
  ];
  for (let j = 0; j < recentProducts.length; j++) {
    const recent = {
      name: recentProducts[j],
      price: Math.floor(Math.random() * 10) + 1,
      quantity: Math.floor(Math.random() * 100) + 1,
      imgfile:
        "product-images/" +
        recentProducts[j].replace(/\s/g, "").toLowerCase() +
        ".png",
      timestamp: new Date(
        Date.now() - Math.floor(Math.random() * 518400000) + 1
      ),
      actualdateadded: new Date(Date.now()),
    };
    console.log("🆕 Adding (or updating) product in firestore: " + recent.name);
    promises.push(addOrUpdateFirestore(recent));
  }

  // add recent products that are out of stock (To test demo query- only want to show in stock items.)
  const recentProductsOutOfStock = ["Wasabi Party Mix", "Jalapeno Seasoning"];
  for (let k = 0; k < recentProductsOutOfStock.length; k++) {
    const oosProduct = {
      name: recentProductsOutOfStock[k],
      price: Math.floor(Math.random() * 10) + 1,
      quantity: 0,
      imgfile:
        "product-images/" +
        recentProductsOutOfStock[k].replace(/\s/g, "").toLowerCase() +
        ".png",
      timestamp: new Date(
        Date.now() - Math.floor(Math.random() * 518400000) + 1
      ),
      actualdateadded: new Date(Date.now()),
    };
    console.log(
      "😱 Adding (or updating) out of stock product in firestore: " +
        oosProduct.name
    );
    promises.push(addOrUpdateFirestore(oosProduct));
  }
  // Wait for all the database operations to complete.
  await Promise.all(promises);
}

// Helper - add Firestore doc if not exists, otherwise update
// pass in a Product as the parameter
async function addOrUpdateFirestore(product) {
  const querySnapshot = await firestore
    .collection("inventory")
    .where("name", "==", product.name)
    .get();

  if (querySnapshot.empty) {
    return firestore.collection("inventory").add(product);
  } else {
    const updatePromises = [];
    querySnapshot.forEach((doc) => {
      updatePromises.push(firestore.collection("inventory").doc(doc.id).update(product));
    });
    return Promise.all(updatePromises);
  }
}
