const express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    session = require("express-session"),
    flash = require("connect-flash"),
    bcrypt = require("bcrypt-nodejs"),
    passport = require("passport"),
    LocalStrategy = require("passport-local"),
    methodOverride = require("method-override"),
    mysql = require("mysql");



app.use(bodyParser.urlencoded({
    extended: true
}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());

app.use(session({
    secret: "blogSchema",
    resave: false,
    saveUninitialized: false
}));

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'blogSchema',
    multipleStatements: true
});

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    connection.query("SELECT * FROM users WHERE id = ?", [id],
        (err, rows) => {
            done(null, rows[0]);
        });
});

/**
 * Passport Signup
 */

passport.use(
    'local-signup',
    new LocalStrategy({
            usernameField: 'username',
            passwordField: 'password',
            passReqToCallback: true
        },
        (req, username, password, done) => {
            connection.query("SELECT * FROM users WHERE username = ?", [username], (err, rows) => {
                if (err)
                    return done(err);
                if (rows.length) {
                    return done(null, false, req.flash('error', 'That username is already taken'));
                } else {
                    const newUserMysql = {
                        username: username,
                        password: bcrypt.hashSync(password, null, null)
                    };

                    const insertQuery = "INSERT INTO users (username, password) VALUES (?,?)";

                    connection.query(insertQuery, [newUserMysql.username, newUserMysql.password],
                        (err, rows) => {
                            newUserMysql.id = rows.insertId;

                            return done(null, newUserMysql, req.flash('success', 'Successfully Registered'));
                        });
                }
            });
        })
);

/**
 * Passport login
 */

passport.use(
    'local-login',
    new LocalStrategy({
            usernameField: 'username',
            passwordField: 'password',
            passReqToCallback: true
        },
        (req, username, password, done) => {
            connection.query("SELECT * FROM users WHERE username = ?", [username],
                (err, rows) => {
                    if (err)
                        return done(err);
                    if (!rows.length) {
                        return done(null, false, req.flash('error', 'No User Found'));
                    }
                    if (!bcrypt.compareSync(password, rows[0].password))
                        return done(null, false, req.flash('error', 'Wrong Password'));

                    return done(null, rows[0], req.flash('success', 'Login Successful'));
                });
        })
);


/**
 * Index Route - Returns all posts
 */

app.get("/", (req, res) => {
    res.redirect("/posts");
});

app.get("/posts", (req, res) => {
    const q = "SELECT * FROM posts ORDER BY created_at DESC;";
    connection.query(q, (err, result) => {
        if (err) throw err;
        res.render("index", {
            result: result
        });
    });
});

/**
 * New Post Route
 */

app.get("/posts/new", isloggedin, (req, res) => {
    res.render("new");
});

/**
 * Create Post Route
 */

app.post("/posts", isloggedin, (req, res) => {
    connection.query('INSERT INTO posts(title,image,body,user_id) VALUES(?,?,?,?)', [req.body.post.title, req.body.post.image, req.body.post.body, req.user.id], (err, result) => {
        if (err) throw err;
        res.redirect("/");
    });
});

/**
 * Create Comment Route
 * 
 * @param id post id
 */

app.post("/posts/:id", isloggedin, (req, res) => {
    connection.query("INSERT INTO comments(body,post_id,user_id) VALUES(?,?,?);", [req.body.comment.body, req.params.id, req.user.id], (err, result) => {
        if (err) throw err;
        res.redirect("/posts/" + req.params.id);
    });
});



/**
 * Show Post Route
 * 
 * @param id post id
 */

app.get("/posts/:id", (req, res) => {

    const q = "SELECT users.id, posts.id, title, username, posts.user_id, image, body, posts.created_at FROM users JOIN posts ON users.id=posts.user_id WHERE posts.id = " + req.params.id + ";";
    const q2 = "SELECT comments.user_id,posts.id,username,comments.id,comments.body,post_id,comments.created_at FROM comments JOIN users ON users.id = comments.user_id JOIN posts ON posts.id = comments.post_id WHERE post_id =" + req.params.id + ";";
    connection.query(q + q2, (err, post) => {
        if (err) throw err;
        res.render("show", {
            post: post[0][0],
            comment: post[1]
        });
    });
});

/**
 * Edit Post Route
 * 
 * @param id post id
 */

