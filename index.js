const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path')

const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const config = require('./config')()
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
app.use(bodyParser.urlencoded({ extended: false })) // parse Content-Type: x-www-form-urlencoded


// configure where express reads CSS and JS files
app.use(express.static(path.join(__dirname, 'public')));
// configure view engine
app.set('view engine', 'ejs')


// routes
app.get(['/', '/login'], function (req, res) {
    res.render('login');
});

app.get('/logout', function(req, res) {
    res.redirect('/login');
});

app.get('/draw', function(req, res) {
    res.render('draw');
});

app.get('/home', function(req, res) {
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
            } else {
                console.log(res.rows[0])
            }
        });

        res.redirect('/login');
    });

});

app.post('/login', function(req, res) {
    console.log(req.body)
    res.redirect('/login');
})


// redirect all other routes to login
app.use(function(req, res) {
    res.redirect('/login');
});


app.listen(port, () => console.log(`listening on port ${port}`));