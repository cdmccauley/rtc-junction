// https://www.tutorialspoint.com/webrtc/webrtc_text_demo.html
// started too far ahead

'use strict';

const express = require('express');
const { Server } = require('ws');

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';
const CLIENT = '/client.js';

// const server = express()
//   .use((req, res) => res.sendFile(INDEX, {root: __dirname }))
//   .listen(PORT, () => console.log(`Listening on ${PORT}`));

const server = express();
const path = require('path');

server.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + INDEX));
});

server.get(CLIENT, (req, res) => {
  res.sendFile(path.join(__dirname + CLIENT));
});

server.listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server });

// wss.on('connection', (ws) => {
//   console.log('Client connected');
//   ws.on('close', () => console.log('Client disconnected'));
// });

// setInterval(() => {
//   wss.clients.forEach((client) => {
//     client.send(new Date().toTimeString());
//   });
// }, 1000);

// rtc

// all users
let users = { };

// when user connects
wss.on('connection', (connection) => {
  console.log('User connected');

  // when server gets message from a user
  connection.on('message', (message) => {
    let data;
    // only accept json
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log('Invalid JSON');
      data = {};
    }

    // switching type of the user message
    switch (data.type) {
      // when a user tries to login
      case "login":
        console.log("User logged", data.name);
        // if anyone is logged in with this username then refuse
        if(users[data.name]) {
          sendTo(connection, {
            type: "login",
            success: false
          });
        } else {
          // save user connection on the server
          users[data.name] = connection;
          connection.name = data.name;

          sendTo(connection, {
            type: 'login',
            success: true
          });
        }

        break;

      case "offer":
        // for example userA wants to call userB
        console.log('Sending offer to: ', data.name);

        // if userB exists then send offer details
        var conn = users[data.name];

        if(conn != null) {
          // setting that userA connected with userB
          connection.otherName = data.name;

          sendTo(conn, {
            type: 'offer',
            offer: data.offer,
            name: connection.name
          });
        }

        break;

      case "answer":
        console.log('Sending answer to: ', data.name);
        // fore example userB answers userA
        var conn = users[data.name]

        if(conn != null) {
          connection.otherName = data.name;
          sendTo(conn, {
            type: 'answer',
            answer: data.answer
          });
        }

        break;

      case 'candidate':
        console.log('Sending candidate to: ', data.name);
        var conn = users[data.name];

        if(conn != null) {
          sendTo(conn, {
            type: 'candidate',
            candidate: data.candidate
          });
        }

        break;

      case 'leave':
        console.log('Disconnecting from ', data.name);
        var conn = users[data.name];
        conn.otherName = null;

        // notify the other user so they can disconnect their peer connection
        if(conn != null) {
          sendTo(conn, {
            type: 'leave'
          });
        }

        break;

      default:
        sendTo(connection, {
          type: 'error',
          message: 'Command not found: ' + data.type
        });

        break;
    }
  });

  // when user exits, for example closes a browser window
  // this may help if still in 'offer', 'answer', or 'candidate' state
  connection.on('close', () => {
    if(connection.name) {
      delete users[connection.name];

      if(connection.otherName) {
        console.log('Disconnecting from ', connection.otherName);
        var conn = users[connection.otherName];
        conn.otherName = null;

        if(conn != null) {
          sendTo(conn, {
            type: 'leave'
          });
        }
      }
    }
  });

  connection.send('hello world');

});

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}