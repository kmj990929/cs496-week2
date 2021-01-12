/*jslint devel: true */ 
/* eslint-disable no-console */ 
/*eslint no-undef: "error"*/ 
/*eslint-env node*/
//IP주소가 변화하면 안드로이드 앱 내에 있는 url 주소도 바꿔주어야 정상 동작하기시작함!

var express = require('express');
var http = require('http');
var bodyParser= require('body-parser');
var app = express();
var crypto = require('crypto');

var mongoose = require('mongoose');
const { response } = require('express');
const { Logger } = require('mongodb');

var app_id = '250275769846485';
var app_secret = 'ec6cb4d7b98d93195a9afa62191458fe';

mongoose.connect("mongodb://localhost/myTable", { useNewUrlParser: true, useUnifiedTopology: true })
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(callback) {
    console.log('DB가 열렸습니다.');
});

app.set('port',process.env.PORT || 3000);
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

var userSchema = mongoose.Schema({
    id : String,
    password : String,
    salt : String,
    name : String,
    contactList : [new mongoose.Schema({name: String, number: String}, {_id: false})],
    gallery : [new mongoose.Schema({imageBitmap: String})],
    capture : [new mongoose.Schema({captureUri: String, webToonTitle: String})],
    favorite : [new mongoose.Schema({title: String}, {_id: false})],
    capturedWebtoon : [new mongoose.Schema({webToonTitle: String}, {_id:false})]
});

userSchema.methods.addfavorite = function(info){
  this.favorite.push({title: info.title});
  console.log(this.favorite)
  return this.save()
}
userSchema.methods.removefavorite = function(info){
  this.favorite.pull({title: info.title});
  console.log(this.favorite)
  return this.save()
}

userSchema.methods.addContact = function(info){
  this.contactList.push({name: info.name, number: info.number});
  console.log(this.contactList)
  return this.save()
}
userSchema.methods.removeContact = function(info){
  this.contactList.pull({name: info.name, number: info.number});
  console.log(this.contactList)
  return this.save()
}

userSchema.methods.addImage = function(info){
  this.gallery.push({imageBitmap: info.imageBitmap});
  return this.save()
}

userSchema.methods.removeImage = function(info){
  console.log(info)
  this.gallery.pull({_id: info._id});
  return this.save()
}

userSchema.methods.addCapture = function(info){
  this.capture.push({captureUri: info.captureUri, webToonTitle: info.webToonTitle});
  return this.save()
}

userSchema.methods.addCapturedWebtoon = function(info){
  this.capturedWebtoon.push({webToonTitle: info.webToonTitle});
  return this.save()
}

app.set('port',process.env.PORT || 3000);
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

//일반 회원가입의 경우 -> 비밀번호 암호화해서 저장
app.post('/signup', (req, res) => {
    console.log('signUp');
    var signUpSuccess = "Fail";

    var NewUser = mongoose.model('user', userSchema);
    let salt = Math.round((new Date().valueOf() * Math.random())) + "";
    let hashPassword = crypto.createHash("sha512").update(req.body.password + salt).digest("hex")

    NewUser.find({id: req.body.id}, function(err, notice_dt) {
      if (err) {
          console.log("signup error")
        res.send(err);
      } else{
        if (notice_dt.length == 0) {
          var newUser = new NewUser({id : req.body.id, password : hashPassword, salt : salt, name : req.body.name});
          newUser.save(function (err, newUser) {
              if (err) return console.error(err);
          })
          signUpSuccess = "Success";
          res.write(signUpSuccess);
          res.end();
        } else {
          console.log("같은 id의 회원 존재")
          signUpSuccess = "Fail/duplicate";
          res.write(signUpSuccess);
          res.end();
        }
      }
    })
 });


 //일반 로그인의 경우 -> 입력된 비밀번호 암호화해서 비교 후 저장
app.post('/login', (req, res) => {
    console.log('signIn');
    var result = {
      'loginSuccess' : "Fail",
      'uniqueId' : ""
    };
    
    var NewUser = mongoose.model('user', userSchema);
    NewUser.find({id: req.body.id}, function(err, notice_dt) {
      if (err) {
        res.send(err);
      } else{
        if (notice_dt.length == 0) {
          console.log("id pw 정보 없음");
          res.json(result)
        } else {
          var dbuser = notice_dt[0]
          var dbuserPassword = dbuser.password
          var salt = dbuser.salt
          var currentPassword = req.body.password
          let hashPassword = crypto.createHash("sha512").update(currentPassword + salt).digest("hex")
          if (hashPassword == dbuserPassword) {
            console.log("login 성공");
            result.loginSuccess = 'Success'
            result.uniqueId = dbuser._id
            res.json(result)
          }
          else{
            console.log("login 실패");
            res.json(result)
          }
        }
      }
    })
});

 //페북 로그인의 경우 -> token 페북 서버로 보내서 사용자 id 받아오기. 그거랑 사용자 이름 저장하기
