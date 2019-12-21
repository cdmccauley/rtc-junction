let HOST = location.origin.replace(/^http/, 'ws')
let ws = new WebSocket(HOST);
let el;

var name;
var connectedUser;

ws.onopen = () => {
  console.log('connected to signaling server');
}

ws.onmessage = (event) => {
  console.log('received message: ', event.data);

  var data = JSON.parse(event.data);

  switch(data.type) {
    case 'login':
      handleLogin(data.success);
      break;
    case 'offer':
      handleOffer(data.offer, data.name);
      break;
    case 'answer':
      handleAnswer(data.answer);
      break;
    case 'candidate':
      handleCandidate(data.candidate);
      break;
    case 'leave':
      handleLeave();
      break;
    case 'log':
      console.log(data.message);
    default:
      break;
  }
  // el = document.getElementById('server-time');
  // el.innerHTML = 'Server time: ' + event.data;
};

ws.onerror = (err) => {
  console.log('error: ', err);
}

function send(message) {
  if(connectedUser) {
    message.name = connectedUser;
  }
  ws.send(JSON.stringify(message));
};

// ui

var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginBtn = document.querySelector('#loginBtn');

var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');

var hangUpBtn = document.querySelector('#hangUpBtn');
var msgInput = document.querySelector('#msgInput');
var sendMsgBtn = document.querySelector('#sendMsgBtn');

var chatArea = document.querySelector('#chatarea');
var yourConn;
var dataChannel;
callPage.style.display = 'none';

loginBtn.addEventListener('click', (event) => {
  name = usernameInput.value;

  if(name.length > 0) {
    send({
      type: 'login',
      name: name
    });
  }
});

function handleLogin(success) {
  if(success === false) {
    alert('username alread in use, try another username');
  } else {
    loginPage.style.display = 'none';
    callPage.style.display = 'block';

    var configuration = {
      'iceServers': [{'url': 'stun.stun2.1.google.com:19302'}]
    };

    yourConn = new webkitRTCPeerConnection(configuration, {optional: [{RtpDataChannels: true}]});

    // setup ice handling
  }
}