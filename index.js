require('dotenv').config();

const fetch = require('node-fetch');

const express = require('express')
const app = express()


var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { 
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};


const Sequelize = require("sequelize");
const sequelize = new Sequelize(process.env.DBNAME, process.env.DBUSER, process.env.DBPASS, {
  dialect: "mysql",
  host: process.env.DBHOST,
  define: {
    timestamps: false
  }
});

const User = sequelize.define("user", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  referer: {
    type: Sequelize.STRING,
    allowNull: false
  },
  refresh_token: {
    type: Sequelize.TEXT,
    allowNull: false
  }
});




function db_sync () {
  sequelize.sync().then(result => {
  })
  .catch(err => console.log(err));
}


function db_create_user (referer, refresh_token) {
  User.create({
    referer: referer,
    refresh_token: refresh_token
  }).then(res => {
    return true
  }).catch(err => console.log(err));
}


function db_update_user (referer, refresh_token) {
  User.update({ refresh_token: refresh_token }, {
    where: {
      referer: referer
    }
  }).then(res => {
    return true
  });
}

async function db_get_user (referer) {
  try {
    user = await User.findOne({where: {referer: referer}})
    return user.refresh_token
  }
  catch (err) {
    console.log(err);
  }
}



async function getRefreshToken(referer, code) {

  data = {
      "client_id": process.env.AMO_CLIENT_ID,
      "client_secret": process.env.AMO_CLIENT_SECRET,
      "grant_type": "authorization_code",
      "code": code,
      "redirect_uri": referer
  }

  const res_token = await fetch(`https://${referer}/oauth2/access_token/`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json'}
  })

  const token_json = await res_token.json()

  console.log(token_json)

  db_update_user(referer, await token_json.refresh_token)

}



async function getAccessToken(referer) {

  data = {
      "client_id": process.env.AMO_CLIENT_ID,
      "client_secret": process.env.AMO_CLIENT_SECRET,
      "grant_type": "refresh_token",
      "refresh_token": await db_get_user(referer),
      "redirect_uri": referer
  }

  const res_token = await fetch(`https://${referer}/oauth2/access_token/`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json'}
  })

  const token_json = await res_token.json()

  db_update_user(referer, await token_json.refresh_token)

  return await token_json.access_token

}



app.get('/add_amo/', async (req, res) => {

  const refresh_token = await getRefreshToken(req.query.referer, req.query.code)

  db_create_user(req.query.referer, refresh_token)
  
  res.json({"status": "ok"})
  
})


function main() {
  db_sync()
  app.listen(process.env.APP_PORT, process.env.APP_IP)
}


main()
