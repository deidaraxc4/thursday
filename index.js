const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const moment = require('moment');

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
    res.render('login');
});

app.get('/draw', requireAuth, function(req, res) {
    res.render('draw');
});

app.get('/home', requireAuth, function(req, res) {
    const sort = req.query.sort;
    const page = req.query.page || 1;
    const offset = (page - 1) * 5;
    let orderQuery = "ORDER BY p.date DESC";
    switch (sort) {
        case "new" :
            orderQuery = "ORDER BY p.date DESC";
            break;
        case "old" :
            orderQuery = "ORDER BY p.date ASC";
            break;
        case "best" :
            orderQuery = "ORDER BY num_votes DESC";
            break;
        case "bad" :
            orderQuery = "ORDER BY num_votes ASC";
            break;
        default:
            orderQuery = "ORDER BY p.date DESC";
    }

    const query = {
        text: `SELECT u.username, p.post_data, p.date, p.post_id, 
        (SELECT COALESCE(SUM(vote_value), 0) FROM vote v WHERE v.post_id = p.post_id) num_votes,
        (SELECT CASE WHEN EXISTS (SELECT 1 AS userVoted FROM vote WHERE vote.user_id = $1 AND vote.post_id = p.post_id) THEN TRUE ELSE FALSE END AS user_voted),
        COUNT(*) OVER() AS full_count
        FROM users u INNER JOIN post p ON p.user_id = u.user_id ${orderQuery} LIMIT 5 OFFSET $2`,
        values: [res.locals.user.user_id, offset]
    };
    pool.query(query, function(err, response) {
        if(err) {
            console.log(err);
            throw err;
        } else {
            const posts = response.rows;
            const totalItems = response.rows[0].full_count;
            const submissions = posts.map((post) => {
                const buffer = Buffer.from(post.post_data);
                // figure out difference between post date and now and round to nearest minute, hour, day, month, or year
                // console.log(post.date)
                // const date = new Date(post.date);
                // console.log(date)
                // console.log(moment(date).local())
                // const localDate = moment(date).local();
                // const dateFromNow = localDate.fromNow();
                const d = moment(post.date).subtract({ hours: 4 }); // server is keeping utc time so go back 4
                //console.log(post.date)
                //console.log(moment(post.date+'Z').toString())

                //const dateFromNow = d.fromNow();
                const dateFromNow = moment(post.date).local().fromNow();
                return {
                    username: post.username,
                    dataUrl: buffer.toString('utf8'),
                    timestamp: dateFromNow,
                    postId: post.post_id,
                    num_votes: post.num_votes,
                    user_voted: post.user_voted
                }
            });

            res.render('home', { submissions: submissions, totalItems: totalItems });
        }
    });
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
    };
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

app.post('/vote', requireAuth, function(req, res) {
    if(!req.body) {
        res.send("No data sent");
    }

    const query = {
        text: 'INSERT INTO vote(user_id, post_id) VALUES($1, $2)',
        values: [res.locals.user.user_id, req.body['postId']]
    };
    pool.query(query, function(err, response) {
        if(err) {
            console.log(err);
            throw err;
        } else {
            console.log("vote created");
            res.send('success');
        }
    });

});


// redirect all other routes to login
app.use(function(req, res) {
    res.redirect('/login');
});


app.listen(port, () => console.log(`listening on port ${port}`));