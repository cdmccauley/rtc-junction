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

let users = {};

wss.on('connection', (ws) => {
  console.log('client connected');

  ws.on('message', (message) => {
    let data;
    let conn;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log('invalid json');
      data = { error: 'invalid json' };
    }
    switch(data.type) {
      case 'login':
        // console.log('user login: ', data.name);
        console.log('user login: ', data.sender);
        // if (users[data.name]) {
        if (users[data.sender]) {
          sendTo(ws, {
            type: 'login',
            success: false
          });
        } else {
          // users[data.name] = ws;
          users[data.sender] = ws;
          // ws.name = data.name;
          ws.name = data.sender;
          sendTo(ws, {
            type: 'login',
            success: true
          });
        }
        break;
      case 'offer':
        // console.log('sending offer to: ', data.name);
        console.log('sending offer to: ', data.receiver);
        // conn = users[data.name];
        conn = users[data.receiver];
        if(conn != null) {
          // ws.otherName = data.name;
          sendTo(conn, {
            type: 'offer',
            offer: data.offer,
            // name: ws.name
            sender: ws.name
          });
        }
        break;
      case 'answer':
        // console.log('sending answer to: ', data.name);
        console.log('sending answer to: ', data.receiver);
        // conn = users[data.name];
        conn = users[data.receiver];
        if(conn != null) {
          // ws.otherName = data.name;
          sendTo(conn, {
            type: 'answer',
            answer: data.answer,
            // name: ws.name // added for multi
            sender: ws.name
          });
        }
        break;
      case 'candidate':
        // console.log('sending candidate to: ', data.name);
        console.log('sending candidate to: ', data.receiver, ' from: ', data.sender);
        // conn = users[data.name];
        conn = users[data.receiver];
        if(conn != null) {
          sendTo(conn, {
            type: 'candidate',
            candidate: data.candidate,
            // name: ws.name // added for multi
            sender: ws.name
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
      // if(ws.otherName) {
      //   console.log('disconnecting from: ', ws.otherName);
      //   let conn = users[ws.otherName];
        // conn.otherName = null; // causing server crash
        // if(conn != null) { // causes rtc datachannel to close if connected
        //   sendTo(conn, {
        //     type: 'leave'
        //   });
        // }
      // }
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

let keepAlive = {
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