var express          = require("express"),
    app              = express(),
    bodyParser       = require("body-parser"),
    request          = require("request"),
    session          = require("express-session"),
    mongoose         = require("mongoose"),
    flash            = require("connect-flash"),
    bcrypt           = require("bcrypt-nodejs"),
    passport         = require("passport"),
    LocalStrategy    = require("passport-local"),
    methodOverride   = require("method-override"),
    mysql            = require("mysql");



app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());

app.use(session({
    secret: "blogSchema",
    resave: false,
    saveUninitialized: false
}));

var connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : 'admin',
    database : 'blogSchema',
    multipleStatements: true
  });

app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next){
    res.locals.currentUser = req.user;
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');
    next();
});

passport.serializeUser(function(user, done){
    done(null, user.id); 
});
passport.deserializeUser(function(id, done){
    connection.query("SELECT * FROM users WHERE id = ?", [id],
    function(err, rows){
        done(err, rows[0]);
    });
});

//============================================================ PASSPORT SIGNUP =============================================================

passport.use(
    'local-signup',
    new LocalStrategy({
        usernameField :'username',
        passwordField:'password',
        passReqToCallback :true
    },
    function(req, username, password, done){
        connection.query("SELECT * FROM users WHERE username = ?", [username], function(err, rows){
            if(err)
                return done(err);
            if(rows.length){
                return done(null, false, req.flash('error','That username is already taken'));
            }else{
                var newUserMysql = {
                    username :username,
                    password : bcrypt.hashSync(password, null, null)
                };

                var insertQuery = "INSERT INTO users (username, password) VALUES (?,?)";

                connection.query(insertQuery, [newUserMysql.username, newUserMysql.password],
                    function(err, rows){
                        newUserMysql.id = rows.insertId;

                        return done(null, newUserMysql, req.flash('success', 'Successfully Registered'));
                    });
            }
        });
    })
);

//============================================================ PASSPORT LOGIN =============================================================

passport.use(
    'local-login',
    new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true
    },
    function(req,username, password, done){
        connection.query("SELECT * FROM users WHERE username = ?", [username],
        function(err, rows){
            if(err)
                return done(err);
            if(!rows.length){
                return done(null, false,req.flash('error', 'No User Found'));
            }
            if(!bcrypt.compareSync(password, rows[0].password))
                return done(null, false, req.flash('error','Wrong Password'));
            
            return done(null, rows[0], req.flash('success', 'Login Successful'));
        });
    })
);


//=========================================================== INDEX PAGE ===================================================================

app.get("/", function(req, res){
    res.redirect("/posts");
});

app.get("/posts", function(req, res) {
    var q = "SELECT * FROM posts ORDER BY created_at DESC;";
    connection.query(q, function(err, result) {
        if (err) throw err;
        res.render("index", { result: result});
    });
});

//========================================================= NEW POST PAGE ==================================================================

app.get("/posts/new", isloggedin,function(req, res){
    res.render("new");
});

//========================================================== CREATE ROUTE ===================================================================

app.post("/posts", isloggedin,function(req, res){
    connection.query('INSERT INTO posts(title,image,body,user_id) VALUES(?,?,?,?)', [req.body.post.title, req.body.post.image, req.body.post.body, req.user.id], function(err, result){
        if(err) throw err;
        res.redirect("/");
    });
});

//========================================================== COMMENT ROUTE ===================================================================

app.post("/posts/:id", isloggedin, function(req, res) {
    const post_id = req.params.id;
    connection.query("INSERT INTO comments(body,post_id,user_id) VALUES(?,?,?);", [req.body.comment.body, post_id, req.user.id], function(error, comment, fields) {
        if (error) throw error;
        res.redirect("/posts/" + post_id);
    });
});



//=========================================================== SHOW ROUTE ===================================================================

app.get("/posts/:id", function(req, res) {

    const q = "SELECT users.id, users.username, posts.title, posts.image, posts.body, posts.user_id, posts.created_at FROM users JOIN posts ON users.id = posts.user_id WHERE posts.id = '" + req.params.id + "';";
    const q2 = "SELECT comments.user_id,posts.id,username,comments.id,comments.body,post_id,comments.created_at FROM comments JOIN users ON users.id = comments.user_id JOIN posts ON posts.id = comments.post_id WHERE post_id = '" + req.params.id + "';";
    connection.query(q + q2, function(err, post) {
        if (err) throw err;
        res.render("show", { post: post[0][0], comments: post[1] });
    });
});
//=========================================================== SHOW ROUTE ===================================================================

app.get("/posts/:id/edit", isloggedin, function(req, res) {
    var id = req.params.id;
    var q = "SELECT * FROM posts WHERE id = '" + id + "';";

    connection.query(q, function(err, posts) {
        if (err) throw err;
        res.render("edit", { posts: posts[0] });
    });
});

// UPDATE ROUTE - posts

app.put("/posts/:id", isloggedin, function(req, res) {
    var id = req.params.id;
    connection.query("UPDATE posts SET title = ?, image = ? , body = ? WHERE id = ? ", [req.body.post.title, req.body.post.image, req.body.post.body, id], function(err, posts, fields) {
        if (err) throw err;
        res.redirect("/posts/" + req.params.id);
    });
});

// //=========================================================== UPDATE ROUTE ===================================================================

// app.put("/posts/:id", isloggedin,function(req, res){    
//     var editPost = {title: req.body.title, body: req.body.body, id: req.params.id}
//     connection.query("UPDATE posts SET title = ? , body = ? WHERE id = ? ", editPost, function(err, posts, fields) {
//         if(err) throw err;
//         res.redirect("/posts/" + req.params.id);
//     });
// });

//=========================================================== DELETE ROUTE ===================================================================

app.delete("/posts/:id", function(req, res){
    connection.query("DELETE FROM comments WHERE post_id = '" + req.params.id + "';DELETE FROM posts WHERE id = '" + req.params.id + "';", function(err, posts, fields) {
        if(err) throw err;
        res.redirect("/posts");
    });
});

//=========================================================== COMMENT DELETE ROUTE ===================================================================

app.delete("/posts/:id/:commentId", function(req, res){
    
    connection.query("DELETE FROM comments WHERE id = " + req.params.commentId, function(err, posts, fields) {
        if(err) throw err;
        res.redirect("/posts/" + req.params.id);
    });
});



//============================================================ REGISTER PAGE =============================================================

app.get("/register", function(req, res){
    res.render("register"); 
});
 

app.post("/register", passport.authenticate('local-signup',{
    successRedirect : "/",
    failureRedirect :"/register",
    failureFlash: true
}), function(req, res){

});

//==================================================================== LOGIN PAGE =====================================================================

app.get("/login", function(req, res){
    res.render("login"); 
});

app.post("/login", passport.authenticate("local-login", 
{
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
}), function(req, res){
});

//==================================================================== LOGOUT ROUTE ====================================================================

app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
})

//===================================================================== MIDDLEWARE =====================================================================

function isloggedin(req, res, next){
    if(req.isAuthenticated()){
        next();
    }else{
        res.redirect("/login");
    }
}



app.listen(3000, function(){
    console.log("The Blog App Server Has Started");
});