CREATE DATABASE blogSchema;
USE blogSchema;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    joined TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    title VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL,
    body MEDIUMTEXT NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    body MEDIUMTEXT NOT NULL,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(post_id) REFERENCES posts(id)
)
