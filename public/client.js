let HOST = location.origin.replace(/^http/, 'ws')
let ws = new WebSocket(HOST);
let el;

var name;
var connectedUser;

let dataStart;
let dataEnd;

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
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    yourConn = new RTCPeerConnection(configuration);

    yourConn.onicecandidate = (event) => {
      console.log('onicecandidate');
      if(event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    yourConn.ondatachannel = (event) => {
      dataChannel = event.channel;
    };

    openDataChannel();

    yourConn.oniceconnectionstatechange = (event) => {
      console.log('ICE connection state change: ', yourConn.iceConnectionState);
    }
  }
};

callBtn.addEventListener('click', () => {
  var callToUsername = callToUsernameInput.value;

  if(callToUsername.length > 0) {
    connectedUser = callToUsername;
    yourConn.createOffer((offer) => {
      yourConn.setLocalDescription(offer);
      send({
        type: 'offer',
        offer: offer
      });
    }, (error) => {
      console.log('create offer error: ', error);
      alert('error creating offer');
    });
  }
});

function handleOffer(offer, name) {
  connectedUser = name;
  yourConn.setRemoteDescription(new RTCSessionDescription(offer));
  yourConn.createAnswer((answer) => {
    yourConn.setLocalDescription(answer);
    send({
      type: 'answer',
      answer: answer
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });
};

function handleAnswer(answer) {
  yourConn.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleCandidate(candidate) {
  yourConn.addIceCandidate(new RTCIceCandidate(candidate));
};

function openDataChannel() {

  dataChannel = yourConn.createDataChannel('channel1', {reliable: true});
  
  console.log('data channel created: ', dataChannel);

  dataChannel.onerror = (error) => {
    console.log('datachannel error: ', error);datachannel
  }

  dataChannel.onmessage = (event) => {
    console.log('new message received: ', event.data);
    chatArea.innerHTML += connectedUser + ': ' + event.data + '<br />';
  };

  dataChannel.onopen = () => {
    dataStart = new Date();
    console.log('datachannel open');
    // kill server connection
  }

  dataChannel.onclose = () => {
    dataEnd = new Date();
    console.log('datachannel is closed. duration: ', dataEnd - dataStart, 'ms');
  };
  
};

hangUpBtn.addEventListener('click', () => {
  send({
    type: 'leave'
  });
  handleLeave();
})

function handleLeave() {
  connectedUser = null;
  yourConn.close();
  yourConn.onicecandidate = null;
};

sendMsgBtn.addEventListener('click', (event) => {
  var val = msgInput.value;
  chatArea.innerHTML += name + ': ' + val + '<br />';
  dataChannel.send(val);
  msgInput.value = '';
});