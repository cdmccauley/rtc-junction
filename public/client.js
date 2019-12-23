/*
 *  connect to signal server
 */
let HOST = location.origin.replace(/^http/, 'ws')
let signalServer = new WebSocket(HOST);

signalServer.onopen = () => {
  console.log('connected to signaling server');
}

signalServer.onmessage = (event) => {
  console.log('received message: ', event.data);

  let data = JSON.parse(event.data);

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

signalServer.onerror = (err) => {
  console.log('error: ', err);
}

/*
 * 
 */

let name;
let peerName;

let rtcPeerConns = {};
let dataChannels = {};

let dataStart;
let dataEnd;

function send(message) {
  if (name) {
    message.sender = name;
  }
  if(peerName) {
    message.name = peerName;
  }
  signalServer.send(JSON.stringify(message));
};

// ui

let loginPage = document.querySelector('#loginPage');
let usernameInput = document.querySelector('#usernameInput');
let loginBtn = document.querySelector('#loginBtn');

let callPage = document.querySelector('#callPage');
let callToUsernameInput = document.querySelector('#callToUsernameInput');
let callBtn = document.querySelector('#callBtn');

let hangUpBtn = document.querySelector('#hangUpBtn');
let msgInput = document.querySelector('#msgInput');
let sendMsgBtn = document.querySelector('#sendMsgBtn');

let chatArea = document.querySelector('#chatarea');

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
  let callToUsername = callToUsernameInput.value;

  if(callToUsername.length > 0) {

    let configuration = {
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    let newRtcPeerConn = new RTCPeerConnection(configuration);

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

    openDataChannel(newRtcPeerConn, callToUsername);

    newRtcPeerConn.oniceconnectionstatechange = () => {
      console.log('ICE connection state change: ', newRtcPeerConn.iceConnectionState);
    }

    peerName = callToUsername;
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

    rtcPeerConns[peerName] = { conn: newRtcPeerConn };
  }
});

function handleOffer(offer, name) {
  peerName = name;

  let configuration = {
    'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
  };

  let offerRtcPeerConn = new RTCPeerConnection(configuration);

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
    dataChannels[peerName] = { channel: event.channel };
  };

  openDataChannel(offerRtcPeerConn, peerName);

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

  rtcPeerConns[peerName] = { conn: offerRtcPeerConn };
};

function handleAnswer(answer, senderName) {
  let answerPeerConn = rtcPeerConns[senderName].conn
  answerPeerConn.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleCandidate(candidate, senderName) {
  let candPeerConn = rtcPeerConns[senderName].conn
  candPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
};

function openDataChannel(peerConn, openName) {
  // newDataChannel = peerConn.createDataChannel('channel' + Object.keys(dataChannels).length, {reliable: true});
  newDataChannel = peerConn.createDataChannel(openName, {reliable: true});
  
  console.log('data channel created: ', newDataChannel);

  newDataChannel.onerror = (error) => {
    console.log('datachannel error: ', error);
  }

  newDataChannel.onmessage = (event) => {
    message = JSON.parse(event.data);
    
    console.log('new message received: ', event.data);
    // chatArea.innerHTML += peerName + ': ' + event.data + '<br />';
    chatArea.innerHTML += message.sender + ': ' + message.msg + '<br />';
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
  // peerName = null;
  // rtcPeerConn.close();
  // rtcPeerConn.onicecandidate = null;
  console.log('TODO: handleLeave()');
};

sendMsgBtn.addEventListener('click', (event) => {
  let val = msgInput.value;
  chatArea.innerHTML += name + ': ' + val + '<br />';
  // dataChannel.send(val);
  for(let channel in dataChannels) {
    // dataChannels[channel].channel.send(val);
    dataChannels[channel].channel.send(JSON.stringify({
      sender: name,
      msg: val
    }))
  }
  msgInput.value = '';
});