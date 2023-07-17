if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const passport = require('passport');
const initializePassport = require('./js files/passport-config');
const flash = require('express-flash');
const session = require('express-session');

const app = express();
const db = mysql.createConnection({
  host : 'localhost',
  user : 'root',
  password : 'password',
  database : 'quizzhub'
});
db.connect((err) => {
    if(err) console.log(err);
    else console.log('mysql connected');
})

initializePassport(
    passport, 
    async (email) => {
    try {
      const result = await queryUserByEmail(email);
      if (result.length === 0) {
        return {username: null,password: null};
      } else {
        // console.log(result[0].username);
        return result[0];
      }
    } catch (error) {
      console.log(error);
      return null;
    }},
    async (id) => {
        try {
            const result = await queryUserById(id);
            if (result.length === 0) {
                return {username: null,password: null};
              } else {
                // console.log(result[0].username);
                return result[0];
              }
            } catch (error) {
              console.log(error);
              return null;
        }
    }
);

async function queryUserByEmail(email) {
    return new Promise((resolve, reject) => {
        let sql = `SELECT * FROM users WHERE username = "${email}"`;
        db.query(sql, (err, result) => {
        if (err) {
            reject(err);
        } else {
            resolve(result);
        }
        });
    });
}

async function queryUserById(id) {
    return new Promise((resolve, reject) => {
        let sql = `SELECT * FROM users WHERE id = ${id}`;
        db.query(sql, (err, result) => {
            if(err) {
                reject(err);
            }
            else {
                resolve(result);
            }
        });
    })
}

app.set('view engine', 'ejs');
app.set('views','ejs files');

app.use(express.static('all styles'));
app.use(express.static('images'));
app.use(express.urlencoded({extended: false}));
app.use(flash());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.listen(3000);

app.get('/', checkAuthenticated, (req,res) => {
    res.render('home-n',{name: req.user.name})
})

app.get('/login', checkNotAuthenticated, (req,res) => {
    res.render('login');
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

app.get('/register', checkNotAuthenticated, (req,res) => {
    res.render('register');
})

app.post('/register', checkNotAuthenticated, async (req,res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const sql = `INSERT INTO users(name, username, password) VALUES("${req.body.name}", "${req.body.email}", "${mysql.escape(hashedPassword)}")`;
        db.query(sql, (err,result) => {
            if(err) console.log(err);
            else{
                console.log('user registered');
                res.redirect('/login');
            }
        });
    }
    catch {
        res.redirect('/register');
    }
})

app.get('/home-n', checkAuthenticated, (req,res) => {
    res.render('home-n',{name: req.user.name});
})

app.post('/home-n', (req,res) => {
    const search = req.body.search;
    db.query(`SELECT name FROM users WHERE name like "${search}%"`, (err,result) => {
        if(err) console.log(err);
        res.render('search', {search: search, name: req.user.name, search_list:result});
    })
})

function generateRandomSixDigitNumber() {
    const minValue = 100000;
    const maxValue = 999999;
    const randomNumber = Math.floor(Math.random() * (maxValue - minValue + 1) + minValue);
    const sixDigitNumber = String(randomNumber).padStart(6, '0');
    return sixDigitNumber;
  }
  
let value;
app.get('/create', checkAuthenticated, (req,res) => {
    value = generateRandomSixDigitNumber();
    console.log(value);
    let sql = `create table ${req.user.name}_quiz${value}(
        id INT AUTO_INCREMENT PRIMARY KEY,
        question VARCHAR(1024),
        answer VARCHAR(1024),
        user VARCHAR(255) DEFAULT '${req.user.name}',
        score INT DEFAULT NULL
    )`;
    db.query(sql, (err,result) => {
        if(err) console.log(err);
        console.log('table created');
        res.render('create',{pageName:req.user.name});
    })
})

app.post('/create', (req,res) => {
    let question = req.body.question;
    let answer = req.body.answer;
    let buttonClick = req.body.buttonClick;
    let tableName = `${req.user.name}_quiz${value}`;
    console.log(value);
    if(buttonClick == 'continue'){
        db.query(`INSERT INTO ${tableName}(question, answer) VALUES ("${question}", "${answer}")`, (err, result) => {
            if(err) console.log(err);
            res.render('create',{pageName:req.user.name});
        })
    } else if(buttonClick == 'endquiz') {
        db.query(`INSERT INTO ${tableName}(question, answer) VALUES ("${question}", "${answer}")`, (err, result) => {
            if(err) console.log(err);
            res.render('home-n',{name: req.user.name});
        })
    }
})

// app.get('/user-page/userstyles.css', (req, res) => {
//     res.type('text/css');
//     res.sendFile('D:/Delta/all styles/userstyles.css');
// });

// app.get('/user-page/:name', checkAuthenticated, (req,res) => {
//     const name = req.params.name;
//     console.log(name);
//     res.render('user-page', {pageName:name});
// })

app.get('/user-page/:name', checkAuthenticated, (req, res) => {
    const name = req.params.name;

    if(req.url.endsWith('.css')) {
        res.type('text/css');
        res.sendFile('D:/Delta/all styles/userstyles.css');
    } else if(req.url.endsWith('.png')) {
        res.sendFile('D:/Delta/images/searchicon.png');
    } else {
        let sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'quizzhub' AND table_name LIKE '${name}_quiz%'`;
        db.query(sql, (err, result) => {
            if(err) console.log(err);
            res.render('user-page', { pageName: name, quizList: result });
        })
    }
});

let id;
app.get('/quiz/:id', checkAuthenticated, (req,res) => {
    id = req.params.id;

    if(req.url.endsWith('.css')) {
        res.type('text/css');
        res.sendFile('D:/Delta/all styles/quizstyles.css')
    } else if(req.url.endsWith('.png')) {
        res.sendFile('D:/Delta/images/searchicon.png');
    } else {
        db.query(`SELECT * FROM ${id}`, (err,result) => {
            res.render('quiz', {name: req.user.name, quesAnswer: result});
        })
    }
})

app.post('/', (req,res) => {
    let score = 0;
    db.query(`SELECT * FROM ${id}`, (err,result) => {
        if(err) console.log(err);
        for(let i = 0; i < result.length; i++) {
            let answer = req.body.answer;
            for(let i = 0; i < result.length; i++) {
                if(answer.length === 0) {
                    if(answer === result[i].answer) {
                        score += 20;
                    }
                } else {
                    if(answer[i] === result[i].answer) {
                        score += 20;
                    }
                }
            }
            console.log(score);
        }
        db.query(`UPDATE ${id} SET score = ${score} WHERE id = 1`, (err,result) => {
            if(err) console.log(err);
        })
        res.render('home-n', {name: req.user.name});
    })
})

app.get('/logout', (req, res) => {
    req.logOut((err) => {
        if(err) return next(err);
        res.redirect('/login');
    });
})

function checkAuthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return next();
    } else {
        res.redirect('/login');
    }
}

function checkNotAuthenticated (req, res ,next) {
    if(req.isAuthenticated()) {
        res.redirect('/');
    } else {
        next();
    }
}