app.post('/facebookLogin', (req, res) => {
  console.log('facebookLogin');
  var result = {
    'loginSuccess' : "Fail",
    'uniqueId' : ""
  };

  //req.body.token에서 사용자 id 받아오기. 
  var userId = req.body.user_id; // 지금은 임시로 token으로 정의
  var userName = req.body.user_name;
  /*
  const verifyUri = "https://graph.facebook.com/debug_token" 
  params_debug_token = {
    "input_token" : req.body.token,
    "access_token" : '${app_id}|${app_secret}',
  }

  var requestOptions = {
    uri : verifyUri,
    qs : params_debug_token,
  }

  return new Promise((resolve, reject) => {
    request.get(requestOptions, (err, res,body) => {
      var jsonBody = JSON.parse(res.body)

      if (!err && res.statusCode == 200 && jsonBody.data.user_id) {
        console.warn(jsonBody)
        console.log(jsonBody.data.user_id)
        resolve(jsonBody.data.user_id)
    }
    else if(!err && res.statusCode == 200) {
        reject({err: jsonBody.data.error, statusCode: 190})
    }
    else {
        reject({err, statusCode: 404})
    }
  })})*/


  var NewUser = mongoose.model('user', userSchema);
  NewUser.find({id: userId}, function(err, notice_dt) {
    if (err) {
        console.log("signup error")
      res.send(err);
    } else{
      if (notice_dt.length == 0) { //처음 페북 로그인한 회원
        var NewUser = mongoose.model('user', userSchema);
        var newUser = new NewUser({id : userId, name : userName});
        newUser.save(function (err, newUser) {
          if (err) return console.error(err);
        })
        console.log(newUser)
        result.uniqueId = newUser._id
        result.loginSuccess = "Success"
        res.json(result)
      } else { //이미 가입한 회원
        result.uniqueId = notice_dt[0]._id
        result.loginSuccess = "Success"
        res.json(result)
      }
    }
  })
});



//image save
 app.post('/saveImage', (req,res) => {
   console.log("saveImage")
   console.log("id = " + req.body._id)
   var Success = "Fail";

   var NewUser = mongoose.model('user', userSchema);
   NewUser.find({_id: req.body._id}, function(err, notice_dt) {
    if (err) {
      console.log("signup error")
      res.send(err);
    } else{
      if (notice_dt.length != 0) {
        console.log("save image success")
        var No = notice_dt[0].gallery.length;
        notice_dt[0].addImage({imageBitmap: req.body.imageBitmap}, function(err, result){
          if(err){
            throw err;
          }
        })
        Success = "Success";
        res.write(Success);
        res.end();
      } else {
        res.write(Success);
        res.end();
      }
    }
  })
 })

 //image read
 app.post('/getImages', (req,res) => {
   console.log("getImage")
   console.log("id = " + req.body._id)

   var NewUser = mongoose.model('user', userSchema);
   NewUser.find({_id: req.body._id}, function(err, notice_dt) {
    if (err) {
      console.log("signup error")
      res.send(err);
    } else{
      res.json(notice_dt[0])
    }
  })
 })

  //image remove
  app.post('/deleteImage', (req,res) => {
    console.log("deleteImage");
    var result = {
        'Success' : 'Fail'
    };
    var NewUser = mongoose.model('user', userSchema)
    console.log("uid is "+req.body.uid)
    NewUser.find({_id: req.body.uid}, function(err, notice_dt){
        if(err){
            console.log("image delete error")
            res.send(err);
        }else{
          console.log("notice_dt[0] is ")
          console.log(notice_dt[0])
          console.log("req.body is ")
          console.log(req.body)
          console.log("now find")
            if(notice_dt[0].length == 0){
                res.json(result)
            }else{
              notice_dt[0].removeImage({_id: req.body._id}, function(err, result){
                if(err){
                  throw err;
                }else{
                  console.log("remove photo ")
                  console.log(req.body._id)
                }
              })
              console.log("after image remove")
                //notice_dt[0].gallery.pull(req.body._id)
                result.Success = "Success"
                res.json(result)
            }
        }
    });
  })


//contact
app.post('/get_contact', (req, res) => {
  console.log("get_contact")
  var NewUser = mongoose.model('user', userSchema)
  console.log(req.body._id)
  NewUser.find({_id: req.body._id}, function(err, notice_dt){
    if(err){
      console.log("error occured")
      res.send(err)
    }else{
      console.log("before return")
      console.log(notice_dt[0].contactList)
      res.json(notice_dt[0])
    }
  });
});

