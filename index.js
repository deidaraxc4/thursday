const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const config = require('./config')();
const { Pool } = require('pg');
const pool = new Pool({
    user: config.user,
    host: config.host,
    database: config.database,
    password: config.password,
    port: config.port
});
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const sessionConfig = {
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: 'secretdogs',
    resave: false,
    saveUninitialized: false
}

// configure various middleware
app.use(session(sessionConfig));
app.use(bodyParser.urlencoded({ extended: false })); // parse Content-Type: x-www-form-urlencoded
app.use(bodyParser.json());


// configure where express reads CSS and JS files
app.use(express.static(path.join(__dirname, 'public')));
// configure view engine
app.set('view engine', 'ejs');

// middleware functions
const requireAuth = function(req, res, next) {
    if(req.session && req.session.auth === "authorized") {
        res.locals.user = req.session.user;
        next();
    } else {
        res.status(401).send("401 unauthorized");
    }
};


// routes
app.get(['/', '/login'], function (req, res) {
    // console.log(req.session)
    res.render('login');
});

app.get('/draw', requireAuth, function(req, res) {
    //console.log(req.session);
    console.log(res.locals);
    res.render('draw');
});

app.get('/home', requireAuth, function(req, res) {
    console.log(req.session);
    // console.log(res.locals);
    res.render('home');
});


// endpoints
app.post('/signup', function(req, res) {
    // check all fields were filled
    if(!req.body.password || !req.body.username || !req.body.email) {
        res.send("You need an email, username, and password"); // TODO res.render and sending in some variables like a msg would be ideal
        return;
    }

    if(req.body.password !== req.body.passwordConfirm) {
        res.send("Passwords do not match");
    }

    // hash password so we dont get haxed
    bcrypt.hash(req.body.password, 10, function(err, hash) {
        // create record in DB
        const query = {
            text: 'INSERT INTO users(email, username, user_password, moderator) VALUES($1, $2, $3, $4)',
            values: [req.body.email, req.body.username, hash, false],
        };
        pool.query(query, function(err, res) {
            if(err) {
                console.log(err);
                throw err;
            } else {
                console.log("user created")
                console.log(res.rows[0])
            }
        });

        res.redirect('/login');
    });

});

app.post('/login', function(req, res) {
    if(req.body.username && req.body.password) {
        const query = {
            text: 'SELECT * FROM users WHERE users.username = $1',
            values: [req.body.username]
        };
        pool.query(query, function(err, result) {
            if(err) {
                console.log(err);
                throw err;
            } else {
                //console.log(result.rows[0])
                if(result.rows.length < 1) {
                    req.session.auth = "invalid";
                    res.redirect('/login'); //TODO use render and pass msg as data no user found
                } else {
                    bcrypt.compare(req.body.password, result.rows[0].user_password, function(err, match) {
                        if(match) {
                            req.session.user = result.rows[0];
                            req.session.auth = "authorized";
                            res.redirect('/home');
                        } else {
                            req.session.auth = "invalid";
                            res.redirect('/login'); //TODO use render and pass msg as data incorrect password
                        }
                    });
                }
            }
        });

    } else {
        res.send("Please enter a username and password")
    }

});

app.get('/logout', requireAuth, function(req, res) {
    req.session.destroy();
    res.redirect('/login');
});

app.post('/draw', requireAuth, function(req, res) {
    if(!req.body) {
        res.send("No data sent");
        return;
    }

    const query = {
        text: 'INSERT INTO post(user_id, post_data) VALUES($1, $2)',
        values: [res.locals.user.user_id, req.body['data']]
    }
    pool.query(query, function(err, response) {
        if(err) {
            console.log(err);
            throw err;
        } else {
            console.log("post created");
            res.redirect('/home');
        }
    });

});


// redirect all other routes to login
app.use(function(req, res) {
    res.redirect('/login');
});


app.listen(port, () => console.log(`listening on port ${port}`));