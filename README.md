# Draw Dog Thursdays

Draw dogs, but only on Thursdays.


## About
Draw Dog Thursdays is a platform where users can submit their dog drawings and share it with others. Current features include voting, sorting by old, new, best, and worst. Future features such as commenting may come.


## Setup and Install

Install node dependencies 

`npm install`

Create a config file with Postgres connection info based on the example config

```
cd credentials
mv example.config.json dev.config.json
```

Run

`npm start`


## Built With
* [Node.js](https://nodejs.org/en/) - The backend server
* [Express.js](https://expressjs.com/) - The web framework
* [EJS](https://ejs.co/) - The templating engine
* [node-postgres](https://node-postgres.com/) - Node.js interface for Postgres
* Many other npm modules for various things such as session storage, cryptography , and time conversion


## Screenshots
![login page](https://github.com/deidaraxc4/thursday/blob/master/images/login.PNG)
![home page](https://github.com/deidaraxc4/thursday/blob/master/images/home.PNG)
![draw page](https://github.com/deidaraxc4/thursday/blob/master/images/draw.PNG)
![report page](https://github.com/deidaraxc4/thursday/blob/master/images/report.PNG)
