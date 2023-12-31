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



async function create_lead (referer, token, name, phone, email) {
  let phone_id = 0
  let email_id = 0

  const fields_data_req = await fetch(`https://${referer}/api/v4/contacts/custom_fields`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  })

  let field_data = await fields_data_req.json()
  field_data = field_data._embedded.custom_fields

  for (let i in field_data){
    if(field_data[i].code == "EMAIL"){
      email_id = field_data[i].id
    }
    if(field_data[i].code == "PHONE"){
      phone_id = field_data[i].id
    }
  }


  const contact = [{
  "first_name": name,
  "custom_fields_values": [
      {
          "field_id": phone_id,
          "values": [
              {
                  "value": phone
              }
          ]
      },

      {
          "field_id": email_id,
          "values": [
              {
                  "value": email
              }
          ]
      }

  
      ]
  }]

  const res_contact = await fetch(`https://${referer}/api/v4/contacts`, {
      method: 'POST',
      body: JSON.stringify(contact),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  })
  
  const contact_json = await res_contact.json()
  const contact_id = contact_json._embedded.contacts[0].id


  const lead = [{
      "name": `Заявка от сравни.ру пользователя ${name}`,
      "_embedded": {
          "contacts": [
              {
                  "id": contact_id
              }
          ]
      }
  }]

  const res_lead = await fetch(`https://${referer}/api/v4/leads`, {
      method: 'POST',
      body: JSON.stringify(lead),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  })
  
  const lead_json = await res_lead.json()
  // const lead_id = lead_json._embedded.contacts[0].id
  

  return lead_json
}



async function getRefreshToken(referer, code) {

  data = {
      "client_id": process.env.AMO_CLIENT_ID,
      "client_secret": process.env.AMO_CLIENT_SECRET,
      "grant_type": "authorization_code",
      "code": code,
      "redirect_uri": "http://vm-f432f7d5.na4u.ru/add_amo"
  }

  const res_token = await fetch(`https://${referer}/oauth2/access_token/`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json'}
  })

  const token_json = await res_token.json()

  return await token_json.refresh_token

}



async function getAccessToken(referer) {

  data = {
      "client_id": process.env.AMO_CLIENT_ID,
      "client_secret": process.env.AMO_CLIENT_SECRET,
      "grant_type": "refresh_token",
      "refresh_token": await db_get_user(referer),
      "redirect_uri": "http://vm-f432f7d5.na4u.ru/add_amo"
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

  try {

    const refresh_token = await getRefreshToken(req.query.referer, req.query.code)

    db_create_user(req.query.referer, refresh_token)
    
    res.json({"status": "OK", "message": refresh_token})

  }

  catch(err) {

    res.json({"status": "ERROR", "message": err})

  }

})


app.get('/sravni/', async (req, res) => {

  try {

    const access_token = await getAccessToken(req.query.referer)
    const lead_data = await create_lead(req.query.referer, access_token, req.query.name, req.query.phone, req.query.email)

    res.json({"status": "OK", "message": lead_data})

  }

  catch(err) {
    res.json({"status": "ERROR", "message": err})

  }
  
})


function main() {
  db_sync()
  app.listen(process.env.APP_PORT, process.env.APP_IP)
}


main()
