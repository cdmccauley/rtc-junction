/*
 *  connect to signaling server
 */
let HOST = location.origin.replace(/^http/, 'ws')
let signalingServer = new WebSocket(HOST);

signalingServer.onopen = () => {
  console.log('connection to signaling server established');
}

/*
 *
 *  signaling server routing
 * 
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
      handleServerOffer(data.offer, data.sender);
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
 *
 *  functions
 * 
 */

// declarations
let name;
let peers = [];
let rtcPeerConns = {};
let discovering = false;

/*
 *  attach name and condition server message
 */
function sendToServer(message) {
  if (name) {
    message.sender = name;
  }
  signalingServer.send(JSON.stringify(message));
};

/*
 *  attach name and condition peer message
 */
function sendToPeer(message) {
  if(name) {
    message.sender = name;
  }
  rtcPeerConns[message.receiver].relay.remote.send(JSON.stringify(message));
}

/*
 *
 */
function addChannelRouting(channel) {
  channel.onmessage = (event) => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch(e) {
      console.log('invalid json');
      data = {};
    }

    console.log('channel message: ', data);
    
    switch(data.type) {
      case 'message':
        chatArea.innerHTML += data.sender + ': ' + data.message + '<br />';
        break;
      default:
        break;
    };
  };
};

/*
 *
 */
function addRelayRouting(channel) {
  channel.onmessage = (event) => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch(e) {
      console.log('invalid json');
      data = {};
    }

    console.log('relay message: ', data);
    
    switch(data.type) {
      case 'discovery':
        handleDiscovery(data.sender);
        break;
      case 'peers':
        handlePeers(data.data, data.sender);
        break;
      case 'relay':
        handleRelay(data);
        break;
      // case 'call':
      //   handleCall(data);
      //   break;
      case 'offer':
        handlePeerOffer(data.offer, data.peer, data.sender);
        break;
      case 'answer':
        handleAnswer(data.answer, data.peer);
        break;
      case 'candidate':
        handleCandidate(data.candidate, data.peer);
        break;
      default:
        break;
    };
  };
};

/*
 *
 */
// function handleCall(data) {
//   console.log('initate call with ', data.peer);
// }

/*
 *
 */
function handleRelay(data) {
  // sendToPeer({
  //   type: data.relay,
  //   data: data.data,
  //   receiver: data.peer,
  //   peer: data.sender
  // })
  data.type = data.relay;
  data.receiver = data.peer;
  data.peer = data.sender
  sendToPeer(data);
}

/*
 *
 */
function handlePeers(candidates, sender) {
  for(let candidate of candidates) {
    if(candidate !== name && !peers.includes(candidate)) {
      /*
          TODO:
          need p2p call that calls getrtcpc then mirrors callbtn click
          need handlePeerOffer that mirrors handleServerOffer
      */
      // organize this
      // start local conn and channels
      getRtcPC(candidate);
      setPeerRtcPC(candidate, sender);
      // sendToPeer({
      //   type: 'relay',
      //   relay: 'call',
      //   data: 'some data',
      //   receiver: sender,
      //   peer: candidate
      // });
      // --------------
      break;
    };
  };
};

/*
 *
 */
function handleDiscovery(peer) {
  sendToPeer({
    type: 'peers',
    data: peers,
    receiver: peer
  })
}

/*
 *  handles dom reaction to login response from server
 */
function handleLogin(success) {
  if(success === false) {
    alert('username already in use, try another username');
  } else {
    loginPage.style.display = 'none';
    callPage.style.display = 'block';
  }
};

/*
 *
 */
function peerDiscovery(peer) {
  if(discovering) {
    console.log('starting discovery');
    sendToPeer({
      type: 'discovery',
      receiver: peer,
    });
  };
};

/*
 *
 */
function setDataChannel(channel, peer) {
  if (rtcPeerConns[peer].channel.remote) {
    rtcPeerConns[peer].relay.remote = channel;
    // look for more peers
    peerDiscovery(peer);
  } else {
    rtcPeerConns[peer].channel.remote = channel;
    // record peer
    peers.push(peer);
    // create relay
    openDataChannel(rtcPeerConns[peer].conn);
  };
  // possible to create and store more channels here
};

/*
 *
 */
function getRtcPC(peer) {
  let configuration = {
    'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
  };

  let newRtcPeerConn = new RTCPeerConnection(configuration);

  // store property for id
  newRtcPeerConn.peer = peer;

  newRtcPeerConn.ondatachannel = (event) => {
    setDataChannel(event.channel, peer);
  };

  openDataChannel(newRtcPeerConn);

  rtcPeerConns[peer].conn = newRtcPeerConn;
};

/*
 *
 */
