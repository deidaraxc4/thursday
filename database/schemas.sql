CREATE TABLE IF NOT EXISTS users (
    user_id serial PRIMARY KEY,
    email varchar(50) NOT NULL,
    username varchar(50) NOT NULL,
    user_password varchar(255) NOT NULL,
	moderator boolean NOT NULL
);
