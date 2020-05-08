const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path')

// configure where express reads CSS and JS files
app.use(express.static(path.join(__dirname, 'public')));
// configure view engine
app.set('view engine', 'ejs')

app.get('/', function (req, res) {
    res.render('index')
})



app.listen(port, () => console.log(`listening on port ${port}`));