function handlePeerOffer(offer, peer, sender) {
  discovering = true;
  console.log('discovering: ', discovering);
  getRtcPC(peer);

  rtcPeerConns[peer].conn.onicecandidate = (event) => {
    if(event.candidate) {
      sendToPeer({
        type: 'relay',
        relay: 'candidate',
        candidate: event.candidate,
        receiver: sender,
        peer: peer
      });
    };
  };

  rtcPeerConns[peer].conn.setRemoteDescription(new RTCSessionDescription(offer));

  rtcPeerConns[peer].conn.createAnswer((answer) => {
    rtcPeerConns[peer].conn.setLocalDescription(answer);
    sendToPeer({
      type: 'relay',
      relay: 'answer',
      answer: answer,
      receiver: sender,
      peer: peer
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });
}

/*
 *  handles offers coming from the signaling server
 */
function handleServerOffer(offer, sender) {
  discovering = true;
  console.log('discovering: ', discovering);

  getRtcPC(sender);

  rtcPeerConns[sender].conn.onicecandidate = (event) => {
    if(event.candidate) {
      sendToServer({
        type: 'candidate',
        candidate: event.candidate,
        receiver: sender
      });
    };
  };

  rtcPeerConns[sender].conn.setRemoteDescription(new RTCSessionDescription(offer));

  rtcPeerConns[sender].conn.createAnswer((answer) => {
    rtcPeerConns[sender].conn.setLocalDescription(answer);
    sendToServer({
      type: 'answer',
      answer: answer,
      receiver: sender
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });

};

/*
 *
 */
function handleAnswer(answer, sender) {
  discovering = false;
  console.log('discovering: ', discovering);
  rtcPeerConns[sender].conn.setRemoteDescription(new RTCSessionDescription(answer));
};

/*
 *
 */
function handleCandidate(candidate, sender) {
  rtcPeerConns[sender].conn.addIceCandidate(new RTCIceCandidate(candidate));
};



/*
 *  creating client data channel, recieves messages from peer (local representation of channel)
 */
function openDataChannel(conn) {
  newDataChannel = conn.createDataChannel(name, {reliable: true});

  newDataChannel.onerror = (error) => {
    console.log('datachannel error: ', error);
  }

  newDataChannel.onopen = () => {
    newDataChannel.established = new Date();
  };

  newDataChannel.onclose = () => {
    console.log('datachannel closed (duration: ', new Date() - newDataChannel.established, 'ms)');
  };

  let localChannel = { local: newDataChannel };

  // add references to local datachannels
  if(rtcPeerConns[conn.peer] === undefined) {
    // first channel, provide channel type handler
    addChannelRouting(localChannel.local);
    // store as channel.local
    rtcPeerConns[conn.peer] = { channel: localChannel };
  } else if(rtcPeerConns[conn.peer].relay === undefined) {
    // second channel, provide relay type handler
    addRelayRouting(localChannel.local);
    // store as relay.local
    rtcPeerConns[conn.peer].relay = localChannel;
  }
};

/*
 *  configures rtcpeerconnection for negotiation through peer
 */
function setPeerRtcPC(peer, relay) {
  rtcPeerConns[peer].conn.onicecandidate = (event) => {
    if(event.candidate) {
      sendToPeer({
        type: 'relay',
        relay: 'candidate',
        candidate: event.candidate,
        receiver: relay,
        peer: peer
      });
    };
  };

  rtcPeerConns[peer].conn.createOffer((offer) => {
    rtcPeerConns[peer].conn.setLocalDescription(offer);
    sendToPeer({
      type: 'relay',
      relay: 'offer',
      offer: offer,
      receiver: relay,
      peer: peer
    });
  }, (error) => {
    console.log('create offer error: ', error);
    alert('error creating offer');
  });
}

/*
 *  configures rtcpeerconnection for negotiation through server
 */
function setServerRtcPC(peer) {
  rtcPeerConns[peer].conn.onicecandidate = (event) => {
    if(event.candidate) {
      sendToServer({
        type: 'candidate',
        candidate: event.candidate,
        receiver: peer
      });
    };
  };

  rtcPeerConns[peer].conn.createOffer((offer) => {
    rtcPeerConns[peer].conn.setLocalDescription(offer);
    sendToServer({
      type: 'offer',
      offer: offer,
      receiver: peer
    });
  }, (error) => {
    console.log('create offer error: ', error);
    alert('error creating offer');
  });
};

/*
 *
 */
function handleLeave() {
  // peerName = null;
  // rtcPeerConn.close();
  // rtcPeerConn.onicecandidate = null;
  console.log('TODO: handleLeave()');
};

/*
 *
 *  user interface
 * 
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
    sendToServer({
      type: 'login',
    });
  };
});

// TODO: change to ask server if user is reachable, then move the function calls to a new server response handler
callBtn.addEventListener('click', () => {
  let receiver = callToUsernameInput.value;

  if(receiver.length > 0) {
    getRtcPC(receiver);
    setServerRtcPC(receiver);
  };
});

hangUpBtn.addEventListener('click', () => {
  sendToServer({
    type: 'leave'
  });
  handleLeave();
});

sendMsgBtn.addEventListener('click', (event) => {
  let val = msgInput.value;
  chatArea.innerHTML += name + ': ' + val + '<br />';
  for(let peer in rtcPeerConns) {
    // if user called peer that doesn't exist this will throw
    rtcPeerConns[peer].channel.remote.send(JSON.stringify({
      type: 'message',
      sender: name,
      message: val
    }))
  };
  msgInput.value = '';
});