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
// let dataChannels = {};

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
  // dataChannels[message.receiver].channel.send(JSON.stringify(message));
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

// handle setting conns and channels

function setPeerConn(conn, peer) {
  rtcPeerConns[peer].conn = conn;
}

function setDataChannel(channel, peer) {
  // dataChannels[peer] = { channel: channel };
  // if (dataChannels[peer].channel) {
  //   // console.log('dataChannels[', peer, '].channel: exists');
  // }
  rtcPeerConns[peer].channel = channel;
  console.log('post channel creation rtcPeerConns: ', rtcPeerConns[peer]);
}

// end handle setting

function getRtcPC(peer) {
  let configuration = {
      'iceServers': [{'urls': 'stun:stun2.1.google.com:19302'}]
    };

    let newRtcPeerConn = new RTCPeerConnection(configuration);

        newRtcPeerConn.onicecandidate = (event) => {
      if(event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate,
          receiver: peer
        });
      };
    };

    newRtcPeerConn.ondatachannel = (event) => {
      let peers;
      // if(Object.keys(dataChannels).length > 1) {
      //   delete dataChannels[peer];
      //   peers = Object.keys(dataChannels);
      // }
      setDataChannel(event.channel, peer);
      // dataChannels[peer] = { channel: event.channel };
      if(peers) {
        sendToPeer({
          type: 'peers',
          peers: peers,
          receiver: event.channel.label
        });
      };
    };

    openDataChannel(newRtcPeerConn, peer);

    // newRtcPeerConn.oniceconnectionstatechange = () => {
    //   console.log('ICE connection state change: ', newRtcPeerConn.iceConnectionState);
    // };

    return newRtcPeerConn;
};

function handleOffer(offer, name) {
  let sender = name;

  let offerRtcPeerConn = getRtcPC(sender);

  offerRtcPeerConn.setRemoteDescription(new RTCSessionDescription(offer));

  offerRtcPeerConn.createAnswer((answer) => {
    offerRtcPeerConn.setLocalDescription(answer);
    send({
      type: 'answer',
      answer: answer,
      receiver: sender
    });
  }, (error) => {
    console.log('create answer error: ', error);
    alert('error when creating answer');
  });

  rtcPeerConns[sender] = { conn: offerRtcPeerConn };
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
  newDataChannel = peerConn.createDataChannel(name, {reliable: true});
  
  // console.log('data channel created: ', newDataChannel);

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
    // console.log('datachannel open: ', newDataChannel);
  };

  newDataChannel.onclose = () => {
    console.log('datachannel closed (duration: ', new Date() - newDataChannel.established, 'ms)');
  };

  // dataChannels[openName] = { channel: newDataChannel };
  
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
  let receiver = callToUsernameInput.value;

  if(receiver.length > 0) {

    let newRtcPeerConn = getRtcPC(receiver);

    newRtcPeerConn.createOffer((offer) => {
      newRtcPeerConn.setLocalDescription(offer);
      send({
        type: 'offer',
        offer: offer,
        receiver: receiver
      });
    }, (error) => {
      console.log('create offer error: ', error);
      alert('error creating offer');
    });

    rtcPeerConns[receiver] = { conn: newRtcPeerConn };
  }
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