app.get("/posts/:id/edit", isloggedin, (req, res) => {
    const q = "SELECT * FROM posts WHERE id = " + req.params.id;

    connection.query(q, (err, post) => {
        if (err) throw err;
        res.render("edit", {
            post: post[0]
        });
    });
});

/**
 * Update Post Route
 * 
 * @param id post id
 */

app.put("/posts/:id", isloggedin, (req, res) => {
    const id = req.params.id;
    connection.query("UPDATE posts SET title = ?, image = ? , body = ? WHERE id = ? ", [req.body.post.title, req.body.post.image, req.body.post.body, id],
        (err, posts, fields) => {
            if (err) throw err;
            res.redirect("/posts/" + req.params.id);
        });
});

/**
 * Edit Comment Route
 * 
 * @param id post id
 * @param commentId comment id
 */

app.get("/posts/:id/:commentId/edit", isloggedin, (req, res) => {

    const q = "SELECT users.id, posts.id, title, username, posts.user_id, image, body, posts.created_at FROM users JOIN posts ON users.id=posts.user_id WHERE posts.id = " + req.params.id + ";";
    const q1 = "SELECT comments.user_id,posts.id,username,comments.id,comments.body,post_id,comments.created_at FROM comments JOIN users ON users.id = comments.user_id JOIN posts ON posts.id = comments.post_id WHERE post_id =" + req.params.id + ";";

    connection.query(q + q1, (err, post) => {
        if (err) throw err;
        res.render("editcomment", {
            post: post[0][0],
            comment: post[1],
            commentId: req.params.commentId
        });
    });
});

/**
 * Update Comment Route
 * 
 * @param id post id
 * @param commentId comment id
 */

app.put("/posts/:id/:commentId", isloggedin, (req, res) => {
    const id = req.params.id;
    connection.query("UPDATE comments SET body = ? WHERE id = ? ", [req.body.comment.body, req.params.commentId],
        (err, posts, fields) => {
            if (err) throw err;
            res.redirect("/posts/" + req.params.id);
        });
});

/**
 * Delete Post Route
 * 
 * @param id post id
 */

app.delete("/posts/:id", (req, res) => {
    connection.query("DELETE FROM comments WHERE post_id = '" + req.params.id + "';DELETE FROM posts WHERE id = '" + req.params.id + "';",
        (err, posts, fields) => {
            if (err) throw err;
            res.redirect("/posts");
        });
});

/**
 * Delete Comment Route
 * 
 * @param id post id
 * @param commentId comment id
 */

app.delete("/posts/:id/:commentId", (req, res) => {

    connection.query("DELETE FROM comments WHERE id = " + req.params.commentId,
        (err, result) => {
            if (err) throw err;
            res.redirect("/posts/" + req.params.id);
        });
});

/**
 * User Profile Route
 * 
 * @param userId user id
 */

app.get('/profile/:userId', isloggedin, (req, res) => {

    q = "SELECT posts.title, posts.image, posts.body, posts.created_at, posts.user_id, posts.id, users.username FROM users JOIN posts on posts.user_id = users.id WHERE posts.user_id = " + req.params.userId + " ORDER BY created_at DESC;";
    connection.query(q,
        (err, posts) => {
            if (err) throw err;
            res.render('profile', {
                result: posts
            });
        });
});

/**
 * Delete User Profile Route
 * 
 * @param userId user id
 */

app.delete("/profile/:id", (req, res) => {
    connection.query("DELETE FROM comments WHERE user_id = '" + req.params.id + "';DELETE FROM posts WHERE user_id = '" + req.params.id + "';DELETE FROM users WHERE id = '" + req.params.id + "';",
        (err, posts, fields) => {
            if (err) throw err;
            req.logout();
            res.redirect("/posts");
        });
});

/**
 * Sign Up Route
 */

app.get("/register", (req, res) => {
    res.render("register");
});


app.post("/register", passport.authenticate('local-signup', {
    successRedirect: "/",
    failureRedirect: "/register",
    failureFlash: true
}), (req, res) => {

});

/**
 * Login Route
 */

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", passport.authenticate("local-login", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
}), (req, res) => {});

/**
 * Logout Route
 */

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
})

/**
 * Middleware
 */

function isloggedin(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        res.redirect("/login");
    }
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`The Blog App Has Started`));