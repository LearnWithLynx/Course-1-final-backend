const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./myKey.json");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
const app = express();
const port = process.env.PORT;

app.use(cors());

app.use(express.json());

let items = [
  { id: 1, name: "Item 1" },
  { id: 2, name: "Item 2" },
];

let tickets = [];

app.listen(port, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/items", (req, res) => {
  res.json(items);
});

// req.body - appears inside the HTTP request.
// req.params - appears in the URL of the website.
app.get("/items/:id", (req, res) => {
  const item = items.find((element) => element.id === parseInt(req.params.id)); // but params are always string !
  if (!item) res.status(404).send("Item not found");
  res.json(item);
});

//create
app.post("/items", (req, res) => {
  const item = {
    id: items.length + 1,
    name: req.body.name,
  };
  console.log(item);
  if (!item.name) res.status(400).send("name is undefined");
  items.push(item);
  res.status(200).json(item);
});

app.post("/contact", (req, res) => {
  const { firstName, lastName, email, message } = req.body;
  if (!firstName || !lastName || !email || !message) {
    res.status(400).send("Missing parameters, ticket was not submitted.");
  }
  const ticket = {
    id: uuidv4(),
    firstName,
    lastName,
    email,
    message,
    timestamp: admin.firestore.Timestamp.now(),
  };

  db.collection("tickets")
    .doc(ticket.id)
    .set(ticket)
    .then(() => {
      res.status(200).send("Ticket was created successfully.");
    })
    .catch((error) => {
      res.status(500).send("Error submitting ticket");
    });
});

app.post("/login", async (req, res) => {
  // Make sure the callback is async
  console.log(req.body);
  const { userName, pass } = req.body;
  const saltRounds = 10;

  const hashedPassword = await bcrypt.hash(pass, saltRounds);
  // $2b$10$RyBQ05RaniT0.sNsnudzDeyXgkDeghDkYxehD5IfE12foMRBUb4tS
  console.log("hashedPassword", hashedPassword);

  if (!userName || !pass) {
    return res
      .status(400)
      .send("Missing parameters, ticket was not submitted.");
  }

  const getAdminDoc = async () => {
    const snapshot = await db.collection("users").get();
    const users = [];
    snapshot.forEach((doc) => {
      users.push(doc.data());
    });
    return users[0];
  };

  try {
    const myDoc = await getAdminDoc();
    console.log(myDoc);
    const match = await bcrypt.compare(pass, myDoc.pass); // pass is the plaintext password submitted by the user
    if (match) {
      const token = jwt.sign(
        { userName: myDoc.userName, userId: myDoc.id }, // Payload to include in the token
        "yourSecretKey", // Secret key to sign the token (keep this safe!)
        { expiresIn: "1h" } // Token expiration time
      );
      res.status(200).json({ message: "Logging in..", token: token });
    } else {
      res.status(401).send("Unauthorized");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/tickets", (req, res) => {
  db.collection("tickets")
    .get()
    .then((snapshot) => {
      const tickets = [];
      snapshot.forEach((doc) => {
        tickets.push(doc.data());
      });
      console.log("tickets", tickets);
      res.status(200).json(tickets);
    })
    .catch((error) => {
      res.status(500).send("Error fetching tickets", error);
    });
});

//delete
app.delete("/items/:id", (req, res) => {
  items = items.filter((element) => element.id !== parseInt(req.params.id));
  res.status(200).send("Item deleted successfully");
});

app.delete("/tickets/:id", (req, res) => {
  // Extract the token from the Authorization header
  // The header format is "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Get the token part

  if (token == null) return res.sendStatus(401); // If no token is present, return Unauthorized

  // Verify the token
  jwt.verify(token, "yourSecretKey", (err, user) => {
    if (err) return res.sendStatus(403); // If token is invalid or expired, return Forbidden

    // Token is valid, proceed to delete the ticket
    const ticketId = req.params.id;

    db.collection("tickets")
      .doc(ticketId)
      .delete()
      .then(() => {
        console.log("Ticket successfully deleted!");
        res.status(200).send("Ticket successfully deleted");
      })
      .catch((error) => {
        console.error("Error removing ticket: ", error);
        res.status(500).send("Error deleting ticket");
      });
  });
});

// update

app.put("/items/:id", (req, res) => {
  const item = items.find((element) => element.id === parseInt(req.params.id));
  if (!item) res.status(404).send("Item not found");
  item.name = req.body.name;
  res.json(item);
});
