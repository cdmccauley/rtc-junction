let HOST = location.origin.replace(/^http/, 'ws')
let ws = new WebSocket(HOST);

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
      handleAnswer(data.answer, data.name);
      break;
    case 'candidate':
      handleCandidate(data.candidate, data.name);
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
  if (name) {
    message.sender = name;
  }
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


var rtcPeerConns = {};
var dataChannels = {};

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
    alert('username already in use, try another username');
  } else {
    loginPage.style.display = 'none';
    callPage.style.display = 'block';
  }
};

callBtn.addEventListener('click', () => {
  var callToUsername = callToUsernameInput.value;

  if(callToUsername.length > 0) {

    var configuration = {
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    var newRtcPeerConn = new RTCPeerConnection(configuration);

    newRtcPeerConn.onicecandidate = (event) => {
      console.log('onicecandidate');
      if(event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    newRtcPeerConn.ondatachannel = (event) => {
      dataChannels[callToUsername] = { channel: event.channel };
    };

    openDataChannel(newRtcPeerConn);

    newRtcPeerConn.oniceconnectionstatechange = () => {
      console.log('ICE connection state change: ', newRtcPeerConn.iceConnectionState);
    }

    connectedUser = callToUsername;
    newRtcPeerConn.createOffer((offer) => {
      newRtcPeerConn.setLocalDescription(offer);
      send({
        type: 'offer',
        offer: offer,
      });
    }, (error) => {
      console.log('create offer error: ', error);
      alert('error creating offer');
    });

    rtcPeerConns[connectedUser] = { conn: newRtcPeerConn };
  }
});

function handleOffer(offer, name) {
  connectedUser = name;

  var configuration = {
    'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
  };

  var offerRtcPeerConn = new RTCPeerConnection(configuration);

  offerRtcPeerConn.onicecandidate = (event) => {
    console.log('onicecandidate');
    if(event.candidate) {
      send({
        type: 'candidate',
        candidate: event.candidate,
      });
    }
  };

  offerRtcPeerConn.ondatachannel = (event) => {
    dataChannels[connectedUser] = { channel: event.channel };
  };

  openDataChannel(offerRtcPeerConn, connectedUser);

  offerRtcPeerConn.oniceconnectionstatechange = () => {
    console.log('ICE connection state change: ', offerRtcPeerConn.iceConnectionState);
  }
  offerRtcPeerConn.setRemoteDescription(new RTCSessionDescription(offer));
  offerRtcPeerConn.createAnswer((answer) => {
    offerRtcPeerConn.setLocalDescription(answer);
    send({
      type: 'answer',
      answer: answer,
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });

  rtcPeerConns[connectedUser] = { conn: offerRtcPeerConn };
};

function handleAnswer(answer, senderName) {
  var answerPeerConn = rtcPeerConns[senderName].conn
  answerPeerConn.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleCandidate(candidate, senderName) {
  var candPeerConn = rtcPeerConns[senderName].conn
  candPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
};

function openDataChannel(peerConn, openName) {
  newDataChannel = peerConn.createDataChannel('channel' + Object.keys(dataChannels).length, {reliable: true});
  
  console.log('data channel created: ', newDataChannel);

  newDataChannel.onerror = (error) => {
    console.log('datachannel error: ', error);
  }

  newDataChannel.onmessage = (event) => {
    console.log('new message received: ', event.data);
    chatArea.innerHTML += connectedUser + ': ' + event.data + '<br />';
  };

  newDataChannel.onopen = () => {
    dataStart = new Date();
    console.log('datachannel open');
    // kill server connection
  }

  newDataChannel.onclose = () => {
    dataEnd = new Date();
    console.log('datachannel is closed. duration: ', dataEnd - dataStart, 'ms');
  };

  dataChannels[openName] = { channel: newDataChannel };
  
};

hangUpBtn.addEventListener('click', () => {
  send({
    type: 'leave'
  });
  handleLeave();
})

function handleLeave() {
  // connectedUser = null;
  // rtcPeerConn.close();
  // rtcPeerConn.onicecandidate = null;
  console.log('TODO: handleLeave()');
};

sendMsgBtn.addEventListener('click', (event) => {
  var val = msgInput.value;
  chatArea.innerHTML += name + ': ' + val + '<br />';
  // dataChannel.send(val);
  for(let channel in dataChannels) {
    dataChannels[channel].channel.send(val);
  }
  msgInput.value = '';
});