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
      // handleAnswer(data.answer);
      handleAnswer(data.answer, data.name);
      break;
    case 'candidate':
      // handleCandidate(data.candidate);
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


// var rtcPeerConn;
var rtcPeerConns = {};
// var dataChannel;
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

    // moved to call btn handler
    
    // end moved to call btn handler

  }
};

callBtn.addEventListener('click', () => {
  var callToUsername = callToUsernameInput.value;

  if(callToUsername.length > 0) {

    // from handleLogin
    var configuration = {
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    // rtcPeerConn = new RTCPeerConnection(configuration);
    var newRtcPeerConn = new RTCPeerConnection(configuration);

    // rtcPeerConn.onicecandidate = (event) => {
    newRtcPeerConn.onicecandidate = (event) => {
      console.log('onicecandidate');
      if(event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    // rtcPeerConn.ondatachannel = (event) => {
    newRtcPeerConn.ondatachannel = (event) => {
      // dataChannel = event.channel;
      dataChannels[callToUsername] = { channel: event.channel };
    };

    // openDataChannel();
    openDataChannel(newRtcPeerConn);

    // rtcPeerConn.oniceconnectionstatechange = (event) => {
    newRtcPeerConn.oniceconnectionstatechange = (event) => {
      // console.log('ICE connection state change: ', rtcPeerConn.iceConnectionState);
      console.log('ICE connection state change: ', event);
    }

    // rtcPeerConns.push(newRtcPeerConn);
    // end from handleLogin

    connectedUser = callToUsername;
    // rtcPeerConn.createOffer((offer) => {
    newRtcPeerConn.createOffer((offer) => {
      // rtcPeerConn.setLocalDescription(offer);
      newRtcPeerConn.setLocalDescription(offer);
      send({
        type: 'offer',
        offer: offer,
      });
    }, (error) => {
      console.log('create offer error: ', error);
      alert('error creating offer');
    });

    // inserted after moving code from handleLogin
    rtcPeerConns[connectedUser] = { conn: newRtcPeerConn };
  }
});

function handleOffer(offer, name) {
  connectedUser = name;

  // from handleLogin
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

  // openDataChannel();
  openDataChannel(offerRtcPeerConn, connectedUser);

  offerRtcPeerConn.oniceconnectionstatechange = (event) => {
    console.log('ICE connection state change: ', event);
  }
  // end from handleLogin

  // rtcPeerConn.setRemoteDescription(new RTCSessionDescription(offer));
  offerRtcPeerConn.setRemoteDescription(new RTCSessionDescription(offer));
  // rtcPeerConn.createAnswer((answer) => {
  offerRtcPeerConn.createAnswer((answer) => {
    // rtcPeerConn.setLocalDescription(answer);
    offerRtcPeerConn.setLocalDescription(answer);
    send({
      type: 'answer',
      answer: answer,
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });

  // inserted after code from handleLogin
  rtcPeerConns[connectedUser] = { conn: offerRtcPeerConn };
};

function handleAnswer(answer, senderName) {
  // rtcPeerConn.setRemoteDescription(new RTCSessionDescription(answer));
  var answerPeerConn = rtcPeerConns[senderName].conn
  answerPeerConn.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleCandidate(candidate, senderName) {
  // rtcPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
  var candPeerConn = rtcPeerConns[senderName].conn
  candPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
};

function openDataChannel(peerConn, openName) {
  // dataChannel = rtcPeerConn.createDataChannel('channel1', {reliable: true});
  newDataChannel = peerConn.createDataChannel('channel' + Object.keys(dataChannels).length, {reliable: true});
  
  // console.log('data channel created: ', dataChannel);
  console.log('data channel created: ', newDataChannel);

  // dataChannel.onerror = (error) => {
  newDataChannel.onerror = (error) => {
    console.log('datachannel error: ', error);
  }

  // dataChannel.onmessage = (event) => {
  newDataChannel.onmessage = (event) => {
    console.log('new message received: ', event.data);
    chatArea.innerHTML += connectedUser + ': ' + event.data + '<br />';
  };

  // dataChannel.onopen = () => {
  newDataChannel.onopen = () => {
    dataStart = new Date();
    console.log('datachannel open');
    // kill server connection
  }

  // dataChannel.onclose = () => {
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
    // console.log('dataChannels: ', dataChannels);
    // console.log('channel: ', channel);
    // console.log('dataChannels[channel]: ', dataChannels[channel]);
    dataChannels[channel].channel.send(val);
  }
  msgInput.value = '';
});