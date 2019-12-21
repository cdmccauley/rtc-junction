'use strict';

const express = require('express');
const { Server } = require('ws');

const PORT = process.env.PORT || 3000;
const INDEX = '/public/index.html';
const CLIENT = '/public/client.js';

const server = express()
  .use((req, res) => {
    switch (req.originalUrl) {
      case '/':
        res.sendFile(INDEX, {root: __dirname});
        break;
      case '/client.js':
        res.sendFile(CLIENT, {root: __dirname});
        break;
      default:
        break;
    }
    
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server });

var users = {};

wss.on('connection', (ws) => {
  console.log('Client connected');

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
            answer: data.answer
          });
        }
        break;
      case 'candidate':
        console.log('sending candidate to: ', data.name);
        var conn = users[data.name];
        if(conn != null) {
          sendTo(conn, {
            type: 'candidate',
            candidate: data.candidate
          });
        }
        break;
      case 'leave':
        console.log('disconnecting from: ', data.name);
        var conn = users[data.name];
        conn.otherName = null;
        if(conn != null) {
          sendTo(conn, {
            type: 'leave'
          });
        }
        break;
      default:
        sendTo(ws, {
          type: 'error',
          message: 'command not found: ' + data.type
        });
        break;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected')
    if(ws.name) {
      delete users[ws.name];
      if(ws.otherName) {
        console.log('disconnecting from: ', connection.otherName);
        var conn = users[ws.otherName];
        conn.otherName = null;
        if(conn != null) {
          sendTo(conn, {
            type: 'leave'
          });
        }
      }
    }
  });

  ws.send('hello world');

});

setInterval(() => {
  wss.clients.forEach((client) => {
    client.send(new Date().toTimeString());
  });
}, 1000);

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}