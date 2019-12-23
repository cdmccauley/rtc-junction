'use strict';

const path = require('path');
const express = require('express');
const { Server } = require('ws');

const PORT = process.env.PORT || 3000;

// const PUBLIC = '/public';

// const server = express()
//   .use((req, res) => {
//     console.log('request for resource: ', req.originalUrl);
//     res.sendFile(req.originalUrl, {root: __dirname + PUBLIC});
//   })
//   .listen(PORT, () => console.log(`listening on ${PORT}`));

const server = express()
  .use(express.static(path.join(__dirname, 'public')))
  .listen(PORT, () => console.log('listening on port: ', PORT));

const wss = new Server({ server });

var users = {};

wss.on('connection', (ws) => {
  console.log('client connected');

  ws.on('message', (message) => {
    var data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log('invalid json');
      data = {};
    }
    switch(data.type) {
      case 'login':
        console.log('user login: ', data.name);
        if (users[data.name]) {
          sendTo(ws, {
            type: 'login',
            success: false
          });
        } else {
          users[data.name] = ws;
          ws.name = data.name;
          sendTo(ws, {
            type: 'login',
            success: true
          });
        }
        break;
      case 'offer':
        console.log('sending offer to: ', data.name);
        var conn = users[data.name];
        if(conn != null) {
          ws.otherName = data.name;
          sendTo(conn, {
            type: 'offer',
            offer: data.offer,
            name: ws.name
          });
        }
        break;
      case 'answer':
        console.log('sending answer to: ', data.name);
        var conn = users[data.name];
        if(conn != null) {
          ws.otherName = data.name;
          sendTo(conn, {
            type: 'answer',
            answer: data.answer,
            name: ws.name // added for multi
          });
        }
        break;
      case 'candidate':
        console.log('sending candidate to: ', data.name);
        var conn = users[data.name];
        if(conn != null) {
          sendTo(conn, {
            type: 'candidate',
            candidate: data.candidate,
            name: ws.name // added for multi
          });
        }
        break;
      // case 'leave':
      //   console.log('disconnecting from: ', data.name);
      //   var conn = users[data.name];
      //   // conn.otherName = null; // causing server crash
      //   if(conn != null) { // causes rtc datachannel to close if connected
      //     sendTo(conn, {
      //       type: 'leave'
      //     });
      //   }
      //   break;
      default:
        sendTo(ws, {
          type: 'error',
          message: 'command not found: ' + data.type
        });
        break;
    }
  });

  ws.on('close', () => {
    console.log('client disconnected')
    if(ws.name) {
      delete users[ws.name];
      if(ws.otherName) {
        console.log('disconnecting from: ', ws.otherName);
        var conn = users[ws.otherName];
        // conn.otherName = null; // causing server crash
        // if(conn != null) { // causes rtc datachannel to close if connected
        //   sendTo(conn, {
        //     type: 'leave'
        //   });
        // }
      }
    }
  });

  sendTo(ws, {
    type: 'log',
    message: 'connected to server'
  });

});

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}

var keepAlive = {
  type: 'log',
  message: 'ping from server'
}

// keepalive
setInterval(() => {
  wss.clients.forEach((client) => {
    // client.send(new Date().toTimeString());
    sendTo(client, keepAlive);
  });
}, 50000);