app.post('/add_contact', (req, res) => {
    console.log("add_contact");
    var result = {
        'Success' : 'Fail'
    };
    var NewUser = mongoose.model('user', userSchema)
    console.log(req.body._id)
    NewUser.find({_id: req.body._id}, function(err, notice_dt){
        if(err){
            console.log("error occured")
            res.send(err);
        }else{
          console.log("before push")
          console.log(req.body)
          notice_dt[0].addContact({name: req.body.name, number: req.body.number}, function(err, result){
            if(err){
              throw err;
            }
            console.log(result)
          })
          console.log("after push")
          result.Success = "Success"
          res.json(result)
        }
    });
});
app.post('/delete_contact', (req, res) => {
    console.log("delete_contact");
    var result = {
        'Success' : 'Fail'
    };
    var NewUser = mongoose.model('user', userSchema)
    console.log("uid is "+req.body._id)
    NewUser.find({_id: req.body._id}, function(err, notice_dt){
        if(err){
            console.log("signup error")
            res.send(err);
        }else{
            if(notice_dt[0].length == 0){
                res.json(result)
            }else{
                result.Success = 'Success'
                console.log("before pull")
                notice_dt[0].removeContact({name: req.body.name, number: req.body.number}, function(err, result){
                  if(err){
                    throw err;
                  }
                })
                console.log("after log")
                result.Success = "Success"
                res.json(result)
            }
        }
    });
});

//favorite
app.post('/get_favorite', (req, res) => {
  console.log("get_favorite")
  var NewUser = mongoose.model('user', userSchema)
  console.log(req.body._id)
  NewUser.find({_id: req.body._id}, function(err, notice_dt){
    if(err){
      console.log("error occured")
      res.send(err)
    }else{
      console.log("before return")
      console.log(notice_dt[0].favorite)
      res.json(notice_dt[0])
    }
  });
});

app.post('/add_favorite', (req, res) => {
  console.log("add_favorite");
  var result = {
      'Success' : 'Fail'
  };
  var NewUser = mongoose.model('user', userSchema)
  console.log(req.body._id)
  NewUser.find({_id: req.body._id}, function(err, notice_dt){
      if(err){
          console.log("error occured")
          res.send(err);
      }else{
        console.log("before push")
        console.log(req.body)
        notice_dt[0].addfavorite({title: req.body.title}, function(err, result){
          if(err){
            throw err;
          }
          console.log(result)
        })
        console.log("after push")
        result.Success = "Success"
        res.json(result)
      }
  });
});
app.post('/remove_favorite', (req, res) => {
  console.log("remove_favorite");
  var result = {
      'Success' : 'Fail'
  };
  var NewUser = mongoose.model('user', userSchema)
  console.log("uid is "+req.body._id)
  NewUser.find({_id: req.body._id}, function(err, notice_dt){
      if(err){
          console.log("signup error")
          res.send(err);
      }else{
          if(notice_dt[0].length == 0){
              res.json(result)
          }else{
              result.Success = 'Success'
              console.log("before pull")
              notice_dt[0].removefavorite({title: req.body.title}, function(err, result){
                if(err){
                  throw err;
                }
              })
              console.log("after log")
              result.Success = "Success"
              res.json(result)
          }
      }
  });
});


//save ScreenShot
app.post('/saveScreenShot', (req,res) => {
  console.log("saveScreenShot")
  console.log("id = " + req.body._id)
  var Success = "Fail";

  var NewUser = mongoose.model('user', userSchema);
  NewUser.find({_id: req.body._id}, function(err, notice_dt) {
   if (err) {
     console.log("saveScreenShot error")
     res.send(err);
   } else{
     if (notice_dt.length != 0) {
       console.log("save ScreenShot success")
       console.log(req.body.captureUri)
       notice_dt[0].addCapture({captureUri: req.body.captureUri, webToonTitle: req.body.webToonTitle}, function(err, result){
         if(err){
           throw err;
         }
       })
       
      //한번도 캡쳐 안한 웹툰을 캡쳐했을 경우
       var step;
       var checked = false;
       for (step=0; step<notice_dt[0].capturedWebtoon.length; step++) {
         if (notice_dt[0].capturedWebtoon[step].webToonTitle == req.body.webToonTitle) {
            checked = true;
         }
       }
       if (checked == false) {
          notice_dt[0].addCapturedWebtoon({webToonTitle: req.body.webToonTitle}, function(err, result) {
            if (err) {
              throw err;
            }
          })
          notice_dt[0].addImage({imageBitmap: req.body.webToonThumbnailBitmap}, function(err, result) {
            if (err) {
              throw err;
            }
          })
         }
       Success = "Success";
       res.write(Success);
       res.end();
     } else {
       res.write(Success);
       res.end();
     }
   }
 })
})

//screenshot read
app.post('/getScreenShot', (req,res) => {
  console.log("getScreenShot")
  console.log("id = " + req.body._id)

  var NewUser = mongoose.model('user', userSchema);
  NewUser.find({_id: req.body._id}, function(err, notice_dt) {
   if (err) {
     console.log("signup error")
     res.send(err);
   } else{
     res.json(notice_dt[0])
   }
 })
})

var server = http.createServer(app).listen(app.get('port'),function(){
   console.log("익스프레스로 웹 서버를 실행함 : "+ app.get('port')); 
});