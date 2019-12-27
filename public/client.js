/*
 *  connect to signaling server
 */
let HOST = location.origin.replace(/^http/, 'ws')
let signalingServer = new WebSocket(HOST);

signalingServer.onopen = () => {
  console.log('connection to signaling server established');
}

/*
 *  signaling server routing
 */
signalingServer.onmessage = (event) => {
  let data;

  try {
    data = JSON.parse(event.data);
  } catch(e) {
    console.log('invalid json');
    data = {};
  }

  console.log('signaling server message: ', data);

  switch(data.type) {
    case 'login':
      handleLogin(data.success);
      break;
    case 'offer':
      handleOffer(data.offer, data.sender);
      break;
    case 'answer':
      handleAnswer(data.answer, data.sender);
      break;
    case 'candidate':
      handleCandidate(data.candidate, data.sender);
      break;
    case 'leave':
      handleLeave();
      break;
    // case 'log':
    //   console.log(data.message);
    default:
      break;
  }
};

signalingServer.onerror = (err) => {
  console.log('error: ', err);
};

signalingServer.onclose = () => {
  console.log('connection to signaling server lost');
};

/*
 *  functions
 */
let name;

let rtcPeerConns = {};

function send(message) {
  if (name) {
    message.sender = name;
  }
  signalingServer.send(JSON.stringify(message));
};

function sendToPeer(message) {
  if(name) {
    message.sender = name;
  }
  rtcPeerConns[message.receiver].channel.send(JSON.stringify(message));
}

function handleLogin(success) {
  if(success === false) {
    alert('username already in use, try another username');
  } else {
    loginPage.style.display = 'none';
    callPage.style.display = 'block';
  }
};

function setPeerConn(conn, peer) {
  rtcPeerConns[peer].conn = conn;
};

// once setDataChannel finishes comm can start
function setDataChannel(channel, peer) {
  if (rtcPeerConns[peer].channel) {
    // rtcPeerConns[peer].relay = channel;
  } else {
    rtcPeerConns[peer].channel = channel;
    // create relay
  };
};

function getRtcPC(peer) {
  let configuration = {
    'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
  };

  let newRtcPeerConn = new RTCPeerConnection(configuration);

  // uses signaling server for icecandidate, move to function, create peer counterpart
  newRtcPeerConn.onicecandidate = (event) => {
    if(event.candidate) {
      send({
        type: 'candidate',
        candidate: event.candidate,
        receiver: peer
      });
    };
  };
  // ------------------------------------------

  newRtcPeerConn.ondatachannel = (event) => {
    setDataChannel(event.channel, peer);
  };

  openDataChannel(newRtcPeerConn);

  rtcPeerConns[peer] = { conn: newRtcPeerConn };
};

function handleOffer(offer, sender) {
  getRtcPC(sender);

  rtcPeerConns[sender].conn.setRemoteDescription(new RTCSessionDescription(offer));

  // uses signaling server for answer, move to function, create peer counterpart
  rtcPeerConns[sender].conn.createAnswer((answer) => {
    rtcPeerConns[sender].conn.setLocalDescription(answer);
    send({
      type: 'answer',
      answer: answer,
      receiver: sender
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });
  // -----------------------------------------------------------

};

function handleAnswer(answer, sender) {
  rtcPeerConns[sender].conn.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleCandidate(candidate, sender) {
  rtcPeerConns[sender].conn.addIceCandidate(new RTCIceCandidate(candidate));
};

// creating client data channel, recieves messages from peer (local representation of channel)
function openDataChannel(conn) {
  newDataChannel = conn.createDataChannel(name, {reliable: true});

  newDataChannel.onerror = (error) => {
    console.log('datachannel error: ', error);
  }

  /*
   *  data channel peer routing
   */
  newDataChannel.onmessage = (event) => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch(e) {
      console.log('invalid json');
      data = {};
    }

    console.log('peer message: ', data);
    
    switch(data.type) {
      case 'message':
        chatArea.innerHTML += data.sender + ': ' + data.message + '<br />';
        break;
      case 'peers':
        console.log('peers: ', data.peers, '\ncall handlePeers(data.peers)');
        break;
      default:
        break;
    };
  };

  newDataChannel.onopen = () => {
    newDataChannel.established = new Date();
  };

  newDataChannel.onclose = () => {
    console.log('datachannel closed (duration: ', new Date() - newDataChannel.established, 'ms)');
  };
};

function handleLeave() {
  // peerName = null;
  // rtcPeerConn.close();
  // rtcPeerConn.onicecandidate = null;
  console.log('TODO: handleLeave()');
};

/*
 *  user interface
 */

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
    });
  };
});

callBtn.addEventListener('click', () => {
  // ask server and/or peers if user exists before creating the rtcpc
  let receiver = callToUsernameInput.value;

  if(receiver.length > 0) {

    getRtcPC(receiver);

    // sends to signaling server, move to function, create peer counterpart
    rtcPeerConns[receiver].conn.createOffer((offer) => {
      rtcPeerConns[receiver].conn.setLocalDescription(offer);
      send({
        type: 'offer',
        offer: offer,
        receiver: receiver
      });
    }, (error) => {
      console.log('create offer error: ', error);
      alert('error creating offer');
    });
    // -------------------------------------------

  };
});

hangUpBtn.addEventListener('click', () => {
  send({
    type: 'leave'
  });
  handleLeave();
});

sendMsgBtn.addEventListener('click', (event) => {
  let val = msgInput.value;
  chatArea.innerHTML += name + ': ' + val + '<br />';
  for(let peer in rtcPeerConns) {
    // if user called peer that doesn't exist this will throw
    rtcPeerConns[peer].channel.send(JSON.stringify({
      type: 'message',
      sender: name,
      message: val
    }))
  };
  msgInput.value = '';
});