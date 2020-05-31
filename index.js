const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path')

const config = require('./config')()
const { Pool } = require('pg');
const pool = new Pool({
    user: config.user,
    host: config.host,
    database: config.database,
    password: config.password,
    port: config.port
});

pool.query('SELECT * FROM USERS', (err, res) =>{
    console.log(err,res)
    pool.end()  
})

// configure where express reads CSS and JS files
app.use(express.static(path.join(__dirname, 'public')));
// configure view engine
app.set('view engine', 'ejs')

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

// redirect all other routes to login
app.use(function(req, res) {
    res.redirect('/login');
});

app.listen(port, () => console.log(`listening on port ${port}`));