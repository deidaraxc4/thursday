CREATE TABLE IF NOT EXISTS users (
    user_id serial PRIMARY KEY,
    email varchar(50) NOT NULL,
    username varchar(50) NOT NULL,
    user_password varchar(255) NOT NULL,
	moderator boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS post (
    post_id serial PRIMARY KEY,
    user_id integer NOT NULL,
    post_data bytea NOT NULL,
    date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users (user_id)
);
