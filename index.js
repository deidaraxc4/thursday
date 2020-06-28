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

const requireMod = function(req, res, next) {
    if(req.session && req.session.auth === "authorized" && res.locals.user.moderator === true) {
        next();
    } else {
        res.status(403).send("403 forbidden");
    }
};


// routes
app.get(['/', '/login'], function (req, res) {
    res.render('login', { failed: false });
});

app.get('/draw', requireAuth, function(req, res) {
    res.render('draw');
});

app.get('/home', requireAuth, function(req, res) {
    const sort = req.query.sort;
    let page = parseInt(req.query.page) || 1;
    if(page < 1) {
        page = 1;
    }
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
            //throw err;
            res.status(400).send("something went wrong")
        } else {
            const posts = response.rows;
            let totalItems;
            try {
                totalItems = response.rows[0].full_count
            } catch(e) {
                totalItems = 0
            }
            const submissions = posts.map((post) => {
                const buffer = Buffer.from(post.post_data);

                return {
                    username: post.username,
                    dataUrl: buffer.toString('utf8'),
                    timestamp: post.date,
                    postId: post.post_id,
                    num_votes: post.num_votes,
                    user_voted: post.user_voted
                }
            });

            res.render('home', { submissions: submissions, totalItems: totalItems, currentPage: page });
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
        pool.query(query, function(err, response) {
            if(err) {
                console.log(err);
                // throw err;
                res.status(400).send("something went wrong")
            } else {
                console.log("user created")
                console.log(response.rows[0])
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
                // throw err;
                res.status(400).send("something went wrong")
            } else {
                //console.log(result.rows[0])
                if(result.rows.length < 1) {
                    req.session.auth = "invalid";
                    res.render('login', { failed: true });
                } else {
                    bcrypt.compare(req.body.password, result.rows[0].user_password, function(err, match) {
                        if(match) {
                            req.session.user = result.rows[0];
                            req.session.auth = "authorized";
                            res.redirect('/home');
                        } else {
                            req.session.auth = "invalid";
                            res.render('login', { failed: true });
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
    req.session.destroy(function(err) {
        res.redirect('/login');
    });
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
            // throw err;
            res.status(400).send("something went wrong")
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
            // throw err;
            res.status(400).send("something went wrong")
        } else {
            console.log("vote created");
            res.send('success');
        }
    });

});

app.delete('/post', requireMod, function(req, res) {
    if(!req.body) {
        res.send("No data sent");
    }

    const query = {
        text: 'DELETE FROM post WHERE post_id = $1',
        values: [req.body['postId']]
    };
    pool.query(query, function(err, response) {
        if(err) {
            console.log(err);
            // throw err;
            res.status(400).send("something went wrong")
        } else {
            console.log("post deleted");
            res.send('success');
        }
    })
});


// redirect all other routes to login
app.use(function(req, res) {
    res.redirect('/login');
});


app.listen(port, () => console.log(`listening on port ${port}`));